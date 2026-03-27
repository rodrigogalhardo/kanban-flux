import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/agents/crypto";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      boards: {
        include: {
          columns: {
            include: {
              cards: {
                include: {
                  members: {
                    include: {
                      user: { select: { name: true, isAgent: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let totalCards = 0,
    todoCards = 0,
    inProgressCards = 0,
    qaCards = 0,
    bugCards = 0,
    doneCards = 0;
  const agentNames = new Set<string>();

  for (const board of project.boards) {
    for (const col of board.columns) {
      for (const card of col.cards) {
        totalCards++;
        const colName = col.title.toLowerCase();
        if (colName === "todo" || colName === "brainstorming") todoCards++;
        else if (colName.includes("progress")) inProgressCards++;
        else if (colName === "qa") qaCards++;
        else if (colName === "bug") bugCards++;
        else if (colName === "done") doneCards++;
        card.members
          .filter((m) => m.user.isAgent)
          .forEach((m) => agentNames.add(m.user.name));
      }
    }
  }

  // Try to generate AI report
  let aiReport = "";
  try {
    const apiKeyRecord = await prisma.agentApiKey.findFirst({
      where: { provider: "GEMINI" },
    });
    if (apiKeyRecord) {
      const apiKey = decrypt(apiKeyRecord.encryptedKey, apiKeyRecord.iv);
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `You are a project manager. Give a brief status report (3-5 sentences, natural language) for this project:

Project: ${project.name}
Total tasks: ${totalCards} (Todo: ${todoCards}, In Progress: ${inProgressCards}, QA: ${qaCards}, Bug: ${bugCards}, Done: ${doneCards})
Completion: ${totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0}%
Active agents: ${Array.from(agentNames).join(", ") || "None"}
${bugCards > 0 ? `WARNING: ${bugCards} tasks have bugs that need fixing.` : ""}

Be direct, mention risks, and give a recommendation.`;

      const result = await model.generateContent(prompt);
      aiReport = result.response.text();
    }
  } catch {
    // AI report generation failed silently
  }

  return NextResponse.json({
    project: project.name,
    stats: {
      totalCards,
      todoCards,
      inProgressCards,
      qaCards,
      bugCards,
      doneCards,
    },
    completionRate:
      totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0,
    agents: Array.from(agentNames),
    aiReport,
  });
}
