import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  const memberData: Record<string, unknown> = {};
  if (body.role) memberData.role = body.role;

  const member = await prisma.workspaceMember.update({
    where: { id: params.id },
    data: memberData,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  // Allow updating user details (name, avatar) through the same endpoint
  if (body.userName || body.userAvatar) {
    const userData: Record<string, unknown> = {};
    if (body.userName) userData.name = body.userName;
    if (body.userAvatar) userData.avatar = body.userAvatar;
    await prisma.user.update({
      where: { id: member.user.id },
      data: userData,
    });
    if (body.userName) member.user.name = body.userName;
    if (body.userAvatar) member.user.avatar = body.userAvatar;
  }

  return NextResponse.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.workspaceMember.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
