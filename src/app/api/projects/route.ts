import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      boards: {
        select: {
          id: true,
          name: true,
          status: true,
          columns: {
            select: {
              cards: {
                select: {
                  members: {
                    select: {
                      user: {
                        select: { id: true, name: true, isAgent: true },
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
    orderBy: { updatedAt: "desc" },
  });

  const result = projects.map((project) => {
    const boardCount = project.boards.length;
    const agentSet = new Set<string>();
    project.boards.forEach((board) =>
      board.columns.forEach((col) =>
        col.cards.forEach((card) =>
          card.members.forEach((m) => {
            if (m.user.isAgent) agentSet.add(m.user.id);
          })
        )
      )
    );
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      githubRepo: project.githubRepo,
      githubUrl: project.githubUrl,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      boardCount,
      agentCount: agentSet.size,
      boards: project.boards.map((b) => ({ id: b.id, name: b.name })),
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, workspaceId, createRepo, briefing } = body as {
    name: string;
    description?: string;
    workspaceId?: string;
    createRepo?: boolean;
    briefing?: string;
  };

  let githubRepo: string | null = null;
  let githubUrl: string | null = null;

  if (createRepo) {
    try {
      const { createRepository } = await import("@/lib/github");
      const repo = await createRepository(name, description);
      githubRepo = repo.fullName;
      githubUrl = repo.url;
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to create GitHub repository",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    // Setup CI/CD workflows
    try {
      const { setupAllCI } = await import("@/lib/cicd/setup");
      const repoName = githubRepo!.split("/")[1];
      await setupAllCI(repoName);
    } catch (ciError) {
      console.error("Failed to setup CI/CD:", ciError);
      // Non-blocking - project creation still succeeds
    }
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || null,
      githubRepo,
      githubUrl,
      workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
    },
  });

  // If briefing is provided, create board with columns and trigger Analyst agent
  if (briefing) {
    try {
      // Create board linked to project
      const board = await prisma.board.create({
        data: {
          name: `${name} - Sprint 1`,
          description: `Main development board for ${name}`,
          workspaceId: workspaceId || DEFAULT_WORKSPACE_ID,
          projectId: project.id,
        },
      });

      // Create default columns
      const defaultColumns = ["Todo", "Brainstorming", "In Progress", "QA", "Bug", "Done"];
      const columns = [];
      for (let i = 0; i < defaultColumns.length; i++) {
        const col = await prisma.column.create({
          data: { title: defaultColumns[i], position: i, boardId: board.id },
        });
        columns.push(col);
      }

      // Create briefing card in Todo column
      const todoCol = columns[0];
      const briefingCard = await prisma.card.create({
        data: {
          title: `Project Briefing & Analysis: ${name}`,
          description: briefing,
          columnId: todoCol.id,
          position: 0,
        },
      });

      // Find analyst agent
      const analyst = await prisma.agent.findFirst({
        where: { role: "analyst" },
      });

      if (analyst) {
        // Assign analyst to the card
        await prisma.cardMember.create({
          data: { cardId: briefingCard.id, userId: analyst.userId },
        });

        // Create and trigger agent run
        const run = await prisma.agentRun.create({
          data: {
            agentId: analyst.id,
            cardId: briefingCard.id,
            status: "QUEUED",
          },
        });

        await prisma.agent.update({
          where: { id: analyst.id },
          data: { status: "WORKING" },
        });

        // Enqueue for processing
        try {
          const { enqueueAgentRun } = await import("@/lib/agents/queue");
          await enqueueAgentRun(run.id);
        } catch (e) {
          console.error("Failed to enqueue analyst run:", e);
        }
      }
    } catch (briefingError) {
      console.error("Failed to setup briefing board:", briefingError);
      // Non-blocking - project creation still succeeds
    }
  }

  return NextResponse.json(project, { status: 201 });
}
