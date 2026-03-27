import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type");
  const where = type ? { fileType: type } : {};
  const artifacts = await prisma.cardAttachment.findMany({
    where,
    include: {
      card: { select: { title: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(artifacts);
}
