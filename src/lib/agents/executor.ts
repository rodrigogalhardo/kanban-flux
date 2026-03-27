import { prisma } from "@/lib/prisma";
import { getProvider } from "./provider";
import { buildTaskContext } from "./context-builder";
import { decrypt } from "./crypto";
import type { AgentAction } from "./types";
import { AGENT_TOOLS_SCHEMA } from "./types";
import type { Prisma, AgentProvider as AgentProviderType } from "@prisma/client";
import { agentLogger } from "@/lib/logger";

const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes

async function logRun(runId: string, level: string, message: string, metadata?: Record<string, unknown>) {
  await prisma.agentRunLog.create({
    data: { runId, level, message, metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : undefined },
  });
}

async function applyAction(action: AgentAction, cardId: string, agentUserId: string, runId: string, agentId?: string): Promise<void> {
  switch (action.type) {
    case "comment": {
      const { text } = action.payload as { text: string };
      await prisma.comment.create({
        data: { text, userId: agentUserId, cardId },
      });
      // Notify card members about agent comment
      const { notifyCardMembers: notifyComment } = await import("@/lib/notifications");
      await notifyComment(cardId, agentUserId, {
        type: "agent_comment",
        title: "Agent commented",
        message: text.substring(0, 100),
      });
      await logRun(runId, "info", `Posted comment: ${text.substring(0, 100)}...`);
      break;
    }

    case "checklist_update": {
      const { checklistId, itemId, completed } = action.payload as {
        checklistId: string;
        itemId: string;
        completed: boolean;
      };
      await prisma.checklistItem.update({
        where: { id: itemId, checklistId },
        data: { completed },
      });
      await logRun(runId, "info", `Updated checklist item ${itemId}: completed=${completed}`);
      break;
    }

    case "move_card": {
      const { columnId } = action.payload as { columnId: string };
      // Get old columnId before moving for auto-trigger
      const oldCard = await prisma.card.findUnique({ where: { id: cardId }, select: { columnId: true } });
      // Get the max position in the target column
      const maxPos = await prisma.card.aggregate({
        where: { columnId },
        _max: { position: true },
      });
      await prisma.card.update({
        where: { id: cardId },
        data: { columnId, position: (maxPos._max.position ?? -1) + 1 },
      });
      // Notify card members about card move
      const { notifyCardMembers: notifyMove } = await import("@/lib/notifications");
      const targetCol = await prisma.column.findUnique({ where: { id: columnId }, select: { title: true } });
      await notifyMove(cardId, agentUserId, {
        type: "card_move",
        title: "Card moved",
        message: `Card moved to "${targetCol?.title || "column"}"`,
      });
      await logRun(runId, "info", `Moved card to column ${columnId}`);
      // Auto-trigger agent on column change (won't double-trigger due to activeRun check)
      if (oldCard && columnId !== oldCard.columnId) {
        import("./auto-trigger").then(({ handleCardColumnChange }) => {
          handleCardColumnChange(cardId, columnId, oldCard.columnId).catch(console.error);
        });
      }
      break;
    }

    case "update_description": {
      const { description } = action.payload as { description: string };
      await prisma.card.update({
        where: { id: cardId },
        data: { description },
      });
      await logRun(runId, "info", `Updated card description`);
      break;
    }

    case "create_card": {
      const { title, description, columnId } = action.payload as {
        title: string;
        description?: string;
        columnId: string;
      };
      const maxPos = await prisma.card.aggregate({
        where: { columnId },
        _max: { position: true },
      });
      const newCard = await prisma.card.create({
        data: {
          title,
          description: description || null,
          columnId,
          position: (maxPos._max.position ?? -1) + 1,
          dueDate: (action.payload as { dueDate?: string }).dueDate ? new Date((action.payload as { dueDate?: string }).dueDate!) : null,
        },
      });
      await logRun(runId, "info", `Created card "${title}" (id: ${newCard.id})`, { cardId: newCard.id });
      break;
    }

    case "assign_agent": {
      const { cardId: targetCardId, agentUserId: targetUserId } = action.payload as {
        cardId: string;
        agentUserId: string;
      };
      // Create CardMember link (upsert to avoid duplicates)
      await prisma.cardMember.upsert({
        where: { cardId_userId: { cardId: targetCardId, userId: targetUserId } },
        create: { cardId: targetCardId, userId: targetUserId },
        update: {},
      });
      await logRun(runId, "info", `Assigned agent ${targetUserId} to card ${targetCardId}`);
      break;
    }

    case "trigger_agent": {
      const { agentId: targetAgentId, cardId: targetCardId } = action.payload as {
        agentId: string;
        cardId: string;
      };
      // Create a child run
      const childRun = await prisma.agentRun.create({
        data: {
          agentId: targetAgentId,
          cardId: targetCardId,
          parentRunId: runId,
          status: "QUEUED",
        },
      });
      await logRun(runId, "info", `Triggered agent ${targetAgentId} on card ${targetCardId} (run: ${childRun.id})`);
      // Dynamic import to avoid build-time Redis connection
      const { enqueueAgentRun } = await import("./queue");
      await enqueueAgentRun(childRun.id);
      break;
    }

    case "log": {
      const { level, message } = action.payload as { level?: string; message: string };
      await logRun(runId, level || "info", message);
      break;
    }

    case "git_commit": {
      const { repo, path, content, message, branch } = action.payload as {
        repo: string; path: string; content: string; message: string; branch?: string;
      };
      const { commitFile } = await import("@/lib/github");
      await commitFile(repo, path, content, message, branch || "main");
      await logRun(runId, "info", `Committed to ${repo}/${path}: ${message}`);

      // Also attach the file to the card for inline code diff viewing
      const commitExt = path.split('.').pop()?.toLowerCase() || '';
      const commitMimeTypes: Record<string, string> = {
        ts: 'text/typescript', js: 'text/javascript', py: 'text/x-python',
        md: 'text/markdown', txt: 'text/plain', json: 'application/json',
        yaml: 'text/yaml', yml: 'text/yaml', html: 'text/html', css: 'text/css',
        prisma: 'text/plain', sql: 'text/sql', sh: 'text/x-shellscript',
        tsx: 'text/typescript', jsx: 'text/javascript', rs: 'text/x-rust',
        go: 'text/x-go', rb: 'text/x-ruby', java: 'text/x-java',
      };
      await prisma.cardAttachment.create({
        data: {
          cardId,
          filename: path,
          fileType: "code",
          mimeType: commitMimeTypes[commitExt] || "text/plain",
          content: content,
          size: Buffer.byteLength(content, "utf8"),
          createdBy: agentUserId,
        },
      }).catch(() => {}); // non-critical

      break;
    }

    case "create_pr": {
      const { repo, title, body, head, base } = action.payload as {
        repo: string; title: string; body: string; head: string; base?: string;
      };
      if (agentId) {
        // Create approval gate for PR creation
        const gateDescription = `Agent wants to create PR "${title}" in ${repo} (${head} -> ${base || "main"})`;
        await prisma.approvalGate.create({
          data: {
            runId,
            agentId,
            actionType: "create_pr",
            description: gateDescription,
            metadata: action.payload as unknown as Prisma.InputJsonValue,
          },
        });
        await logRun(runId, "info", `Approval required: create PR "${title}" - waiting for human approval`);
        // Notify admin about pending approval
        const { createNotification } = await import("@/lib/notifications");
        const agentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { name: true } });
        const adminUser = await prisma.user.findFirst({ where: { isAgent: false } });
        if (adminUser) {
          await createNotification({
            userId: adminUser.id,
            type: "approval_required",
            title: "Approval Required",
            message: `${agentUser?.name || "Agent"} wants to create_pr: ${gateDescription}`,
            cardId,
          });
        }
      } else {
        const { createPullRequest } = await import("@/lib/github");
        const pr = await createPullRequest(repo, title, body, head, base || "main");
        await logRun(runId, "info", `Created PR #${pr.number}: ${title} (${pr.url})`);
      }
      break;
    }

    case "merge_pr": {
      const { repo, pullNumber } = action.payload as { repo: string; pullNumber: number };
      if (agentId) {
        // Create approval gate - don't execute the merge directly
        const mergeDescription = `Agent wants to merge PR #${pullNumber} in ${repo}`;
        await prisma.approvalGate.create({
          data: {
            runId,
            agentId,
            actionType: "merge_pr",
            description: mergeDescription,
            metadata: action.payload as unknown as Prisma.InputJsonValue,
          },
        });
        await logRun(runId, "info", `Approval required: merge PR #${pullNumber} - waiting for human approval`);
        // Notify admin about pending approval
        const { createNotification: createMergeNotification } = await import("@/lib/notifications");
        const mergeAgentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { name: true } });
        const mergeAdminUser = await prisma.user.findFirst({ where: { isAgent: false } });
        if (mergeAdminUser) {
          await createMergeNotification({
            userId: mergeAdminUser.id,
            type: "approval_required",
            title: "Approval Required",
            message: `${mergeAgentUser?.name || "Agent"} wants to merge_pr: ${mergeDescription}`,
            cardId,
          });
        }
      } else {
        // No agentId available, execute directly (legacy path)
        const { mergePullRequest } = await import("@/lib/github");
        await mergePullRequest(repo, pullNumber);
        await logRun(runId, "info", `Merged PR #${pullNumber} in ${repo}`);
      }
      break;
    }

    case "git_branch": {
      const { repo, branchName, fromBranch } = action.payload as {
        repo: string; branchName: string; fromBranch?: string;
      };
      const { createBranch } = await import("@/lib/github");
      await createBranch(repo, branchName, fromBranch || "main");
      await logRun(runId, "info", `Created branch ${branchName} in ${repo}`);
      break;
    }

    case "setup_cicd": {
      const { repo, template } = action.payload as { repo: string; template?: string };
      if (template && template !== "all") {
        const { setupDeployWorkflow } = await import("@/lib/cicd/setup");
        await setupDeployWorkflow(repo, template);
        await logRun(runId, "info", `Set up ${template} deploy workflow for ${repo}`);
      } else {
        const { setupAllCI } = await import("@/lib/cicd/setup");
        const files = await setupAllCI(repo);
        await logRun(runId, "info", `Set up CI/CD for ${repo}: ${files.join(", ")}`);
      }
      break;
    }

    case "save_memory": {
      const { type, content, tags } = action.payload as { type: string; content: string; tags?: string };
      if (agentId) {
        const { saveMemory } = await import("./memory");
        await saveMemory({
          agentId,
          type,
          content,
          source: cardId,
          tags: tags ? tags.split(",").map(t => t.trim()) : [],
        });
        await logRun(runId, "info", `Saved memory: [${type}] ${content.substring(0, 80)}...`);
      } else {
        await logRun(runId, "warn", "Cannot save memory: no agentId available");
      }
      break;
    }

    case "recall_memory": {
      const { query } = action.payload as { query: string };
      if (agentId) {
        const { recallMemories } = await import("./memory");
        const memories = await recallMemories(agentId, query);
        if (memories.length > 0) {
          await logRun(runId, "info", `Recalled ${memories.length} memories for "${query}": ${memories.map(m => m.content.substring(0, 50)).join("; ")}`);
        } else {
          await logRun(runId, "info", `No memories found for "${query}"`);
        }
      } else {
        await logRun(runId, "warn", "Cannot recall memory: no agentId available");
      }
      break;
    }

    case "add_dependency": {
      const { cardId: depCardId, dependsOnId, type: depType } = action.payload as {
        cardId: string;
        dependsOnId: string;
        type?: string;
      };
      await prisma.cardDependency.upsert({
        where: { cardId_dependsOnId: { cardId: depCardId, dependsOnId } },
        create: { cardId: depCardId, dependsOnId, type: depType || "DEPENDS_ON" },
        update: { type: depType || "DEPENDS_ON" },
      });
      await logRun(runId, "info", `Added dependency: card depends on ${dependsOnId} (${depType || "DEPENDS_ON"})`);
      break;
    }

    case "attach_file": {
      const { filename, content: fileContent, fileType } = action.payload as {
        filename: string; content: string; fileType?: string;
      };
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        ts: 'text/typescript', js: 'text/javascript', py: 'text/x-python',
        md: 'text/markdown', txt: 'text/plain', json: 'application/json',
        yaml: 'text/yaml', yml: 'text/yaml', html: 'text/html', css: 'text/css',
        prisma: 'text/plain', sql: 'text/sql', sh: 'text/x-shellscript',
      };
      await prisma.cardAttachment.create({
        data: {
          cardId,
          filename,
          fileType: fileType || (mimeTypes[ext] ? 'code' : 'document'),
          mimeType: mimeTypes[ext] || 'text/plain',
          content: fileContent,
          size: Buffer.byteLength(fileContent, 'utf8'),
          createdBy: agentUserId,
        },
      });
      await logRun(runId, "info", `Attached file: ${filename} (${fileType || 'code'})`);
      break;
    }

    case "review_pr": {
      const { repo, pullNumber } = action.payload as { repo: string; pullNumber: string };
      const { getPRDiff, commentOnPR } = await import("@/lib/github");
      const diff = await getPRDiff(repo, Number(pullNumber));
      // Post the diff summary as a comment
      await commentOnPR(repo, Number(pullNumber), `## AI Code Review\n\nReviewed by Kanban Flux QA Agent.\n\nDiff analyzed: ${diff.split('\n').length} lines changed.`);
      await logRun(runId, "info", `Reviewed PR #${pullNumber} in ${repo}`);
      break;
    }

    case "update_changelog": {
      const { repo, version, entry } = action.payload as { repo: string; version?: string; entry: string };
      const { commitFile } = await import("@/lib/github");
      const dateStr = version || new Date().toISOString().split("T")[0];
      const changelogEntry = `## ${dateStr}\n\n${entry}\n\n`;
      await commitFile(repo, "CHANGELOG.md", changelogEntry, `docs: update changelog - ${dateStr}`);
      await logRun(runId, "info", `Updated CHANGELOG.md in ${repo}`);
      break;
    }

    case "request_help": {
      const { targetRole, request, urgency } = action.payload as { targetRole: string; request: string; urgency?: string };

      // Find the target agent
      const targetAgent = await prisma.agent.findFirst({
        where: { role: targetRole },
        include: { user: { select: { id: true, name: true } } },
      });

      if (targetAgent) {
        // Post a comment on the current card mentioning the request
        await prisma.comment.create({
          data: {
            text: `**Help Request to @${targetAgent.user.name}** (${urgency || "medium"} priority)\n\n${request}`,
            userId: agentUserId,
            cardId,
          },
        });

        // Create a notification for the target agent's "user"
        const { createNotification: createHelpNotification } = await import("@/lib/notifications");
        await createHelpNotification({
          userId: targetAgent.userId,
          type: "help_request",
          title: `Help requested by agent`,
          message: request.substring(0, 100),
          cardId,
        });

        await logRun(runId, "info", `Requested help from ${targetRole}: ${request.substring(0, 80)}`);
      } else {
        await logRun(runId, "warn", `No agent found with role: ${targetRole}`);
      }
      break;
    }

    case "handoff": {
      const { summary, testInstructions, knownIssues, nextSteps } = action.payload as {
        summary: string; testInstructions: string; knownIssues?: string; nextSteps?: string;
      };

      const handoffNote = `## Handoff Note\n\n### What was done\n${summary}\n\n### How to test\n${testInstructions}${knownIssues ? `\n\n### Known issues\n${knownIssues}` : ""}${nextSteps ? `\n\n### Next steps\n${nextSteps}` : ""}`;

      await prisma.comment.create({
        data: { text: handoffNote, userId: agentUserId, cardId },
      });

      await logRun(runId, "info", `Created handoff note: ${summary.substring(0, 80)}`);
      break;
    }

    case "escalate": {
      const { reason, attempts, suggestion } = action.payload as {
        reason: string; attempts?: string; suggestion?: string;
      };

      // Post escalation comment
      await prisma.comment.create({
        data: {
          text: `## Escalation\n\n**Reason:** ${reason}${attempts ? `\n\n**Attempted:** ${attempts}` : ""}${suggestion ? `\n\n**Suggestion:** ${suggestion}` : ""}`,
          userId: agentUserId,
          cardId,
        },
      });

      // Find Master agent and trigger
      const master = await prisma.agent.findFirst({
        where: { role: "master" },
        include: { user: { select: { id: true } } },
      });

      if (master) {
        // Assign Master to card if not already
        await prisma.cardMember.upsert({
          where: { cardId_userId: { cardId, userId: master.userId } },
          create: { cardId, userId: master.userId },
          update: {},
        });

        // Create run for Master
        const masterRun = await prisma.agentRun.create({
          data: { agentId: master.id, cardId, parentRunId: runId, status: "QUEUED" },
        });

        const { enqueueAgentRun: enqueueMasterRun } = await import("./queue");
        await enqueueMasterRun(masterRun.id);

        await logRun(runId, "info", `Escalated to Master: ${reason.substring(0, 80)}`);
      } else {
        await logRun(runId, "warn", "No Master agent found for escalation");
      }
      break;
    }

    default:
      await logRun(runId, "warn", `Unknown action type: ${action.type}`);
  }
}

