import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { predictProjectTimeline } = await import("@/lib/intelligence/timeline-predictor");
  const timeline = await predictProjectTimeline(projectId);
  return NextResponse.json(timeline);
}
