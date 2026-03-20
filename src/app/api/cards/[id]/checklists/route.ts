import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const checklist = await prisma.checklist.create({
    data: {
      title: body.title,
      cardId: params.id,
      items: body.items
        ? {
            create: body.items.map((item: { text: string }) => ({
              text: item.text,
              completed: false,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });
  return NextResponse.json(checklist, { status: 201 });
}
