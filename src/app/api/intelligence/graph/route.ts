import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { projectId } = await req.json();
  if (!projectId)
    return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { buildProjectGraph } = await import(
    "@/lib/intelligence/graph-builder"
  );
  const result = await buildProjectGraph(projectId);
  return NextResponse.json(result, { status: 201 });
}

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId)
    return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { getProjectGraph } = await import(
    "@/lib/intelligence/graph-builder"
  );
  const graph = await getProjectGraph(projectId);
  return NextResponse.json(graph);
}
