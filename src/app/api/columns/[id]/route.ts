import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const column = await prisma.column.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(column);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.column.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
