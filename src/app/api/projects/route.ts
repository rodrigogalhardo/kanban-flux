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
  const { name, description, workspaceId, createRepo } = body as {
    name: string;
    description?: string;
    workspaceId?: string;
    createRepo?: boolean;
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

  return NextResponse.json(project, { status: 201 });
}