export async function executeRun(runId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Fetch the run with agent and API key data
    const run = await prisma.agentRun.findUniqueOrThrow({
      where: { id: runId },
      include: {
        agent: {
          include: {
            apiKey: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Update run to RUNNING
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // Update agent status to WORKING
    await prisma.agent.update({
      where: { id: run.agentId },
      data: { status: "WORKING" },
    });

    await logRun(runId, "info", `Starting execution for agent role: ${run.agent.role}`);

    // Decrypt API key
    if (!run.agent.apiKey) {
      throw new Error("Agent has no API key configured");
    }
    const apiKey = decrypt(run.agent.apiKey.encryptedKey, run.agent.apiKey.iv);

    // Build task context
    const context = await buildTaskContext(run.cardId, run.agentId);

    // Check execution mode
    if (run.agent.executionMode === "lumys") {
      await logRun(runId, "info", "Executing via Lumys OS runtime");

      const { executeViaLumys, mapToolsToCapabilities, isLumysAvailable } = await import("./lumys-bridge");

      const available = await isLumysAvailable();
      if (!available) {
        await logRun(runId, "warn", "Lumys OS not available, falling back to BullMQ provider");
        // Fall through to normal execution below
      } else {
        try {
          const taskMessage = `## Task: ${context.card.title}\n\n${context.card.description || ""}\n\n## Board: ${context.card.board.name}\n## Column: ${context.card.column.title}\n\n${context.boardColumns.map(c => `- ${c.title} (${c.id})`).join("\n")}`;

          const capabilities = mapToolsToCapabilities(AGENT_TOOLS_SCHEMA.map(t => t.name));

          const result = await executeViaLumys({
            name: run.agent.user?.name || run.agent.role,
            role: run.agent.role,
            systemPrompt: run.agent.systemPrompt || "",
            model: run.agent.model,
            provider: run.agent.provider,
            capabilities,
          }, taskMessage);

          // Process tool calls from Lumys OS response
          if (result.tool_calls) {
            for (const tc of result.tool_calls) {
              try {
                await applyAction(
                  { type: tc.name as AgentAction["type"], payload: tc.arguments },
                  run.cardId,
                  run.agent.user.id,
                  runId,
                  run.agentId,
                );
              } catch (actionError) {
                await logRun(runId, "error", `Failed action ${tc.name}: ${actionError instanceof Error ? actionError.message : String(actionError)}`);
              }
            }
          }

          // If there's a text response, post as comment
          if (result.response) {
            await prisma.comment.create({
              data: { text: result.response, userId: run.agent.user.id, cardId: run.cardId },
            });
          }

          const tokenUsage = result.usage?.total_tokens || 0;
          const cost = tokenUsage * 0.00000015; // approximate

          await prisma.agentRun.update({
            where: { id: runId },
            data: { status: "COMPLETED", completedAt: new Date(), tokenUsage, cost },
          });

          await logRun(runId, "info", `Lumys OS execution completed. Tokens: ${tokenUsage}`);
          return; // Skip normal execution
        } catch (lumysError) {
          await logRun(runId, "warn", `Lumys OS failed: ${lumysError instanceof Error ? lumysError.message : String(lumysError)}. Falling back to BullMQ.`);
          // Fall through to normal execution
        }
      }
    }

    // Get provider and execute
    const provider = getProvider(run.agent.provider);
    await logRun(runId, "info", `Using provider: ${provider.name}, model: ${run.agent.model}`);

    // Check for timeout
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      throw new Error("Execution timeout exceeded");
    }

    // Check if run was cancelled
    const currentRun = await prisma.agentRun.findUnique({ where: { id: runId } });
    if (currentRun?.status === "CANCELLED") {
      await logRun(runId, "info", "Run was cancelled before execution");
      return;
    }

    let response;
    try {
      response = await provider.execute(context, apiKey);
    } catch (providerError) {
      await logRun(runId, "warn", `Provider ${run.agent.provider} failed, trying fallback...`);

      // Try fallback provider
      const { getProviderFallback } = await import("./smart-router");
      const availableKeys = await prisma.agentApiKey.findMany({ select: { provider: true } });
      const availableProviders = Array.from(new Set(availableKeys.map(k => k.provider)));
      const fallback = getProviderFallback(run.agent.provider, availableProviders);

      if (fallback) {
        const fallbackKeyRecord = await prisma.agentApiKey.findFirst({ where: { provider: fallback.provider as AgentProviderType } });
        if (fallbackKeyRecord) {
          const fallbackKey = decrypt(fallbackKeyRecord.encryptedKey, fallbackKeyRecord.iv);
          const fallbackProvider = getProvider(fallback.provider);
          // Override model in context
          context.agent.model = fallback.model;
          response = await fallbackProvider.execute(context, fallbackKey);
          await logRun(runId, "info", `Fallback to ${fallback.provider}/${fallback.model} succeeded`);
        } else {
          throw providerError; // No fallback available
        }
      } else {
        throw providerError;
      }
    }

    await logRun(runId, "info", `Provider returned ${response.actions.length} actions, ${response.tokenUsage} tokens`);

    // Apply all actions
    for (const action of response.actions) {
      // Check cancellation between actions
      const checkRun = await prisma.agentRun.findUnique({ where: { id: runId } });
      if (checkRun?.status === "CANCELLED") {
        await logRun(runId, "info", "Run cancelled during execution");
        return;
      }

      try {
        await applyAction(action, run.cardId, run.agent.user.id, runId, run.agentId);
      } catch (actionError) {
        await logRun(runId, "error", `Failed to apply action ${action.type}: ${actionError instanceof Error ? actionError.message : String(actionError)}`);
      }

      // Check debug pause
      if (checkRun?.debugMode) {
        const currentDebugRun = await prisma.agentRun.findUnique({ where: { id: runId }, select: { debugPause: true } });
        if (currentDebugRun?.debugPause) {
          await logRun(runId, "debug", "Paused - waiting for resume signal");
          // Wait up to 5 minutes for resume
          let waitTime = 0;
          while (waitTime < 300000) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            waitTime += 3000;
            const check = await prisma.agentRun.findUnique({ where: { id: runId }, select: { debugPause: true, status: true } });
            if (!check?.debugPause || check.status === "CANCELLED") break;
          }
          await logRun(runId, "debug", "Resumed execution");
        }
      }
    }

    // Calculate cost
    const cost = provider.estimateCost(response.tokenUsage, run.agent.model);

    // Mark run as completed
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        tokenUsage: response.tokenUsage,
        cost,
      },
    });

    agentLogger.info("Run completed", { runId, tokens: response.tokenUsage, cost });
    await logRun(runId, "info", `Run completed. Tokens: ${response.tokenUsage}, Cost: $${cost.toFixed(4)}`);

    // Update project budget
    try {
      const cardWithBoard = await prisma.card.findUnique({
        where: { id: run.cardId },
        include: { column: { include: { board: { select: { projectId: true } } } } },
      });
      if (cardWithBoard?.column.board.projectId) {
        await prisma.project.update({
          where: { id: cardWithBoard.column.board.projectId },
          data: { budgetUsed: { increment: cost } },
        });

        // Check if over budget
        const project = await prisma.project.findUnique({
          where: { id: cardWithBoard.column.board.projectId },
          select: { budget: true, budgetUsed: true, name: true },
        });
        if (project?.budget && (project.budgetUsed + cost) > project.budget) {
          await logRun(runId, "warn", `Project "${project.name}" has exceeded its budget ($${project.budgetUsed.toFixed(2)} / $${project.budget.toFixed(2)})`);
        }
      }
    } catch { /* non-critical */ }

    // Fire webhook for agent_completed
    import("@/lib/webhooks").then(({ fireWebhook }) => {
      prisma.card.findUnique({
        where: { id: run.cardId },
        include: { column: { include: { board: { select: { projectId: true } } } } },
      }).then(card => {
        if (card?.column.board.projectId) {
          fireWebhook(card.column.board.projectId, "agent_completed", {
            agent: run.agent.user.name || run.agent.role,
            cardTitle: card.title || run.cardId,
            tokens: response.tokenUsage,
            cost: cost?.toFixed(4),
          });
        }
      });
    }).catch(() => {});

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    agentLogger.error("Run failed", { runId, error: errorMessage });
    await logRun(runId, "error", `Run failed: ${errorMessage}`);

    // Update run to FAILED
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    // Try to post error comment on the card
    try {
      const run = await prisma.agentRun.findUnique({
        where: { id: runId },
        include: { agent: { include: { user: { select: { id: true } } } } },
      });
      if (run) {
        await prisma.comment.create({
          data: {
            text: `[Agent Error] Execution failed: ${errorMessage}`,
            userId: run.agent.user.id,
            cardId: run.cardId,
          },
        });
      }
    } catch {
      // Ignore errors when posting error comment
    }

    // Fire webhook for run_failed
    try {
      const failedRun = await prisma.agentRun.findUnique({
        where: { id: runId },
        include: { agent: { include: { user: { select: { name: true } } } } },
      });
      if (failedRun) {
        const failedCard = await prisma.card.findUnique({
          where: { id: failedRun.cardId },
          include: { column: { include: { board: { select: { projectId: true } } } } },
        });
        if (failedCard?.column.board.projectId) {
          const { fireWebhook } = await import("@/lib/webhooks");
          await fireWebhook(failedCard.column.board.projectId, "run_failed", {
            agent: failedRun.agent.user.name || failedRun.agent.role,
            cardTitle: failedCard.title,
            error: errorMessage,
          });
        }
      }
    } catch {
      // Non-critical webhook error
    }

  } finally {
    // Reset agent status to IDLE if no other active runs
    try {
      const run = await prisma.agentRun.findUnique({ where: { id: runId } });
      if (run) {
        const activeRuns = await prisma.agentRun.count({
          where: {
            agentId: run.agentId,
            status: { in: ["QUEUED", "RUNNING"] },
          },
        });
        if (activeRuns === 0) {
          await prisma.agent.update({
            where: { id: run.agentId },
            data: { status: "IDLE" },
          });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
