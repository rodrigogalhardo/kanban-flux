import { NextRequest, NextResponse } from "next/server";
import { autoPrioritizeBoard } from "@/lib/intelligence/auto-prioritize";

export async function POST(req: NextRequest) {
  try {
    const { boardId } = await req.json();

    if (!boardId) {
      return NextResponse.json({ error: "boardId is required" }, { status: 400 });
    }

    const result = await autoPrioritizeBoard(boardId);

    if (!result) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Auto-prioritize error:", error);
    return NextResponse.json({ error: "Failed to auto-prioritize" }, { status: 500 });
  }
}
