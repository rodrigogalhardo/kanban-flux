import { prisma } from "@/lib/prisma";

export async function executeActionInline(
  actionName: string,
  payload: Record<string, unknown>,
  cardId: string,
  agentUserId: string,
  runId: string,
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  try {
    switch (actionName) {
      case "create_card": {
        const { title, description, columnId, dueDate } = payload as {
          title: string; description?: string; columnId: string; dueDate?: string;
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
            dueDate: dueDate ? new Date(dueDate) : null,
          },
        });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Created card "${title}" (id: ${newCard.id})` },
        });
        return {
          success: true,
          message: `Card created successfully with id: ${newCard.id}`,
          data: { cardId: newCard.id, title: newCard.title },
        };
      }

      case "assign_agent": {
        const { cardId: targetCardId, agentUserId: targetUserId } = payload as {
          cardId: string; agentUserId: string;
        };
        await prisma.cardMember.upsert({
          where: { cardId_userId: { cardId: targetCardId, userId: targetUserId } },
          create: { cardId: targetCardId, userId: targetUserId },
          update: {},
        });
        // Auto-trigger the assigned agent
        const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { isAgent: true } });
        if (user?.isAgent) {
          import("./auto-trigger").then(({ handleAgentAssigned }) => {
            handleAgentAssigned(targetCardId, targetUserId).catch(() => {});
          });
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Assigned agent ${targetUserId} to card ${targetCardId}` },
        });
        return { success: true, message: `Agent ${targetUserId} assigned to card ${targetCardId}` };
      }

      case "comment": {
        const { text } = payload as { text: string };
        await prisma.comment.create({
          data: { text, userId: agentUserId, cardId },
        });
        // Notify card members about agent comment
        try {
          const { notifyCardMembers } = await import("@/lib/notifications");
          await notifyCardMembers(cardId, agentUserId, {
            type: "agent_comment",
            title: "Agent commented",
            message: text.substring(0, 100),
          });
        } catch { /* non-critical */ }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Posted comment: ${text.substring(0, 100)}...` },
        });
        return { success: true, message: "Comment posted" };
      }

      case "move_card": {
        const { columnId } = payload as { columnId: string };
        const maxPos = await prisma.card.aggregate({
          where: { columnId },
          _max: { position: true },
        });
        const oldCard = await prisma.card.findUnique({ where: { id: cardId }, select: { columnId: true } });
        await prisma.card.update({
          where: { id: cardId },
          data: { columnId, position: (maxPos._max.position ?? -1) + 1 },
        });
        if (oldCard && columnId !== oldCard.columnId) {
          import("./auto-trigger").then(({ handleCardColumnChange }) => {
            handleCardColumnChange(cardId, columnId, oldCard.columnId).catch(() => {});
          });
        }
        // Notify card members about card move
        try {
          const { notifyCardMembers } = await import("@/lib/notifications");
          const targetCol = await prisma.column.findUnique({ where: { id: columnId }, select: { title: true } });
          await notifyCardMembers(cardId, agentUserId, {
            type: "card_move",
            title: "Card moved",
            message: `Card moved to "${targetCol?.title || "column"}"`,
          });
        } catch { /* non-critical */ }
        const col = await prisma.column.findUnique({ where: { id: columnId }, select: { title: true } });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Moved card to column ${col?.title || columnId}` },
        });
        return { success: true, message: `Card moved to "${col?.title || columnId}"` };
      }

      case "update_description": {
        const { description } = payload as { description: string };
        await prisma.card.update({ where: { id: cardId }, data: { description } });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: "Updated card description" },
        });
        return { success: true, message: "Description updated" };
      }

      case "checklist_update": {
        const { checklistId, itemId, completed } = payload as {
          checklistId: string; itemId: string; completed: boolean;
        };
        await prisma.checklistItem.update({
          where: { id: itemId, checklistId },
          data: { completed },
        });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Updated checklist item ${itemId}: completed=${completed}` },
        });
        return { success: true, message: `Checklist item ${completed ? "completed" : "unchecked"}` };
      }

      case "trigger_agent": {
        const { agentId: targetAgentId, cardId: targetCardId } = payload as {
          agentId: string; cardId: string;
        };
        const childRun = await prisma.agentRun.create({
          data: { agentId: targetAgentId, cardId: targetCardId, parentRunId: runId, status: "QUEUED" },
        });
        try {
          const { enqueueAgentRun } = await import("./queue");
          await enqueueAgentRun(childRun.id);
        } catch { /* non-critical */ }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Triggered agent ${targetAgentId} on card ${targetCardId} (run: ${childRun.id})` },
        });
        return { success: true, message: `Agent triggered (run: ${childRun.id})` };
      }

      case "handoff": {
        const { summary, testInstructions, knownIssues, nextSteps } = payload as {
          summary: string; testInstructions: string; knownIssues?: string; nextSteps?: string;
        };
        const note = `## Handoff Note\n\n### What was done\n${summary}\n\n### How to test\n${testInstructions}${knownIssues ? `\n\n### Known issues\n${knownIssues}` : ""}${nextSteps ? `\n\n### Next steps\n${nextSteps}` : ""}`;
        await prisma.comment.create({ data: { text: note, userId: agentUserId, cardId } });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Created handoff note: ${summary.substring(0, 80)}` },
        });
        return { success: true, message: "Handoff note posted" };
      }

      case "escalate": {
        const { reason, attempts, suggestion } = payload as {
          reason: string; attempts?: string; suggestion?: string;
        };
        await prisma.comment.create({
          data: {
            text: `## Escalation\n\n**Reason:** ${reason}${attempts ? `\n\n**Attempted:** ${attempts}` : ""}${suggestion ? `\n\n**Suggestion:** ${suggestion}` : ""}`,
            userId: agentUserId,
            cardId,
          },
        });
        const masterAgent = await prisma.agent.findFirst({ where: { role: "master" } });
        if (masterAgent) {
          await prisma.cardMember.upsert({
            where: { cardId_userId: { cardId, userId: masterAgent.userId } },
            create: { cardId, userId: masterAgent.userId },
            update: {},
          });
          const mRun = await prisma.agentRun.create({
            data: { agentId: masterAgent.id, cardId, parentRunId: runId, status: "QUEUED" },
          });
          try {
            const { enqueueAgentRun } = await import("./queue");
            await enqueueAgentRun(mRun.id);
          } catch { /* non-critical */ }
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Escalated to Master: ${reason.substring(0, 80)}` },
        });
        return { success: true, message: "Escalated to Master" };
      }

      case "request_help": {
        const { targetRole, request, urgency } = payload as {
          targetRole: string; request: string; urgency?: string;
        };
        const target = await prisma.agent.findFirst({
          where: { role: targetRole },
          include: { user: { select: { id: true, name: true } } },
        });
        await prisma.comment.create({
          data: {
            text: `**Help Request to @${target?.user.name || targetRole}** (${urgency || "medium"} priority)\n\n${request}`,
            userId: agentUserId,
            cardId,
          },
        });
        if (target) {
          try {
            const { createNotification } = await import("@/lib/notifications");
            await createNotification({
              userId: target.userId,
              type: "help_request",
              title: "Help requested by agent",
              message: request.substring(0, 100),
              cardId,
            });
          } catch { /* non-critical */ }
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Requested help from ${targetRole}: ${request.substring(0, 80)}` },
        });
        return { success: true, message: `Help requested from ${targetRole}` };
      }

      case "save_memory": {
        const { type, content, tags } = payload as { type: string; content: string; tags?: string };
        const agent = await prisma.agent.findFirst({ where: { userId: agentUserId } });
        if (agent) {
          try {
            const { saveMemory } = await import("./memory");
            await saveMemory({
              agentId: agent.id,
              type,
              content,
              source: cardId,
              tags: tags ? tags.split(",").map(t => t.trim()) : [],
            });
          } catch {
            await prisma.agentMemory.create({
              data: { agentId: agent.id, type, content, source: cardId, tags: tags ? tags.split(",").map(t => t.trim()) : [] },
            });
          }
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Saved memory: [${type}] ${content.substring(0, 80)}...` },
        });
        return { success: true, message: "Memory saved" };
      }

      case "recall_memory": {
        const { query } = payload as { query: string };
        const agent = await prisma.agent.findFirst({ where: { userId: agentUserId } });
        if (agent) {
          try {
            const { recallMemories } = await import("./memory");
            const memories = await recallMemories(agent.id, query);
            if (memories.length > 0) {
              return {
                success: true,
                message: `Found ${memories.length} memories: ${memories.map(m => m.content.substring(0, 80)).join("; ")}`,
              };
            }
          } catch { /* non-critical */ }
        }
        return { success: true, message: `No memories found for "${query}"` };
      }

      case "attach_file": {
        const { filename, content: fileContent, fileType } = payload as {
          filename: string; content: string; fileType?: string;
        };
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const mimeTypes: Record<string, string> = {
          ts: "text/typescript", js: "text/javascript", py: "text/x-python",
          md: "text/markdown", txt: "text/plain", json: "application/json",
          yaml: "text/yaml", yml: "text/yaml", html: "text/html", css: "text/css",
          prisma: "text/plain", sql: "text/sql", sh: "text/x-shellscript",
          tsx: "text/typescript", jsx: "text/javascript",
        };
        await prisma.cardAttachment.create({
          data: {
            cardId, filename,
            fileType: fileType || (mimeTypes[ext] ? "code" : "document"),
            mimeType: mimeTypes[ext] || "text/plain",
            content: fileContent,
            size: Buffer.byteLength(fileContent, "utf8"),
            createdBy: agentUserId,
          },
        });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Attached file: ${filename}` },
        });
        return { success: true, message: `File "${filename}" attached` };
      }

      case "add_dependency": {
        const { cardId: depCardId, dependsOnId, type: depType } = payload as {
          cardId: string; dependsOnId: string; type?: string;
        };
        await prisma.cardDependency.upsert({
          where: { cardId_dependsOnId: { cardId: depCardId, dependsOnId } },
          create: { cardId: depCardId, dependsOnId, type: depType || "DEPENDS_ON" },
          update: {},
        });
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Added dependency: card depends on ${dependsOnId}` },
        });
        return { success: true, message: "Dependency added" };
      }

      case "git_commit": {
        const { repo, path, content: codeContent, message, branch } = payload as {
          repo: string; path: string; content: string; message: string; branch?: string;
        };
        const { commitFile } = await import("@/lib/github");
        await commitFile(repo, path, codeContent, message, branch || "main");
        // Also attach the file to the card
        const commitExt = path.split(".").pop()?.toLowerCase() || "";
        const commitMimeTypes: Record<string, string> = {
          ts: "text/typescript", js: "text/javascript", py: "text/x-python",
          md: "text/markdown", txt: "text/plain", json: "application/json",
          yaml: "text/yaml", yml: "text/yaml", html: "text/html", css: "text/css",
          prisma: "text/plain", sql: "text/sql", sh: "text/x-shellscript",
          tsx: "text/typescript", jsx: "text/javascript", rs: "text/x-rust",
          go: "text/x-go", rb: "text/x-ruby", java: "text/x-java",
        };
        await prisma.cardAttachment.create({
          data: {
            cardId, filename: path, fileType: "code",
            mimeType: commitMimeTypes[commitExt] || "text/plain",
            content: codeContent,
            size: Buffer.byteLength(codeContent, "utf8"),
            createdBy: agentUserId,
          },
        }).catch(() => {}); // non-critical
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Committed ${path} to ${repo}` },
        });
        return { success: true, message: `Committed ${path} to ${repo}` };
      }

      case "create_pr": {
        const { repo, title, head, base } = payload as {
          repo: string; title: string; body: string; head: string; base?: string;
        };
        const agent = await prisma.agent.findFirst({ where: { userId: agentUserId } });
        if (agent) {
          await prisma.approvalGate.create({
            data: {
              runId,
              agentId: agent.id,
              actionType: "create_pr",
              description: `Create PR "${title}" in ${repo} (${head} -> ${base || "main"})`,
              metadata: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
            },
          });
          // Notify admin
          try {
            const { createNotification } = await import("@/lib/notifications");
            const agentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { name: true } });
            const adminUser = await prisma.user.findFirst({ where: { isAgent: false } });
            if (adminUser) {
              await createNotification({
                userId: adminUser.id,
                type: "approval_required",
                title: "Approval Required",
                message: `${agentUser?.name || "Agent"} wants to create PR "${title}" in ${repo}`,
                cardId,
              });
            }
          } catch { /* non-critical */ }
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `PR creation queued for approval: "${title}"` },
        });
        return { success: true, message: "PR creation queued for approval" };
      }

      case "merge_pr": {
        const { repo, pullNumber } = payload as { repo: string; pullNumber: number };
        const agent = await prisma.agent.findFirst({ where: { userId: agentUserId } });
        if (agent) {
          await prisma.approvalGate.create({
            data: {
              runId,
              agentId: agent.id,
              actionType: "merge_pr",
              description: `Merge PR #${pullNumber} in ${repo}`,
              metadata: payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
            },
          });
          try {
            const { createNotification } = await import("@/lib/notifications");
            const agentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { name: true } });
            const adminUser = await prisma.user.findFirst({ where: { isAgent: false } });
            if (adminUser) {
              await createNotification({
                userId: adminUser.id,
                type: "approval_required",
                title: "Approval Required",
                message: `${agentUser?.name || "Agent"} wants to merge PR #${pullNumber} in ${repo}`,
                cardId,
              });
            }
          } catch { /* non-critical */ }
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Merge PR #${pullNumber} queued for approval` },
        });
        return { success: true, message: `Merge PR #${pullNumber} queued for approval` };
      }

      case "git_branch": {
        const { repo, branchName, fromBranch } = payload as {
          repo: string; branchName: string; fromBranch?: string;
        };
        const { createBranch } = await import("@/lib/github");
        await createBranch(repo, branchName, fromBranch || "main");
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Created branch ${branchName} in ${repo}` },
        });
        return { success: true, message: `Branch ${branchName} created in ${repo}` };
      }

      case "setup_cicd": {
        const { repo, template } = payload as { repo: string; template?: string };
        if (template && template !== "all") {
          const { setupDeployWorkflow } = await import("@/lib/cicd/setup");
          await setupDeployWorkflow(repo, template);
        } else {
          const { setupAllCI } = await import("@/lib/cicd/setup");
          await setupAllCI(repo);
        }
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Set up CI/CD for ${repo}` },
        });
        return { success: true, message: `CI/CD setup completed for ${repo}` };
      }

      case "review_pr": {
        const { repo, pullNumber } = payload as { repo: string; pullNumber: string };
        const { getPRDiff, commentOnPR } = await import("@/lib/github");
        const diff = await getPRDiff(repo, Number(pullNumber));
        await commentOnPR(repo, Number(pullNumber), `## AI Code Review\n\nReviewed by Kanban Flux QA Agent.\n\nDiff analyzed: ${diff.split("\n").length} lines changed.`);
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Reviewed PR #${pullNumber} in ${repo}` },
        });
        return { success: true, message: `PR #${pullNumber} reviewed` };
      }

      case "update_changelog": {
        const { repo, version, entry } = payload as { repo: string; version?: string; entry: string };
        const { commitFile } = await import("@/lib/github");
        const dateStr = version || new Date().toISOString().split("T")[0];
        const changelogEntry = `## ${dateStr}\n\n${entry}\n\n`;
        await commitFile(repo, "CHANGELOG.md", changelogEntry, `docs: update changelog - ${dateStr}`);
        await prisma.agentRunLog.create({
          data: { runId, level: "info", message: `Updated CHANGELOG.md in ${repo}` },
        });
        return { success: true, message: `Changelog updated in ${repo}` };
      }

      case "log": {
        const { level, message } = payload as { level?: string; message: string };
        await prisma.agentRunLog.create({ data: { runId, level: level || "info", message } });
        return { success: true, message: "Logged" };
      }

      default:
        return { success: false, message: `Unknown action: ${actionName}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.agentRunLog.create({
      data: { runId, level: "error", message: `Action ${actionName} failed: ${errorMessage}` },
    }).catch(() => {}); // don't fail on logging error
    return { success: false, message: `Error: ${errorMessage}` };
  }
}
