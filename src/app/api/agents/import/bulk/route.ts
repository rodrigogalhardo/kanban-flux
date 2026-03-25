import { NextRequest, NextResponse } from "next/server";
import { parseAgentMarkdown, importAgent } from "@/lib/agents/import";

interface FileEntry {
  filename: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files, workspaceId } = body as {
      files?: FileEntry[];
      workspaceId?: string;
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "files array is required and must not be empty" },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      try {
        const parsed = parseAgentMarkdown(file.content);
        const result = await importAgent(parsed, workspaceId);
        results.push({
          filename: file.filename,
          success: true,
          action: result.action,
          agent: result.agent,
        });
      } catch (error) {
        results.push({
          filename: file.filename,
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to import",
        });
      }
    }

    const created = results.filter((r) => r.success && r.action === "created").length;
    const updated = results.filter((r) => r.success && r.action === "updated").length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      summary: { total: files.length, created, updated, failed },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process bulk import",
      },
      { status: 400 }
    );
  }
}
