import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const item = await prisma.checklistItem.create({
    data: {
      text: body.text,
      completed: false,
      checklistId: params.id,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
