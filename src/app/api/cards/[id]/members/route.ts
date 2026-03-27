import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const userId = body.userId;
  const cardMember = await prisma.cardMember.create({
    data: { cardId: params.id, userId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  // Check if the assigned member is an agent and auto-trigger
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAgent: true } });
  if (user?.isAgent) {
    import("@/lib/agents/auto-trigger").then(({ handleAgentAssigned }) => {
      handleAgentAssigned(params.id, userId).catch(console.error);
    });
  }

  return NextResponse.json(cardMember, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  await prisma.cardMember.delete({
    where: { cardId_userId: { cardId: params.id, userId } },
  });
  return NextResponse.json({ success: true });
}
