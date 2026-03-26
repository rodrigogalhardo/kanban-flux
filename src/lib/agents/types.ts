export interface AgentTaskContext {
  card: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    column: { id: string; title: string };
    board: { id: string; name: string; description: string | null };
    checklists: {
      id: string;
      title: string;
      items: { id: string; text: string; completed: boolean }[];
    }[];
    comments: { user: string; text: string; createdAt: Date }[];
    labels: { name: string; color: string }[];
    members: { id: string; name: string; isAgent: boolean }[];
  };
  agent: {
    id: string;
    userId: string;
    role: string;
    systemPrompt: string | null;
    capabilities: string[];
    model: string;
  };
  team: {
    availableAgents: {
      id: string;
      userId: string;
      role: string;
      capabilities: string[];
      status: string;
    }[];
  };
  boardColumns: { id: string; title: string; position: number }[];
  project?: {
    id: string;
    name: string;
    githubRepo: string | null;
  };
  memories?: { type: string; content: string; tags: string[] }[];
}

export type AgentActionType =
  | "comment"
  | "checklist_update"
  | "move_card"
  | "update_description"
  | "create_card"
  | "assign_agent"
  | "trigger_agent"
  | "log"
  | "git_commit"
  | "create_pr"
  | "merge_pr"
  | "git_branch"
  | "setup_cicd"
  | "save_memory"
  | "recall_memory"
  | "add_dependency"
  | "attach_file"
  | "review_pr"
  | "update_changelog"
  | "request_help"
  | "handoff"
  | "escalate";

export interface AgentAction {
  type: AgentActionType;
  payload: Record<string, unknown>;
}

export interface ProviderResponse {
  content: string;
  actions: AgentAction[];
  tokenUsage: number;
  done: boolean;
}

export interface AgentProvider {
  name: string;
  execute(context: AgentTaskContext, apiKey: string): Promise<ProviderResponse>;
  validateKey(apiKey: string): Promise<boolean>;
  estimateCost(tokenUsage: number, model: string): number;
}

