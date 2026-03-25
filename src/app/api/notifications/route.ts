import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const where: Record<string, unknown> = { userId };
  if (unreadOnly) {
    where.read = false;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return NextResponse.json(notifications);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids, all, userId } = body as {
    ids?: string[];
    all?: boolean;
    userId?: string;
  };

  if (all && userId) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  if (ids && Array.isArray(ids) && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Provide ids array or { all: true, userId }" },
    { status: 400 }
  );
}
