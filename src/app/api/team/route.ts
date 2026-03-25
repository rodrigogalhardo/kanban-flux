import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (role && role !== "ALL") {
    where.role = role;
  }
  if (search) {
    where.user = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const members = await prisma.workspaceMember.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, isAgent: true } },
    },
  });
  return NextResponse.json(members);
}
