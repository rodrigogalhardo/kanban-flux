import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
// import { decrypt } from "@/lib/agents/crypto"; // Available for LLM-enhanced reasoning

interface SimTask {
  id: string;
  title: string;
  column: string;
  labels: string[];
  assignedAgent: string | null;
  complexity: number; // 1-5 estimated from description length
  startedRound?: number;
}

interface SimAgent {
  name: string;
  role: string;
  capabilities: string[];
}

export async function runSimulation(simulationId: string) {
  const sim = await prisma.simulation.findUniqueOrThrow({
    where: { id: simulationId },
    include: {
      project: {
        include: {
          boards: {
            include: {
              columns: {
                orderBy: { position: "asc" },
                include: {
                  cards: {
                    include: {
                      labels: { include: { label: true } },
                      members: {
                        include: {
                          user: { select: { name: true, isAgent: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  await prisma.simulation.update({
    where: { id: simulationId },
    data: { status: "RUNNING" },
  });

  try {
    // Build task list from board
    const tasks: SimTask[] = [];

    for (const board of sim.project.boards) {
      for (const col of board.columns) {
        for (const card of col.cards) {
          tasks.push({
            id: card.id,
            title: card.title,
            column: col.title,
            labels: card.labels.map((l) => l.label.name),
            assignedAgent:
              card.members.find((m) => m.user.isAgent)?.user.name || null,
            complexity: Math.min(
              5,
              Math.max(1, Math.ceil((card.description?.length || 50) / 100))
            ),
          });
        }
      }
    }

    // Get agents
    const agents = await prisma.agent.findMany({
      include: { user: { select: { name: true } } },
    });

    const simAgents: SimAgent[] = agents.map((a) => ({
      name: a.user.name,
      role: a.role,
      capabilities: a.capabilities,
    }));

    // If no agents exist, create default simulated agents
    if (simAgents.length === 0) {
      simAgents.push(
        {
          name: "SimAgent-Dev",
          role: "developer",
          capabilities: ["frontend", "backend", "bug", "feature"],
        },
        {
          name: "SimAgent-QA",
          role: "tester",
          capabilities: ["testing", "qa", "review", "bug"],
        }
      );
    }

    // Gemini API key can be used for LLM-enhanced reasoning in future rounds
    // const apiKeyRecord = await prisma.agentApiKey.findFirst({ where: { provider: "GEMINI" } });
    // const geminiApiKey = apiKeyRecord ? decrypt(apiKeyRecord.encryptedKey, apiKeyRecord.iv) : null;

    // Simulate rounds
    const taskStates = new Map(tasks.map((t) => [t.id, { ...t }]));

    for (let round = 1; round <= sim.rounds; round++) {
      await prisma.simulation.update({
        where: { id: simulationId },
        data: { currentRound: round },
      });

      for (const agent of simAgents) {
        // Find tasks in "To Do" that match agent capabilities
        const availableTasks = Array.from(taskStates.values()).filter(
          (t) =>
            t.column === "To Do" &&
            (t.assignedAgent === agent.name || t.assignedAgent === null)
        );

        const inProgressTasks = Array.from(taskStates.values()).filter(
          (t) => t.column === "In Progress" && t.assignedAgent === agent.name
        );

        let actionType = "SKIP";
        let targetCard: string | null = null;
        let reasoning = "";

        if (inProgressTasks.length > 0) {
          // Check if any in-progress task should be completed
          const task = inProgressTasks[0];
          const roundsWorked = round - (task.startedRound || 1);
          if (roundsWorked >= task.complexity) {
            actionType = "COMPLETE_TASK";
            targetCard = task.title;
            reasoning = `Completed "${task.title}" after ${task.complexity} rounds of work`;
            taskStates.set(task.id, { ...task, column: "Done" });
          } else {
            actionType = "WORKING";
            targetCard = task.title;
            reasoning = `Continuing work on "${task.title}" (round ${roundsWorked + 1}/${task.complexity})`;
          }
        } else if (availableTasks.length > 0) {
          // Pick a task matching capabilities
          const matchingTask =
            availableTasks.find((t) =>
              t.labels.some((l) =>
                agent.capabilities.some((c) =>
                  l.toLowerCase().includes(c.toLowerCase())
                )
              )
            ) || availableTasks[0];

          actionType = "PICK_TASK";
          targetCard = matchingTask.title;
          reasoning = `Picked up "${matchingTask.title}" (matches ${agent.role} skills)`;
          taskStates.set(matchingTask.id, {
            ...matchingTask,
            column: "In Progress",
            assignedAgent: agent.name,
            startedRound: round,
          });
        } else {
          actionType = "SKIP";
          reasoning = "No available tasks matching my skills";
        }

        // Record action
        await prisma.simulationAction.create({
          data: {
            simulationId,
            round,
            agentName: agent.name,
            agentRole: agent.role,
            actionType,
            targetCard,
            reasoning,
          },
        });
      }
    }

    // Generate predictions
    const completedTasks = Array.from(taskStates.values()).filter(
      (t) => t.column === "Done"
    ).length;
    const remainingTasks = Array.from(taskStates.values()).filter(
      (t) => t.column !== "Done"
    ).length;
    const totalTasks = tasks.length;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Find bottlenecks (agents with most SKIP actions)
    const actions = await prisma.simulationAction.findMany({
      where: { simulationId },
    });
    const agentSkips: Record<string, number> = {};
    const agentCompletions: Record<string, number> = {};
    actions.forEach((a) => {
      if (a.actionType === "SKIP")
        agentSkips[a.agentName] = (agentSkips[a.agentName] || 0) + 1;
      if (a.actionType === "COMPLETE_TASK")
        agentCompletions[a.agentName] =
          (agentCompletions[a.agentName] || 0) + 1;
    });

    const bottlenecks = Object.entries(agentSkips)
      .filter(([, count]) => count > sim.rounds * 0.5)
      .map(([name, count]) => ({
        agent: name,
        idleRounds: count,
        reason: "Insufficient matching tasks",
      }));

    const predictions = {
      estimatedRoundsToComplete:
        remainingTasks > 0
          ? Math.ceil(remainingTasks / simAgents.length) + sim.rounds
          : sim.rounds,
      completionRate,
      completedTasks,
      remainingTasks,
      totalTasks,
      bottlenecks,
      agentUtilization: simAgents.map((a) => ({
        agent: a.name,
        role: a.role,
        completedTasks: agentCompletions[a.name] || 0,
        idleRounds: agentSkips[a.name] || 0,
        utilization: Math.round(
          ((sim.rounds - (agentSkips[a.name] || 0)) / sim.rounds) * 100
        ),
      })),
      recommendations: [
        ...(bottlenecks.length > 0
          ? [
              `Consider adding more agents with skills matching: ${bottlenecks.map((b) => b.agent).join(", ")}`,
            ]
          : []),
        ...(remainingTasks > completedTasks
          ? ["Project may need more rounds to complete all tasks"]
          : []),
        ...(completionRate >= 80
          ? ["Project is on track for timely delivery"]
          : []),
      ],
    };

    await prisma.simulation.update({
      where: { id: simulationId },
      data: {
        status: "COMPLETED",
        results: {
          totalActions: actions.length,
          roundsCompleted: sim.rounds,
        } as unknown as Prisma.InputJsonValue,
        predictions: predictions as unknown as Prisma.InputJsonValue,
      },
    });

    return predictions;
  } catch (error) {
    console.error("Simulation failed:", error);
    await prisma.simulation.update({
      where: { id: simulationId },
      data: {
        status: "FAILED",
        results: {
          error: error instanceof Error ? error.message : "Unknown error",
        } as unknown as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}