export const AGENT_TOOLS_SCHEMA = [
  {
    name: "comment",
    description: "Post a comment on the current card to report progress or findings",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The comment text to post" },
      },
      required: ["text"],
    },
  },
  {
    name: "checklist_update",
    description: "Mark a checklist item as completed",
    parameters: {
      type: "object",
      properties: {
        checklistId: { type: "string", description: "The checklist ID" },
        itemId: { type: "string", description: "The checklist item ID" },
        completed: { type: "boolean", description: "Whether the item is completed" },
      },
      required: ["checklistId", "itemId", "completed"],
    },
  },
  {
    name: "move_card",
    description: "Move the current card to a different column (e.g., from 'To Do' to 'In Progress' or 'Done')",
    parameters: {
      type: "object",
      properties: {
        columnId: { type: "string", description: "The target column ID" },
      },
      required: ["columnId"],
    },
  },
  {
    name: "update_description",
    description: "Update the card's description with analysis, requirements, or results",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "The new description text" },
      },
      required: ["description"],
    },
  },
  {
    name: "create_card",
    description: "Create a new sub-task card in a column (used by Analyst/Master to decompose work)",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "The card title" },
        description: { type: "string", description: "The card description with requirements" },
        columnId: { type: "string", description: "The column to create the card in" },
      },
      required: ["title", "columnId"],
    },
  },
  {
    name: "assign_agent",
    description: "Assign an AI agent to a card (used by Analyst/Master to delegate work)",
    parameters: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The card to assign the agent to" },
        agentUserId: { type: "string", description: "The agent's user ID" },
      },
      required: ["cardId", "agentUserId"],
    },
  },
  {
    name: "trigger_agent",
    description: "Start an agent's execution on a specific card",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "The agent ID to trigger" },
        cardId: { type: "string", description: "The card for the agent to work on" },
      },
      required: ["agentId", "cardId"],
    },
  },
  {
    name: "log",
    description: "Log a message for debugging or status tracking",
    parameters: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["info", "warn", "error", "debug"] },
        message: { type: "string", description: "The log message" },
      },
      required: ["message"],
    },
  },
  {
    name: "git_commit",
    description: "Commit a file to a GitHub repository",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name (without org prefix)" },
        path: { type: "string", description: "File path in the repo" },
        content: { type: "string", description: "File content" },
        message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Branch name (default: main)" },
      },
      required: ["repo", "path", "content", "message"],
    },
  },
  {
    name: "create_pr",
    description: "Create a pull request on a GitHub repository",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name" },
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR description" },
        head: { type: "string", description: "Source branch" },
        base: { type: "string", description: "Target branch (default: main)" },
      },
      required: ["repo", "title", "body", "head"],
    },
  },
  {
    name: "merge_pr",
    description: "Merge a pull request",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name" },
        pullNumber: { type: "string", description: "PR number" },
      },
      required: ["repo", "pullNumber"],
    },
  },
  {
    name: "git_branch",
    description: "Create a new branch in a GitHub repository",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name" },
        branchName: { type: "string", description: "New branch name" },
        fromBranch: { type: "string", description: "Base branch (default: main)" },
      },
      required: ["repo", "branchName"],
    },
  },
  {
    name: "setup_cicd",
    description: "Setup CI/CD pipelines for a project's GitHub repository. Creates GitHub Actions workflows for CI (build+test) and deployment templates (Railway, AWS, GCP).",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name (without org prefix)" },
        template: { type: "string", description: "Deploy template: 'all', 'railway', 'aws', or 'gcp'" },
      },
      required: ["repo"],
    },
  },
  {
    name: "save_memory",
    description: "Save something to your persistent memory for future reference. Use this to remember decisions, patterns, lessons learned, or important context.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Memory type: decision, code_pattern, lesson, preference, context" },
        content: { type: "string", description: "What to remember" },
        tags: { type: "string", description: "Comma-separated tags for categorization" },
      },
      required: ["type", "content"],
    },
  },
  {
    name: "recall_memory",
    description: "Search your persistent memory for relevant past experiences, decisions, or patterns.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for in memory" },
      },
      required: ["query"],
    },
  },
  {
    name: "add_dependency",
    description: "Add a dependency between two cards. Use this when tasks are related or one depends on another.",
    parameters: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The card that depends on another" },
        dependsOnId: { type: "string", description: "The card it depends on" },
        type: { type: "string", description: "Dependency type: DEPENDS_ON, BLOCKS, or RELATED" },
      },
      required: ["cardId", "dependsOnId"],
    },
  },
  {
    name: "attach_file",
    description: "Attach a file to the current card. Use for code files, documents, diagrams, or any artifact.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "File name with extension (e.g., 'schema.prisma', 'architecture.md')" },
        content: { type: "string", description: "File content (text)" },
        fileType: { type: "string", description: "Type: code, document, image, diagram" },
      },
      required: ["filename", "content"],
    },
  },
  {
    name: "review_pr",
    description: "Review code changes in a GitHub Pull Request. Reads the PR diff and provides code review feedback as a PR comment.",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name" },
        pullNumber: { type: "string", description: "PR number to review" },
      },
      required: ["repo", "pullNumber"],
    },
  },
  {
    name: "update_changelog",
    description: "Add an entry to the project's CHANGELOG.md in the GitHub repository",
    parameters: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository name" },
        version: { type: "string", description: "Version or date string" },
        entry: { type: "string", description: "Changelog entry in markdown" },
      },
      required: ["repo", "entry"],
    },
  },
  {
    name: "request_help",
    description: "Request help from another agent by posting a comment on their card or creating a linked request. Use when you need input from another specialist.",
    parameters: {
      type: "object",
      properties: {
        targetRole: { type: "string", description: "Role of the agent to request help from (e.g., 'dba', 'architect', 'frontend')" },
        request: { type: "string", description: "What you need help with" },
        urgency: { type: "string", description: "low, medium, or high" },
      },
      required: ["targetRole", "request"],
    },
  },
  {
    name: "handoff",
    description: "Create a structured handoff note when passing work to the next agent (e.g., dev to QA). Documents what was done, how to test, and any known issues.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "What was accomplished" },
        testInstructions: { type: "string", description: "How to test/verify the work" },
        knownIssues: { type: "string", description: "Any known issues or limitations" },
        nextSteps: { type: "string", description: "Suggested next steps for the receiving agent" },
      },
      required: ["summary", "testInstructions"],
    },
  },
  {
    name: "escalate",
    description: "Escalate an issue to the Master Orchestrator when you cannot resolve it yourself. The Master will decide how to proceed.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why you're escalating" },
        attempts: { type: "string", description: "What you already tried" },
        suggestion: { type: "string", description: "Your suggested resolution" },
      },
      required: ["reason"],
    },
  },
];
