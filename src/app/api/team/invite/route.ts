import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, role, workspaceId, name } = body;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name || email.split("@")[0],
        email,
      },
    });
  }

  const existing = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a member" },
      { status: 409 }
    );
  }

  const member = await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId,
      role: role || "MEMBER",
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });
  return NextResponse.json(member, { status: 201 });
}
