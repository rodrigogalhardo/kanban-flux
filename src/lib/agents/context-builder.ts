import { prisma } from "@/lib/prisma";
import type { AgentTaskContext } from "./types";

export async function buildTaskContext(cardId: string, agentId: string): Promise<AgentTaskContext> {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: {
      column: {
        include: {
          board: {
            include: {
              columns: { orderBy: { position: "asc" } },
              project: {
                select: { id: true, name: true, githubRepo: true },
              },
            },
          },
        },
      },
      labels: { include: { label: true } },
      members: { include: { user: { select: { id: true, name: true, isAgent: true } } } },
      checklists: { include: { items: true } },
      comments: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
    include: { user: { select: { id: true, name: true } } },
  });

  // Get all available agents in the workspace for team context
  const allAgents = await prisma.agent.findMany({
    where: { status: { not: "ERROR" } },
    select: {
      id: true,
      userId: true,
      role: true,
      capabilities: true,
      status: true,
    },
  });

  // Fetch recent memories for this agent
  const { recallRecentMemories, recallMemories } = await import("./memory");
  const recentMemories = await recallRecentMemories(agentId, 5);

  // Cross-project memories (search by relevant keywords from current task)
  const keywords = [card.title, ...(card.labels?.map(l => l.label.name) || [])].join(" ");
  const crossProjectMemories = await recallMemories(agentId, keywords, 3);

  // Filter out memories already in recentMemories to avoid duplicates
  const recentIds = new Set(recentMemories.map(m => m.id));
  const uniqueCrossProjectMemories = crossProjectMemories.filter(m => !recentIds.has(m.id));

  return {
    card: {
      id: card.id,
      title: card.title,
      description: card.description,
      dueDate: card.dueDate,
      column: { id: card.column.id, title: card.column.title },
      board: {
        id: card.column.board.id,
        name: card.column.board.name,
        description: card.column.board.description,
      },
      checklists: card.checklists.map((cl) => ({
        id: cl.id,
        title: cl.title,
        items: cl.items.map((item) => ({
          id: item.id,
          text: item.text,
          completed: item.completed,
        })),
      })),
      comments: card.comments.map((c) => ({
        user: c.user.name,
        text: c.text,
        createdAt: c.createdAt,
      })),
      labels: card.labels.map((l) => ({ name: l.label.name, color: l.label.color })),
      members: card.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        isAgent: m.user.isAgent,
      })),
    },
    agent: {
      id: agent.id,
      userId: agent.userId,
      role: agent.role,
      systemPrompt: agent.systemPrompt,
      capabilities: agent.capabilities,
      model: agent.model,
    },
    team: {
      availableAgents: allAgents.filter((a) => a.id !== agentId),
    },
    boardColumns: card.column.board.columns.map((col) => ({
      id: col.id,
      title: col.title,
      position: col.position,
    })),
    ...(card.column.board.project
      ? {
          project: {
            id: card.column.board.project.id,
            name: card.column.board.project.name,
            githubRepo: card.column.board.project.githubRepo,
          },
        }
      : {}),
    memories: recentMemories.map((m) => ({
      type: m.type,
      content: m.content,
      tags: m.tags,
    })),
    crossProjectMemories: uniqueCrossProjectMemories.map((m) => ({
      type: m.type,
      content: m.content,
      tags: m.tags,
      source: m.source,
    })),
  };
}
