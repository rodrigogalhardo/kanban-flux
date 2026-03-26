import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import type { Prisma } from "@prisma/client";

export async function GET() {
  // Seed default templates if none exist
  const count = await prisma.teamTemplate.count();
  if (count === 0) {
    const { DEFAULT_TEMPLATES } = await import("@/lib/marketplace/templates");
    for (const template of DEFAULT_TEMPLATES) {
      await prisma.teamTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          category: template.category,
          agents: template.agents as unknown as Prisma.InputJsonValue,
          isPublic: true,
        },
      });
    }
  }

  const templates = await prisma.teamTemplate.findMany({
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(templates);
}
