import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const labels = await prisma.label.findMany();
  return NextResponse.json(labels);
}
