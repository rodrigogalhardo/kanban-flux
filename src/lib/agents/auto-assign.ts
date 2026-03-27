import { prisma } from "@/lib/prisma";

const ROLE_LABEL_MAP: Record<string, string[]> = {
  frontend: ["Frontend", "Design", "UI", "UX", "CSS", "React"],
  backend: ["Backend", "API", "Database", "Server", "Node"],
  qa: ["QA", "Testing", "Test", "Quality"],
  architect: ["Architecture", "Design", "System"],
  devops: ["DevOps", "CI/CD", "Docker", "Deploy", "Infrastructure"],
  dba: ["Database", "SQL", "DBA", "Schema"],
  analyst: ["Analysis", "Research", "Market", "AI/ML"],
  security: ["Security", "OWASP", "Audit"],
};

const ROLE_KEYWORD_MAP: Record<string, string[]> = {
  frontend: ["component", "page", "ui", "ux", "css", "tailwind", "react", "landing", "hero", "section", "responsive", "design system"],
  backend: ["api", "endpoint", "server", "database", "schema", "auth", "middleware", "prisma", "route"],
  qa: ["test", "qa", "quality", "validation", "accessibility", "performance", "audit", "review"],
  architect: ["architecture", "design", "system", "scalab", "infrastructure"],
  devops: ["deploy", "ci/cd", "docker", "pipeline", "kubernetes", "monitor"],
  analyst: ["analyz", "research", "market", "requirement", "brief", "scope"],
};

export async function autoAssignCard(cardId: string): Promise<string | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: { include: { label: true } },
      members: { include: { user: { select: { isAgent: true } } } },
    },
  });

  if (!card) return null;

  // Skip if already has an agent assigned
  if (card.members.some(m => m.user.isAgent)) return null;

  // Determine best role based on labels
  let bestRole: string | null = null;
  let bestScore = 0;

  const cardLabels = card.labels.map(l => l.label.name);
  const cardText = `${card.title} ${card.description || ""}`.toLowerCase();

  for (const [role, labels] of Object.entries(ROLE_LABEL_MAP)) {
    let score = 0;
    for (const label of labels) {
      if (cardLabels.some(cl => cl.toLowerCase().includes(label.toLowerCase()))) {
        score += 3;
      }
    }
    // Also check keywords in title/description
    const keywords = ROLE_KEYWORD_MAP[role] || [];
    for (const kw of keywords) {
      if (cardText.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRole = role;
    }
  }

  // Default to analyst if no match
  if (!bestRole || bestScore === 0) {
    bestRole = "analyst";
  }

  // Find the agent with this role
  const agent = await prisma.agent.findFirst({
    where: { role: bestRole },
    include: { user: { select: { id: true } } },
  });

  if (!agent) return null;

  // Assign agent to card
  await prisma.cardMember.upsert({
    where: { cardId_userId: { cardId, userId: agent.userId } },
    create: { cardId, userId: agent.userId },
    update: {},
  });

  return agent.role;
}

/**
 * Scan all boards and auto-assign agents to unassigned cards in Todo/Brainstorming
 * Then trigger agents on In Progress cards that have agents but no active runs
 */
export async function dailyScan() {
  const boards = await prisma.board.findMany({
    include: {
      columns: {
        include: {
          cards: {
            include: {
              members: { include: { user: { select: { id: true, isAgent: true } } } },
            },
          },
        },
      },
      project: { select: { autoTrigger: true } },
    },
  });

  let assigned = 0;
  let triggered = 0;

  for (const board of boards) {
    // Check if project has autoTrigger enabled
    const autoTrigger = board.project?.autoTrigger ?? true;
    if (!autoTrigger) continue;

    for (const col of board.columns) {
      const colName = col.title.toLowerCase();

      for (const card of col.cards) {
        const hasAgent = card.members.some(m => m.user.isAgent);

        // Auto-assign unassigned cards in Todo/Brainstorming
        if (!hasAgent && (colName === "todo" || colName === "brainstorming")) {
          const role = await autoAssignCard(card.id);
          if (role) {
            assigned++;
            console.log(`[Daily Scan] Auto-assigned ${role} to "${card.title}"`);
          }
        }

        // Trigger agents on cards with agents but no active runs
        if (hasAgent && (colName === "todo" || colName === "brainstorming" || colName === "in progress")) {
          const agentMember = card.members.find(m => m.user.isAgent);
          if (agentMember) {
            const agent = await prisma.agent.findFirst({
              where: { userId: agentMember.user.id },
            });

            if (agent) {
              // Check for active runs
              const activeRun = await prisma.agentRun.findFirst({
                where: {
                  agentId: agent.id,
                  cardId: card.id,
                  status: { in: ["QUEUED", "RUNNING"] },
                },
              });

              if (!activeRun) {
                // Check capacity
                const activeRuns = await prisma.agentRun.count({
                  where: {
                    agentId: agent.id,
                    status: { in: ["QUEUED", "RUNNING"] },
                  },
                });

                if (activeRuns < agent.maxConcurrent) {
                  const run = await prisma.agentRun.create({
                    data: { agentId: agent.id, cardId: card.id, status: "QUEUED" },
                  });
                  await prisma.agent.update({
                    where: { id: agent.id },
                    data: { status: "WORKING" },
                  });
                  try {
                    const { enqueueAgentRun } = await import("./queue");
                    await enqueueAgentRun(run.id);
                    triggered++;
                    console.log(`[Daily Scan] Triggered ${agent.role} on "${card.title}"`);
                  } catch {}
                }
              }
            }
          }
        }
      }
    }
  }

  return { assigned, triggered };
}
