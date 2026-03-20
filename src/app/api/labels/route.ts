import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const labels = await prisma.label.findMany();
  return NextResponse.json(labels);
}
