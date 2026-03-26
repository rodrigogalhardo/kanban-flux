import Anthropic from "@anthropic-ai/sdk";
import type { AgentProvider, AgentTaskContext, ProviderResponse, AgentAction } from "../types";
import { AGENT_TOOLS_SCHEMA } from "../types";

// Reuse the same buildSystemPrompt and buildUserMessage logic from gemini.ts
// but adapt for Claude's tool_use format

function buildSystemPrompt(context: AgentTaskContext): string {
  // Same role prompts as Gemini provider
  const rolePrompts: Record<string, string> = {
    master: "You are the Master Orchestrator (Project Manager). You coordinate the entire team, create task cards, assign agents, and ensure the project is delivered end-to-end.",
    analyst: "You are the Analyst Agent. You research, validate concepts, define MVP scope, and decompose projects into actionable tasks.",
    architect: "You are the Solutions Architect. You design software architecture, define tech stack, and ensure enterprise-grade solutions.",
    frontend: "You are the Frontend Specialist. You develop premium UI/UX interfaces and responsive designs.",
    backend: "You are the Backend & DB Expert. You develop server-side systems, APIs, and database schemas.",
    qa: "You are the QA Engineer. You create test plans, write test cases, and validate deliveries.",
    security: "You are the Security Expert. You audit for ISO, NIST, MITRE, OWASP compliance.",
    devops: "You are the DevOps Engineer. You set up CI/CD, containers, and deployment infrastructure.",
    cloud: "You are the Cloud Architect. You design cloud infrastructure and ensure scalability.",
    dba: "You are the DBA Specialist. You design and optimize databases.",
    product: "You are the Product Strategist. You define product strategy and growth metrics.",
    hacker: "You are the Ethical Hacker. You perform penetration testing and security hardening.",
    knowledge: "You are the Knowledge Curator. You manage documentation and lessons learned.",
    prd: "You are the Product Manager. You create PRDs and user stories.",
  };

  const base = rolePrompts[context.agent.role] || context.agent.systemPrompt || "You are an AI agent working on a task.";

  return `${base}

${context.agent.systemPrompt ? `\nAdditional instructions: ${context.agent.systemPrompt}` : ""}

You are working on a kanban board. Use the available tools to interact with the board.
IMPORTANT: Always start by posting a comment about what you're going to do, then do the work, then post a final comment with results.

## Board Workflow
The board follows this workflow:
- "Todo" → Tasks waiting to be started
- "Brainstorming" → Tasks being analyzed, planned, and requirements defined
- "In Progress" → Tasks being actively developed/executed
- "QA" → Tasks completed and waiting for quality review by QA agent
- "Bug" → Tasks that failed QA review - need to be fixed
- "Done" → Tasks that passed QA review and are complete

Workflow rules:
- Analyst/Master: Create tasks in "Todo", move to "Brainstorming" when analyzing
- Dev agents (frontend, backend, architect): Pick from "Brainstorming" or "Todo", move to "In Progress" when working, move to "QA" when done
- QA agent: Pick from "QA", if passes move to "Done", if fails move to "Bug" with comment explaining what failed
- When a task is in "Bug": dev agent fixes it and moves back to "QA"
- NEVER skip columns - follow the flow: Todo → Brainstorming → In Progress → QA → Done

## Briefing Flow (Analyst only)
When you receive a card titled "Project Briefing" or "Project Briefing & Analysis":
1. Read the briefing document in the card description
2. Analyze requirements, scope, and deliverables
3. Create cards in "Todo" for each major task, with detailed descriptions including acceptance criteria
4. Create cards in "Brainstorming" for tasks that need more analysis
5. Assign appropriate agents to each card (use assign_agent tool)
6. Trigger the Master agent to orchestrate (use trigger_agent tool)
7. Move the briefing card to "Done"

## Responding to Human Comments
When you see a recent comment from a human (non-agent) user, prioritize responding to it:
- If they ask a question, answer it in a new comment
- If they give feedback, acknowledge and adjust your work
- If they request changes, implement them and report back
- If they ask for brainstorming, provide ideas and suggestions
- Always be helpful, concise, and actionable

## Agent Communication
- Use "request_help" to ask another specialist for input (e.g., ask DBA about schema design)
- Use "handoff" when completing your work and passing to QA (document what you did and how to test)
- Use "escalate" if you're blocked and can't resolve an issue - the Master will help
- When you receive a help request (see comments), respond helpfully`;
}

