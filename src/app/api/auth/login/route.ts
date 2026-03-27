import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      workspaces: {
        include: { workspace: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  // Simple password check (for MVP - in production use bcrypt)
  // If user has no password set, accept any password (legacy users)
  if (user.password && user.password !== password) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const workspace = user.workspaces[0]?.workspace;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAgent: user.isAgent,
      workspaceId: workspace?.id || "default-workspace",
    },
  });
}
