import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;

  const dependencies = await prisma.cardDependency.findMany({
    where: { cardId: id },
    include: {
      dependsOn: {
        select: {
          id: true,
          title: true,
          columnId: true,
          column: { select: { title: true } },
        },
      },
    },
  });

  const dependedOnBy = await prisma.cardDependency.findMany({
    where: { dependsOnId: id },
    include: {
      card: {
        select: {
          id: true,
          title: true,
          columnId: true,
          column: { select: { title: true } },
        },
      },
    },
  });

  return NextResponse.json({ dependencies, dependedOnBy });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const { dependsOnId, type } = await req.json();

  if (dependsOnId === id) {
    return NextResponse.json(
      { error: "Card cannot depend on itself" },
      { status: 400 }
    );
  }

  const dep = await prisma.cardDependency.upsert({
    where: {
      cardId_dependsOnId: { cardId: id, dependsOnId },
    },
    create: {
      cardId: id,
      dependsOnId,
      type: type || "DEPENDS_ON",
    },
    update: { type: type || "DEPENDS_ON" },
    include: {
      dependsOn: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(dep, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const dependsOnId = new URL(req.url).searchParams.get("dependsOnId");

  if (!dependsOnId) {
    return NextResponse.json(
      { error: "dependsOnId required" },
      { status: 400 }
    );
  }

  await prisma.cardDependency.delete({
    where: {
      cardId_dependsOnId: { cardId: id, dependsOnId },
    },
  });

  return NextResponse.json({ deleted: true });
}
