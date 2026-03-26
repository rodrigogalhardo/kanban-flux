import { GoogleGenerativeAI, type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import type { AgentProvider, AgentTaskContext, ProviderResponse, AgentAction } from "../types";
import { AGENT_TOOLS_SCHEMA } from "../types";

function buildSystemPrompt(context: AgentTaskContext): string {
  const rolePrompts: Record<string, string> = {
    master: "You are the Master Orchestrator (Project Manager). You coordinate the entire team, create task cards, assign agents, and ensure the project is delivered end-to-end. You manage timelines and priorities.",
    analyst: "You are the Analyst Agent. You research, validate concepts, define MVP scope, and decompose projects into actionable tasks. You work with the Master to define requirements for each team member.",
    architect: "You are the Solutions Architect. You design software architecture, define tech stack, create system diagrams, and ensure enterprise-grade solutions.",
    frontend: "You are the Frontend Specialist. You develop premium UI/UX interfaces, implement responsive designs, and ensure accessibility.",
    backend: "You are the Backend & DB Expert. You develop server-side systems, APIs, database schemas, and business logic.",
    qa: "You are the QA Engineer. You create test plans, write test cases, validate deliveries, and ensure quality standards.",
    security: "You are the Security Expert. You audit for ISO, NIST, MITRE, and OWASP compliance, identify vulnerabilities, and recommend fixes.",
    devops: "You are the DevOps Engineer. You set up CI/CD pipelines, containers, automation, and deployment infrastructure.",
    cloud: "You are the Cloud Architect. You design cloud infrastructure, provision resources, and ensure security and scalability.",
    dba: "You are the DBA Specialist. You design and optimize SQL, NoSQL, vector, and graph databases.",
    product: "You are the Product Strategist. You define product strategy, PLG, growth metrics, and market positioning.",
    hacker: "You are the Ethical Hacker (Red/Blue Team). You perform penetration testing, identify vulnerabilities, and recommend security hardening.",
    knowledge: "You are the Knowledge Curator. You manage evolutionary memory, document lessons learned, and maintain the knowledge base.",
    prd: "You are the Product Manager. You create PRDs (Product Requirements Documents) and user stories.",
  };

  const base = rolePrompts[context.agent.role] || context.agent.systemPrompt || "You are an AI agent working on a task.";

  return `${base}

${context.agent.systemPrompt ? `\nAdditional instructions: ${context.agent.systemPrompt}` : ""}

You are working on a kanban board. Use the available tools to interact with the board:
- Use "comment" to report your progress, findings, or results
- Use "checklist_update" to mark completed items
- Use "move_card" to move cards between columns (e.g., To Do -> In Progress -> Done)
- Use "update_description" to update card descriptions with your work
- Use "create_card" to create sub-task cards (if you're a Master or Analyst)
- Use "assign_agent" to assign agents to cards (if you're a Master or Analyst)
- Use "trigger_agent" to start another agent working on a card

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

  if (context.card.description) {
    msg += `### Description\n${context.card.description}\n\n`;
  }

  msg += `### Board: ${context.card.board.name}\n`;
  msg += `### Current Column: ${context.card.column.title}\n\n`;

  if (context.card.labels.length > 0) {
    msg += `### Labels: ${context.card.labels.map((l) => l.name).join(", ")}\n\n`;
  }

  if (context.card.dueDate) {
    msg += `### Due Date: ${new Date(context.card.dueDate).toLocaleDateString()}\n\n`;
  }

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
    for (const c of context.card.comments.slice(0, 5)) {
      msg += `- **${c.user}**: ${c.text}\n`;
    }
    msg += "\n";
  }

  msg += `### Available Board Columns\n`;
  for (const col of context.boardColumns) {
    msg += `- "${col.title}" (id: ${col.id})\n`;
  }
  msg += "\n";

  if (context.team.availableAgents.length > 0) {
    msg += `### Available Team Agents\n`;
    for (const a of context.team.availableAgents) {
      msg += `- ${a.role} (agentId: ${a.id}, userId: ${a.userId}, status: ${a.status})\n`;
    }
    msg += "\n";
  }

  msg += `\nPlease analyze this task and take appropriate action using the tools available to you. Work autonomously and report your progress.`;

  return msg;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertPropertyToSchema(val: Record<string, unknown>): any {
  if (val.type === "boolean") {
    return {
      type: SchemaType.BOOLEAN,
      description: val.description as string,
    };
  }
  if (val.enum) {
    return {
      type: SchemaType.STRING,
      format: "enum",
      description: val.description as string,
      enum: val.enum as string[],
    };
  }
  return {
    type: SchemaType.STRING,
    description: val.description as string,
  };
}

function convertToolsToGemini(): FunctionDeclaration[] {
  const declarations = AGENT_TOOLS_SCHEMA.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, val]) => [
          key,
          convertPropertyToSchema(val as Record<string, unknown>),
        ])
      ),
      required: tool.parameters.required,
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return declarations as any as FunctionDeclaration[];
}

export class GeminiProvider implements AgentProvider {
  name = "Gemini";

  async execute(context: AgentTaskContext, apiKey: string): Promise<ProviderResponse> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: context.agent.model || "gemini-2.0-flash",
      systemInstruction: buildSystemPrompt(context),
      tools: [{ functionDeclarations: convertToolsToGemini() }],
    });

    const actions: AgentAction[] = [];
    let totalTokens = 0;
    let textContent = "";

    const chat = model.startChat();
    let response = await chat.sendMessage(buildUserMessage(context));
    let result = response.response;
    totalTokens += result.usageMetadata?.totalTokenCount || 0;

    // Process function calls in a loop (max 10 iterations to prevent infinite loops)
    let iterations = 0;
    while (iterations < 10) {
      iterations++;
      const candidate = result.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content?.parts || [];
      let hasFunctionCalls = false;

      for (const part of parts) {
        if (part.text) {
          textContent += part.text + "\n";
        }
        if (part.functionCall) {
          hasFunctionCalls = true;
          const fc = part.functionCall;
          actions.push({
            type: fc.name as AgentAction["type"],
            payload: (fc.args as Record<string, unknown>) || {},
          });
        }
      }

      if (!hasFunctionCalls) break;

      // Send function responses back to continue the conversation
      const functionResponses = parts
        .filter((p) => p.functionCall)
        .map((p) => ({
          functionResponse: {
            name: p.functionCall!.name,
            response: { success: true, message: `Action "${p.functionCall!.name}" queued for execution` },
          },
        }));

      response = await chat.sendMessage(functionResponses);
      result = response.response;
      totalTokens += result.usageMetadata?.totalTokenCount || 0;
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
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      await model.generateContent("test");
      return true;
    } catch {
      return false;
    }
  }

  estimateCost(tokenUsage: number, model: string): number {
    // Gemini pricing (approximate per 1M tokens)
    const rates: Record<string, number> = {
      "gemini-2.0-flash": 0.10,
      "gemini-2.5-pro-preview-05-06": 1.25,
      "gemini-2.5-flash-preview-05-20": 0.15,
    };
    const rate = rates[model] || 0.10;
    return (tokenUsage / 1_000_000) * rate;
  }
}
