import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { getQueueStats } = await import("@/lib/agents/queue");
    const stats = await getQueueStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Queue not available", details: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
