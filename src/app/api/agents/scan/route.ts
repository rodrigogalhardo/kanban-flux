import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const { dailyScan } = await import("@/lib/agents/auto-assign");
  const result = await dailyScan();
  return NextResponse.json(result);
}

export async function GET() {
  // Also allow GET for easy testing/cron
  const { dailyScan } = await import("@/lib/agents/auto-assign");
  const result = await dailyScan();
  return NextResponse.json(result);
}
