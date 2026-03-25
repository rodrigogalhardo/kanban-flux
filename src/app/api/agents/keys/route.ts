import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/agents/crypto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId") || DEFAULT_WORKSPACE_ID;

  const keys = await prisma.agentApiKey.findMany({
    where: { workspaceId },
    select: {
      id: true,
      provider: true,
      label: true,
      encryptedKey: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const safeKeys = keys.map((k) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    lastFour: k.encryptedKey.slice(-4),
    createdAt: k.createdAt,
  }));

  return NextResponse.json(safeKeys);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { provider, key, label, workspaceId } = body;

  const effectiveWorkspaceId = workspaceId || DEFAULT_WORKSPACE_ID;

  const { encrypted, iv } = encrypt(key);

  const apiKey = await prisma.agentApiKey.create({
    data: {
      provider,
      encryptedKey: encrypted,
      iv,
      label,
      workspaceId: effectiveWorkspaceId,
    },
    select: {
      id: true,
      provider: true,
      label: true,
      createdAt: true,
    },
  });

  return NextResponse.json(apiKey, { status: 201 });
}
