import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      boards: {
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: { id: true, name: true, avatar: true, isAgent: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, description, status, githubRepo, githubUrl } = body as {
    name?: string;
    description?: string;
    status?: string;
    githubRepo?: string;
    githubUrl?: string;
  };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (githubRepo !== undefined) data.githubRepo = githubRepo;
  if (githubUrl !== undefined) data.githubUrl = githubUrl;

  const project = await prisma.project.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Disconnect boards from the project before deleting
  await prisma.board.updateMany({
    where: { projectId: params.id },
    data: { projectId: null },
  });

  await prisma.project.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
