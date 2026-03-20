import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { columns } = await req.json();
  await prisma.$transaction(
    columns.map((col: { id: string; position: number }) =>
      prisma.column.update({
        where: { id: col.id },
        data: { position: col.position },
      })
    )
  );
  return NextResponse.json({ success: true });
}
