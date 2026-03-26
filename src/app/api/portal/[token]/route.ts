import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await prisma.project.findUnique({
    where: { publicToken: token },
    include: {
      boards: {
        include: {
          columns: {
            orderBy: { position: "asc" },
            include: {
              cards: {
                select: { title: true, priority: true },
                orderBy: { position: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let total = 0, done = 0, inProgress = 0, todo = 0;
  const columns = project.boards.flatMap(b => b.columns.map(c => {
    c.cards.forEach(() => {
      total++;
      if (c.title.toLowerCase() === "done") done++;
      else if (c.title.toLowerCase().includes("progress")) inProgress++;
      else if (c.title.toLowerCase() === "todo") todo++;
    });
    return { title: c.title, cards: c.cards };
  }));

  return NextResponse.json({
    project: { name: project.name, description: project.description, status: project.status },
    columns,
    stats: { total, done, inProgress, todo },
  });
}
