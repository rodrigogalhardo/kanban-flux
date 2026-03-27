import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let dna = await prisma.projectDNA.findUnique({
    where: { projectId: id },
  });
  if (!dna) {
    const { generateProjectDNA } = await import(
      "@/lib/intelligence/project-dna"
    );
    dna = await generateProjectDNA(id);
  }
  return NextResponse.json(dna);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { generateProjectDNA } = await import(
    "@/lib/intelligence/project-dna"
  );
  const dna = await generateProjectDNA(id);
  return NextResponse.json(dna);
}
