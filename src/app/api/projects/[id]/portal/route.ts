import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = crypto.randomBytes(16).toString("hex");
  await prisma.project.update({
    where: { id },
    data: { publicToken: token },
  });
  return NextResponse.json({ token, url: `/portal/${token}` });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { publicToken: true },
  });
  if (!project?.publicToken) return NextResponse.json({ token: null });
  return NextResponse.json({ token: project.publicToken, url: `/portal/${project.publicToken}` });
}
