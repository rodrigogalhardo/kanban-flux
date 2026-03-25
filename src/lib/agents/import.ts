import { prisma } from "@/lib/prisma";
import type { AgentProvider } from "@prisma/client";

export interface ParsedAgent {
  name: string;
  role: string;
  provider: string;
  model: string;
  capabilities: string[];
  systemPrompt: string;
}

export interface ImportResult {
  action: "created" | "updated";
  agent: {
    id: string;
    role: string;
    provider: string;
    model: string;
    capabilities: string[];
    systemPrompt: string | null;
    user: { id: string; name: string; email: string; avatar: string | null };
  };
}

const VALID_PROVIDERS = ["CLAUDE", "GEMINI", "OPENAI", "CUSTOM"];
const DEFAULT_WORKSPACE_ID = "default-workspace";

/**
 * Parse YAML frontmatter and markdown body from a markdown string.
 * Expects the format:
 * ---
 * key: value
 * capabilities:
 *   - item1
 *   - item2
 * ---
 * # Markdown body...
 */
export function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>;
  systemPrompt: string;
} {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid markdown: no YAML frontmatter found. Expected --- delimiters.");
  }

  const frontmatterStr = match[1];
  const body = match[2].trim();

  const frontmatter: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  let arrayValues: string[] = [];

  for (const line of frontmatterStr.split(/\r?\n/)) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Array item
    if (trimmed.startsWith("- ") && inArray) {
      arrayValues.push(trimmed.substring(2).trim());
      continue;
    }

    // End of array (new key encountered)
    if (inArray) {
      frontmatter[currentKey] = arrayValues;
      inArray = false;
      arrayValues = [];
    }

    // Key: value pair
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > -1) {
      const key = trimmed.substring(0, colonIdx).trim();
      const value = trimmed.substring(colonIdx + 1).trim();
      currentKey = key;
      if (value === "") {
        // Start of array or empty value
        inArray = true;
        arrayValues = [];
      } else {
        frontmatter[key] = value;
      }
    }
  }

  // Flush remaining array
  if (inArray) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter, systemPrompt: body };
}

/**
 * Parse a markdown string into a structured agent definition.
 */
export function parseAgentMarkdown(markdown: string): ParsedAgent {
  const { frontmatter, systemPrompt } = parseFrontmatter(markdown);

  const name = frontmatter.name as string | undefined;
  const role = frontmatter.role as string | undefined;
  const rawProvider = ((frontmatter.provider as string) || "GEMINI").toUpperCase();
  const provider = VALID_PROVIDERS.includes(rawProvider) ? rawProvider : "CUSTOM";
  const model = (frontmatter.model as string) || "gemini-2.0-flash";

  const capabilities = Array.isArray(frontmatter.capabilities)
    ? frontmatter.capabilities
    : typeof frontmatter.capabilities === "string"
      ? frontmatter.capabilities.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

  if (!name || !role) {
    throw new Error(
      "name and role are required in frontmatter. Got: " +
        JSON.stringify({ name, role })
    );
  }

  return { name, role, provider, model, capabilities, systemPrompt };
}

/**
 * Import a single agent from parsed agent data.
 * Upserts: if an agent with the same role exists, update it; otherwise create.
 */
export async function importAgent(
  parsed: ParsedAgent,
  workspaceId?: string
): Promise<ImportResult> {
  const wsId = workspaceId || DEFAULT_WORKSPACE_ID;

  // Check if an agent with this role already exists
  const existingAgent = await prisma.agent.findFirst({
    where: { role: parsed.role },
    include: { user: true },
  });

  if (existingAgent) {
    // Update existing agent
    const updated = await prisma.agent.update({
      where: { id: existingAgent.id },
      data: {
        provider: parsed.provider as AgentProvider,
        model: parsed.model,
        systemPrompt: parsed.systemPrompt,
        capabilities: parsed.capabilities,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Update user name if changed
    if (existingAgent.user.name !== parsed.name) {
      await prisma.user.update({
        where: { id: existingAgent.userId },
        data: { name: parsed.name },
      });
    }

    return {
      action: "updated",
      agent: updated,
    };
  }

  // Create new user for agent
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: `${parsed.role}-agent-${Date.now()}@agents.kanbanflux.ai`,
      isAgent: true,
    },
  });

  // Add user to workspace
  await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId: wsId,
      role: "MEMBER",
    },
  });

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      userId: user.id,
      provider: parsed.provider as AgentProvider,
      model: parsed.model,
      role: parsed.role,
      systemPrompt: parsed.systemPrompt,
      capabilities: parsed.capabilities,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  return {
    action: "created",
    agent,
  };
}
