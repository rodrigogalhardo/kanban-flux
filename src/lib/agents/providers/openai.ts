import OpenAI from "openai";
import type { AgentProvider, AgentTaskContext, ProviderResponse, AgentAction } from "../types";
import { AGENT_TOOLS_SCHEMA } from "../types";

function buildSystemPrompt(context: AgentTaskContext): string {
  const rolePrompts: Record<string, string> = {
    master: "You are the Master Orchestrator (Project Manager). You coordinate the entire team, create task cards, assign agents, and ensure project delivery.",
    analyst: "You are the Analyst Agent. You research, validate concepts, define MVP scope, and decompose projects into tasks.",
    architect: "You are the Solutions Architect. You design software architecture and enterprise solutions.",
    frontend: "You are the Frontend Specialist. You develop premium UI/UX interfaces.",
    backend: "You are the Backend & DB Expert. You develop APIs and database systems.",
    qa: "You are the QA Engineer. You validate deliveries and ensure quality.",
    security: "You are the Security Expert. You audit for compliance and vulnerabilities.",
    devops: "You are the DevOps Engineer. You manage CI/CD and infrastructure.",
    cloud: "You are the Cloud Architect. You provision cloud resources and security.",
    dba: "You are the DBA Specialist. You optimize databases.",
    product: "You are the Product Strategist. You define strategy and growth.",
    hacker: "You are the Ethical Hacker. You perform pentesting.",
    knowledge: "You are the Knowledge Curator. You manage documentation.",
    prd: "You are the Product Manager. You create PRDs.",
  };

  const base = rolePrompts[context.agent.role] || context.agent.systemPrompt || "You are an AI agent.";

  return `${base}

${context.agent.systemPrompt ? `\nAdditional instructions: ${context.agent.systemPrompt}` : ""}

You work on a kanban board. Use tools to interact: comment for progress, checklist_update to check items, move_card between columns, update_description for results, create_card for sub-tasks, assign_agent to delegate, trigger_agent to start agents.
Always comment first about what you'll do, do the work, then comment results.

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
  msg += `### Board: ${context.card.board.name}\n### Current Column: ${context.card.column.title}\n\n`;
  if (context.card.labels.length > 0) msg += `### Labels: ${context.card.labels.map(l => l.name).join(", ")}\n\n`;
  if (context.card.dueDate) msg += `### Due Date: ${new Date(context.card.dueDate).toLocaleDateString()}\n\n`;
  if (context.card.checklists.length > 0) {
    msg += `### Checklists\n`;
    for (const cl of context.card.checklists) {
      msg += `**${cl.title}:**\n`;
      for (const item of cl.items) msg += `- [${item.completed ? "x" : " "}] ${item.text} (id: ${item.id}, checklist: ${cl.id})\n`;
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
  msg += `\nAnalyze this task and take action. Work autonomously.`;
  return msg;
}

function convertToolsToOpenAI(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return AGENT_TOOLS_SCHEMA.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export class OpenAIProvider implements AgentProvider {
  name = "OpenAI";

  async execute(context: AgentTaskContext, apiKey: string): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey });
    const actions: AgentAction[] = [];
    let totalTokens = 0;
    let textContent = "";

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: buildUserMessage(context) },
    ];

    let iterations = 0;
    while (iterations < 10) {
      iterations++;

      const response = await client.chat.completions.create({
        model: context.agent.model || "gpt-4o",
        messages,
        tools: convertToolsToOpenAI(),
        max_tokens: 4096,
      });

      const choice = response.choices[0];
      totalTokens += response.usage?.total_tokens || 0;

      if (choice.message.content) {
        textContent += choice.message.content + "\n";
      }

      if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) break;

      messages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        const fnCall = tc as { id: string; type: string; function: { name: string; arguments: string } };
        const args = JSON.parse(fnCall.function.arguments || "{}");
        actions.push({
          type: fnCall.function.name as AgentAction["type"],
          payload: args,
        });
        messages.push({
          role: "tool",
          tool_call_id: fnCall.id,
          content: `Action "${fnCall.function.name}" queued for execution`,
        });
      }

      if (choice.finish_reason !== "tool_calls") break;
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
      const client = new OpenAI({ apiKey });
      await client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(tokenUsage: number, model: string): number {
    const rates: Record<string, number> = {
      "gpt-4o": 5.0,
      "gpt-4o-mini": 0.15,
      "gpt-4-turbo": 10.0,
    };
    const rate = rates[model] || 5.0;
    return (tokenUsage / 1_000_000) * rate;
  }
}
