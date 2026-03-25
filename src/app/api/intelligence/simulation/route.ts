import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSimulation } from "@/lib/intelligence/simulation";

export async function POST(req: NextRequest) {
  try {
    const { projectId, rounds } = await req.json();
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const sim = await prisma.simulation.create({
      data: { projectId, rounds: rounds || 10 },
    });

    // Fire and forget simulation
    runSimulation(sim.id).catch((err) =>
      console.error("Simulation failed:", err)
    );

    return NextResponse.json(sim, { status: 202 });
  } catch (error) {
    console.error("Error creating simulation:", error);
    return NextResponse.json(
      { error: "Failed to create simulation" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const simId = searchParams.get("id");

    if (simId) {
      const sim = await prisma.simulation.findUnique({
        where: { id: simId },
        include: { actions: { orderBy: { round: "asc" } } },
      });
      if (!sim) {
        return NextResponse.json(
          { error: "Simulation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(sim);
    }

    if (projectId) {
      const sims = await prisma.simulation.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return NextResponse.json(sims);
    }

    return NextResponse.json(
      { error: "projectId or id required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching simulations:", error);
    return NextResponse.json(
      { error: "Failed to fetch simulations" },
      { status: 500 }
    );
  }
}
