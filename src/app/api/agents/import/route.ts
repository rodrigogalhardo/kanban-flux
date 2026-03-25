import { NextRequest, NextResponse } from "next/server";
import { parseAgentMarkdown, importAgent } from "@/lib/agents/import";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { markdown, workspaceId } = body;

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { error: "markdown content is required" },
        { status: 400 }
      );
    }

    const parsed = parseAgentMarkdown(markdown);
    const result = await importAgent(parsed, workspaceId);

    return NextResponse.json(result, {
      status: result.action === "created" ? 201 : 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to import agent",
      },
      { status: 400 }
    );
  }
}
