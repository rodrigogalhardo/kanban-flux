import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const experiments = await prisma.promptExperiment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      card: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json(experiments);
}

export async function POST(req: NextRequest) {
  const { cardId, promptA, promptB } = await req.json();

  if (!cardId || !promptA || !promptB) {
    return NextResponse.json(
      { error: "cardId, promptA, and promptB are required" },
      { status: 400 }
    );
  }

  // Get card context for the prompts
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      column: { select: { title: true } },
      labels: { include: { label: true } },
      checklists: { include: { items: true } },
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const taskContext = `Task: ${card.title}\nDescription: ${card.description || "N/A"}\nColumn: ${card.column.title}\nLabels: ${card.labels.map((l) => l.label.name).join(", ") || "none"}`;

  // Create experiment record first
  const experiment = await prisma.promptExperiment.create({
    data: { cardId, promptA, promptB },
  });

  // Run both prompts via the available provider
  try {
    const apiKey = await prisma.agentApiKey.findFirst();
    if (!apiKey) {
      return NextResponse.json(
        { ...experiment, error: "No API key configured. Results will be empty." },
        { status: 201 }
      );
    }

    const { decrypt } = await import("@/lib/agents/crypto");
    const key = decrypt(apiKey.encryptedKey, apiKey.iv);
    const { getProvider } = await import("@/lib/agents/provider");
    const provider = getProvider(apiKey.provider);

    // Run prompt A
    let resultA = "";
    let tokensA = 0;
    try {
      const responseA = await provider.execute(
        {
          agent: {
            role: "experiment",
            systemPrompt: promptA,
            model: "gemini-2.0-flash",
            capabilities: [],
          },
          card: {
            id: card.id,
            title: card.title,
            description: card.description || "",
            priority: card.priority,
            column: card.column,
            board: { name: "Experiment" },
            labels: card.labels.map((l) => l.label),
            checklists: card.checklists,
            comments: [],
            members: [],
          },
          boardColumns: [],
          agentMemories: [],
          team: { availableAgents: [] },
        } as unknown as Parameters<typeof provider.execute>[0],
        key
      );
      resultA = responseA.actions
        .filter((a) => a.type === "comment")
        .map((a) => (a.payload as { text: string }).text)
        .join("\n") || `Agent produced ${responseA.actions.length} actions`;
      tokensA = responseA.tokenUsage;
    } catch (e) {
      resultA = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Run prompt B
    let resultB = "";
    let tokensB = 0;
    try {
      const responseB = await provider.execute(
        {
          agent: {
            role: "experiment",
            systemPrompt: promptB,
            model: "gemini-2.0-flash",
            capabilities: [],
          },
          card: {
            id: card.id,
            title: card.title,
            description: card.description || "",
            priority: card.priority,
            column: card.column,
            board: { name: "Experiment" },
            labels: card.labels.map((l) => l.label),
            checklists: card.checklists,
            comments: [],
            members: [],
          },
          boardColumns: [],
          agentMemories: [],
          team: { availableAgents: [] },
        } as unknown as Parameters<typeof provider.execute>[0],
        key
      );
      resultB = responseB.actions
        .filter((a) => a.type === "comment")
        .map((a) => (a.payload as { text: string }).text)
        .join("\n") || `Agent produced ${responseB.actions.length} actions`;
      tokensB = responseB.tokenUsage;
    } catch (e) {
      resultB = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Update experiment with results
    const updated = await prisma.promptExperiment.update({
      where: { id: experiment.id },
      data: { resultA, resultB, tokensA, tokensB },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (e) {
    // Return experiment even if execution fails
    return NextResponse.json(
      { ...experiment, error: `Execution failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 201 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { id, winner } = await req.json();
  if (!id || !winner) {
    return NextResponse.json({ error: "id and winner are required" }, { status: 400 });
  }

  const updated = await prisma.promptExperiment.update({
    where: { id },
    data: { winner },
  });

  return NextResponse.json(updated);
}