function buildUserMessage(context: AgentTaskContext): string {
  let msg = `## Task Card: ${context.card.title}\n\n`;
  if (context.card.description) msg += `### Description\n${context.card.description}\n\n`;
  msg += `### Board: ${context.card.board.name}\n`;
  msg += `### Current Column: ${context.card.column.title}\n\n`;
  if (context.card.labels.length > 0) msg += `### Labels: ${context.card.labels.map(l => l.name).join(", ")}\n\n`;
  if (context.card.dueDate) msg += `### Due Date: ${new Date(context.card.dueDate).toLocaleDateString()}\n\n`;
  if (context.card.checklists.length > 0) {
    msg += `### Checklists\n`;
    for (const cl of context.card.checklists) {
      msg += `**${cl.title}:**\n`;
      for (const item of cl.items) {
        msg += `- [${item.completed ? "x" : " "}] ${item.text} (id: ${item.id}, checklist: ${cl.id})\n`;
      }
    }
    msg += "\n";
  }
  if (context.card.comments.length > 0) {
    msg += `### Recent Comments\n`;
    for (const c of context.card.comments.slice(0, 5)) msg += `- **${c.user}**: ${c.text}\n`;
    msg += "\n";
  }
  msg += `### Available Board Columns\n`;
  for (const col of context.boardColumns) msg += `- "${col.title}" (id: ${col.id})\n`;
  msg += "\n";
  if (context.team.availableAgents.length > 0) {
    msg += `### Available Team Agents\n`;
    for (const a of context.team.availableAgents) msg += `- ${a.role} (agentId: ${a.id}, userId: ${a.userId}, status: ${a.status})\n`;
    msg += "\n";
  }
  msg += `\nPlease analyze this task and take appropriate action. Work autonomously and report your progress.`;
  return msg;
}

function convertToolsToClaude(): Anthropic.Tool[] {
  return AGENT_TOOLS_SCHEMA.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  }));
}

export class ClaudeProvider implements AgentProvider {
  name = "Claude";

  async execute(context: AgentTaskContext, apiKey: string): Promise<ProviderResponse> {
    const client = new Anthropic({ apiKey });
    const actions: AgentAction[] = [];
    let totalTokens = 0;
    let textContent = "";

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildUserMessage(context) },
    ];

    let iterations = 0;
    while (iterations < 10) {
      iterations++;

      const response = await client.messages.create({
        model: context.agent.model || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: buildSystemPrompt(context),
        tools: convertToolsToClaude(),
        messages,
      });

      totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

      let hasToolUse = false;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          textContent += block.text + "\n";
        }
        if (block.type === "tool_use") {
          hasToolUse = true;
          actions.push({
            type: block.name as AgentAction["type"],
            payload: (block.input as Record<string, unknown>) || {},
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Action "${block.name}" queued for execution`,
          });
        }
      }

      if (!hasToolUse || response.stop_reason === "end_turn") break;

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    return {
      content: textContent.trim(),
      actions,
      tokenUsage: totalTokens,
      done: true,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(tokenUsage: number, model: string): number {
    const rates: Record<string, number> = {
      "claude-sonnet-4-20250514": 3.0,
      "claude-haiku-4-5-20251001": 0.80,
      "claude-opus-4-20250514": 15.0,
    };
    const rate = rates[model] || 3.0;
    return (tokenUsage / 1_000_000) * rate;
  }
}
