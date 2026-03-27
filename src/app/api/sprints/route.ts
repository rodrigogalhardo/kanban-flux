import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const sprints = await prisma.sprint.findMany({
    where: projectId ? { projectId } : {},
    include: {
      cards: {
        include: {
          card: {
            include: {
              column: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  // Add completion stats
  const sprintsWithStats = sprints.map((sprint) => {
    const totalCards = sprint.cards.length;
    const completedCards = sprint.cards.filter(
      (sc) => sc.card.column.title.toLowerCase() === "done"
    ).length;
    return {
      ...sprint,
      _count: { cards: totalCards },
      completedCards,
      completionPercent: totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0,
    };
  });

  return NextResponse.json(sprintsWithStats);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, projectId, startDate, endDate, goal } = body;

  if (!name || !projectId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "name, projectId, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const sprint = await prisma.sprint.create({
    data: {
      name,
      projectId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      goal: goal || null,
    },
  });

  return NextResponse.json(sprint, { status: 201 });
}
