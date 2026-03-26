import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  // Seed default board templates if none exist
  const count = await prisma.boardTemplate.count();
  if (count === 0) {
    const { DEFAULT_BOARD_TEMPLATES } = await import("@/lib/marketplace/board-templates");
    for (const template of DEFAULT_BOARD_TEMPLATES) {
      await prisma.boardTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          columns: template.columns as unknown as Prisma.InputJsonValue,
          cardTemplates: template.cardTemplates as unknown as Prisma.InputJsonValue,
          isPublic: true,
        },
      });
    }
  }

  const templates = await prisma.boardTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}
