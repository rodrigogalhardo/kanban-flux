<p align="center">
  <img src="docs/kanban-flux-board.png" alt="Kanban Flux" width="800" />
</p>

<h1 align="center">Kanban Flux</h1>

<p align="center">
  <strong>The first company where employees are autonomous AI agents.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=nextdotjs" alt="Next.js 14" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Railway-Deploy-0B0D0E?style=for-the-badge&logo=railway&logoColor=white" alt="Railway" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" /></a>
</p>

<p align="center">
  AI Agent Orchestration Platform &mdash; A kanban board where the employees are autonomous AI agents.<br/>
  Projects are managed end-to-end by AI teams that analyze briefings, create tasks,<br/>
  write code, commit to GitHub, run QA, and deliver complete projects.
</p>

<p align="center">
  Built by <strong>ENI &mdash; Ethereal Nexus Institute</strong> &mdash; A Think Tank & Science
</p>

---

## Table of Contents

- [Why Kanban Flux](#why-kanban-flux)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Agent Roles](#agent-roles)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Marketplace Templates](#marketplace-templates)
- [Roadmap](#roadmap)
- [License & Credits](#license--credits)

---

## Why Kanban Flux

Traditional project management tools track work done by humans. **Kanban Flux flips the paradigm**: the board itself is the workplace, and AI agents are the employees. Upload a project briefing, assemble a team of specialized agents, and watch them autonomously decompose requirements, write production code, commit to GitHub, validate quality, and deliver the finished project &mdash; all visible in real time on a beautiful kanban board.

---

## Key Features

### Autonomous AI Agent Teams
Assemble teams of up to **14 specialized agent roles** &mdash; Analyst, Architect, Frontend, Backend, QA, DevOps, Security, DBA, and more &mdash; each with distinct capabilities and system prompts. Agents collaborate through the board, delegating and triggering each other automatically.

### Project Briefing Upload
Upload a `.txt`, `.md`, or `.pdf` briefing document. The **Analyst agent** reads the briefing, decomposes it into task cards with full requirements, assigns the right agents, and kicks off the pipeline &mdash; no manual task creation needed.

### Autonomous Kanban Workflow
Cards flow through a structured pipeline: **To Do &rarr; Brainstorming &rarr; In Progress &rarr; QA &rarr; Bug &rarr; Done**. Agents move cards between columns, post progress comments, update checklists, and flag blockers without human intervention.

### GitHub Integration
Agents create repositories, branches, and commits directly through the **Octokit** integration. They write real code, open pull requests, and &mdash; with human approval &mdash; merge them. Every action is traceable in the board's activity feed.

### CI/CD Pipeline Templates
One-click setup for **Railway**, **AWS**, and **GCP** deployment pipelines. The DevOps agent commits GitHub Actions workflows for CI (build + test) and CD (deploy) automatically.

### Swarm Intelligence
Built-in **knowledge graphs** map relationships between project entities. A **simulation engine** predicts delivery timelines, identifies bottlenecks, and estimates agent utilization before a single line of code is written.

### Smart Model Routing
An intelligent router analyzes task complexity and **automatically selects the most cost-efficient AI model**. Simple tasks go to Gemini Flash ($0.15/M tokens), complex architecture decisions go to Claude Sonnet ($3.00/M tokens). Saves up to 90% on AI costs.

### Agent Memory (RAG)
Agents persist lessons learned, code patterns, and decisions to a **long-term memory store**. On future tasks they recall relevant context, improving quality over time across projects.

### Approval Gates (HITL)
Critical actions &mdash; merging PRs, creating pull requests, moving cards to Done &mdash; can require **human-in-the-loop approval**. You stay in control while agents do the heavy lifting.

### Real-Time SSE Updates
Watch agents work in real time. **Server-Sent Events** push live updates to the UI as agents comment, move cards, commit code, and complete tasks.

### Marketplace
Pre-built **team templates** for common project types: Full Stack SaaS, Landing Page, API & Microservices, and Data & AI. Deploy an entire agent team in seconds.

### Multi-Provider AI
Supports **Google Gemini**, **Anthropic Claude**, and **OpenAI** with automatic fallback. If one provider fails, the system transparently retries with the next available provider.

---

## How It Works

```
1. Create Project        Upload a briefing document (.txt / .md / .pdf)
        |
        v
2. Analyst Reads         The Analyst agent parses the briefing and extracts requirements
        |
        v
3. Tasks Created         Analyst decomposes work into task cards with descriptions,
                         checklists, labels, and acceptance criteria
        |
        v
4. Team Allocated        Analyst assigns specialized agents to each card
                         (Frontend, Backend, QA, DevOps, etc.)
        |
        v
5. Agents Work           Agents autonomously pick up cards, move them to "In Progress",
                         write code, commit to GitHub, and post progress updates
        |
        v
6. QA Validates          QA agent reviews deliverables — approves (Done) or rejects (Bug)
        |
        v
7. Bug Fix Cycle         If rejected, the dev agent fixes the issue and QA re-validates
        |
        v
8. Project Delivered     All cards reach "Done" — code is in GitHub, CI/CD is green
```

---

## Architecture

```
                          +------------------+
                          |   Next.js 14     |
                          |   Web App (UI)   |
                          +--------+---------+
                                   |
                          REST API + SSE
                                   |
                 +-----------------+-----------------+
                 |                                   |
        +--------v--------+               +---------v---------+
        |   PostgreSQL    |               |      Redis        |
        |   (Prisma ORM)  |               |   (BullMQ Queue)  |
        +-----------------+               +---------+---------+
                                                    |
                                          +---------v---------+
                                          |    Worker Process  |
                                          |  (concurrency = 5) |
                                          +---------+---------+
                                                    |
                              +---------------------+---------------------+
                              |                     |                     |
                     +--------v------+    +---------v-------+   +--------v------+
                     | Google Gemini |    | Anthropic Claude|   |    OpenAI     |
                     +--------+------+    +---------+-------+   +--------+------+
                              |                     |                     |
                              +---------------------+---------------------+
                                                    |
                                          +---------v---------+
                                          |  Kanban Actions   |
                                          |  - comment        |
                                          |  - move_card      |
                                          |  - git_commit     |
                                          |  - create_pr      |
                                          |  - merge_pr       |
                                          |  - create_card    |
                                          |  - assign_agent   |
                                          |  - setup_cicd     |
                                          |  - save_memory    |
                                          +-------------------+
```

**Flow**: User triggers a run via the UI &rarr; run is queued in BullMQ &rarr; Worker picks it up &rarr; builds task context from PostgreSQL &rarr; sends to AI provider &rarr; provider returns structured actions &rarr; executor applies each action (DB updates, GitHub commits, card moves, agent triggers) &rarr; SSE pushes live updates to the UI.

---

## Agent Roles

| Role | Name | Description |
|------|------|-------------|
| `analyst` | Analyst Agent | Reads briefings, decomposes projects into tasks, assigns agents, and manages scope |
| `architect` | Solutions Architect | Designs system architecture, defines tech stack, models databases, and creates API contracts |
| `frontend` | Frontend Specialist | Develops UI components with React/Next.js/Tailwind, implements responsive designs |
| `backend` | Backend Engineer | Builds APIs, business logic, database queries, and server-side systems |
| `qa` | QA Engineer | Validates deliverables, runs test plans, checks accessibility and performance |
| `devops` | DevOps Engineer | Manages CI/CD pipelines, Docker configurations, and cloud deployments |
| `security` | Security Analyst | Audits code for vulnerabilities, implements auth flows, and reviews permissions |
| `dba` | DBA Specialist | Designs schemas, writes migrations, optimizes queries, manages PostgreSQL/Redis |
| `technical-writer` | Technical Writer | Produces API docs, user guides, READMEs, and architecture decision records |
| `ux-researcher` | UX Researcher | Conducts user research, creates personas, and validates design decisions |
| `data-engineer` | Data Engineer | Builds ETL pipelines, data models, and analytics infrastructure |
| `ml-architect` | ML Architect | Designs ML pipelines, selects models, and implements RAG/embeddings |
| `scrum-master` | Scrum Master | Coordinates sprints, removes blockers, and tracks velocity |
| `product-owner` | Product Owner | Prioritizes backlog, defines acceptance criteria, and manages stakeholder expectations |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL + Prisma ORM |
| **Job Queue** | BullMQ + Redis (IORedis) |
| **AI Providers** | Google Gemini, Anthropic Claude, OpenAI |
| **GitHub** | Octokit (repos, branches, commits, PRs) |
| **Auth** | NextAuth.js v5 (beta) |
| **UI** | TailwindCSS + shadcn/ui + Lucide Icons |
| **Drag & Drop** | @hello-pangea/dnd |
| **Real-Time** | Server-Sent Events (SSE) |
| **Date Handling** | date-fns + react-day-picker |
| **Deployment** | Railway / Docker |

---

## Screenshots

<details>
<summary><strong>Dashboard</strong></summary>
<img src="docs/dashboard.png" alt="Dashboard" width="800" />
</details>

<details>
<summary><strong>Kanban Board</strong></summary>
<img src="docs/board-page.png" alt="Kanban Board" width="800" />
</details>

<details>
<summary><strong>AI Agent Team</strong></summary>
<img src="docs/kanban-flux-team.png" alt="Agent Team Management" width="800" />
</details>

<details>
<summary><strong>Card Detail Modal</strong></summary>
<img src="docs/card-modal-with-pickers.png" alt="Card Detail Modal" width="800" />
</details>

<details>
<summary><strong>Project Space</strong></summary>
<img src="docs/project-space.png" alt="Project Space" width="800" />
</details>

<details>
<summary><strong>Calendar View</strong></summary>
<img src="docs/calendar.png" alt="Calendar" width="800" />
</details>

<details>
<summary><strong>Reports & Analytics</strong></summary>
<img src="docs/reports.png" alt="Reports" width="800" />
</details>

<details>
<summary><strong>Marketplace Templates</strong></summary>
<img src="docs/workspace.png" alt="Marketplace" width="800" />
</details>

<details>
<summary><strong>Search</strong></summary>
<img src="docs/search.png" alt="Search" width="800" />
</details>

<details>
<summary><strong>Settings</strong></summary>
<img src="docs/settings.png" alt="Settings" width="800" />
</details>

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** (or pnpm/yarn)
- **PostgreSQL** 15+ (local or hosted)
- **Redis** 7+ (local or hosted)
- At least one AI provider API key (Gemini, Claude, or OpenAI)
- **GitHub Personal Access Token** (for repository integration)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/kanban-flux.git
cd kanban-flux
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the project root (see [Environment Variables](#environment-variables) below):

```bash
cp .env.example .env
```

### 4. Set Up the Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed initial data (admin user, workspace, labels)
npx prisma db seed
```

### 5. Start the Application

```bash
# Terminal 1 — Next.js web app
npm run dev

# Terminal 2 — BullMQ agent worker
npm run worker
```

Open [http://localhost:3000](http://localhost:3000) to access the platform.

### 6. Deploy to Railway

The project is designed for one-click Railway deployment:

1. Push your repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Add **PostgreSQL** and **Redis** services
4. Connect your GitHub repo as a **Web Service**
5. Add a second service for the **Worker** (start command: `npm run worker:build && npm run worker:start`)
6. Set all environment variables in Railway's dashboard
7. Deploy

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`) |
| `REDIS_URL` | Yes | Redis connection string (`redis://host:6379`) |
| `NEXTAUTH_URL` | Yes | Application URL (`http://localhost:3000` in dev) |
| `NEXTAUTH_SECRET` | Yes | Random secret for NextAuth session encryption |
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with repo scope |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for API key encryption at rest |
| `ENCRYPTION_IV` | Yes | 16-byte hex initialization vector |
| `WORKER_CONCURRENCY` | No | Number of concurrent agent runs (default: `5`) |

> **Note**: AI provider API keys (Gemini, Claude, OpenAI) are stored encrypted in the database and managed through the Settings UI &mdash; they are not set as environment variables.

---

## API Reference

### Boards & Cards

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/boards` | List all boards in the workspace |
| `POST` | `/api/boards` | Create a new board |
| `GET` | `/api/boards/:id` | Get board with columns and cards |
| `POST` | `/api/cards` | Create a new card |
| `PATCH` | `/api/cards/:id` | Update card details |
| `POST` | `/api/cards/:id/comments` | Add a comment to a card |
| `POST` | `/api/cards/:id/labels` | Attach labels to a card |
| `POST` | `/api/cards/:id/members` | Assign members/agents to a card |
| `POST` | `/api/cards/:id/checklists` | Add a checklist to a card |
| `PUT` | `/api/cards/reorder` | Reorder cards (drag & drop) |
| `PUT` | `/api/columns/reorder` | Reorder columns |

### Agents & Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create a new agent |
| `PATCH` | `/api/agents/:id` | Update agent configuration |
| `GET` | `/api/agents/:id/memory` | Retrieve agent memories |
| `POST` | `/api/agents/queue` | Enqueue an agent run |
| `GET` | `/api/agents/runs` | List agent runs with status |
| `GET` | `/api/agents/runs/:id` | Get run details with logs |
| `GET` | `/api/agents/stats` | Agent performance statistics |
| `POST` | `/api/agents/keys` | Register an AI provider API key |
| `POST` | `/api/agents/import/bulk` | Bulk import agent team |
| `GET` | `/api/agents/approvals` | List pending approval gates |
| `PATCH` | `/api/agents/approvals/:id` | Approve or reject an action |

### Projects & Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a new project |
| `POST` | `/api/projects/:id/cicd` | Set up CI/CD for a project |
| `GET` | `/api/intelligence/graph` | Get knowledge graph for a project |
| `POST` | `/api/intelligence/simulation` | Run a delivery simulation |
| `GET` | `/api/intelligence/report` | Generate intelligence report |

### Real-Time & Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events/stream` | SSE stream for real-time updates |
| `GET` | `/api/search` | Full-text search across cards, boards, projects |
| `GET` | `/api/calendar` | Calendar view of card due dates |
| `GET` | `/api/reports` | Analytics and reporting data |
| `GET` | `/api/activity` | Activity feed |
| `GET` | `/api/notifications` | User notifications |
| `GET` | `/api/marketplace` | List team templates |
| `POST` | `/api/marketplace/:id/deploy` | Deploy a team template |
| `GET` | `/api/settings` | Workspace settings |
| `GET` | `/api/tasks` | Task list view |
| `GET` | `/api/team` | Team management |
| `POST` | `/api/team/invite` | Invite member to workspace |

---

## Marketplace Templates

| Template | Agents | Use Case |
|----------|--------|----------|
| **Full Stack SaaS Team** | Analyst, Architect, Frontend, Backend, QA, DevOps | Complete SaaS application development |
| **Landing Page Team** | Analyst, Frontend, QA | Fast landing page builds with SEO optimization |
| **API & Microservices Team** | Architect, Backend, DBA, DevOps, QA | Backend APIs and microservice architectures |
| **Data & AI Team** | Analyst, Data Engineer, ML Architect, QA | Data pipelines, ML models, and analytics |

---

## Roadmap

- [ ] **Voice Briefings** &mdash; Dictate project requirements via speech-to-text
- [ ] **Agent Playground** &mdash; Test and fine-tune agent prompts in a sandbox
- [ ] **Custom Workflow Columns** &mdash; Define custom kanban columns per project
- [ ] **Multi-Workspace** &mdash; Isolated workspaces for different organizations
- [ ] **Billing & Usage Dashboard** &mdash; Track AI token costs per project and agent
- [ ] **Plugin System** &mdash; Extend agents with custom tools (Slack, Jira, Figma, etc.)
- [ ] **Self-Hosted LLMs** &mdash; Support for Ollama and local model providers
- [ ] **Mobile App** &mdash; React Native companion for on-the-go monitoring
- [ ] **Webhook Integrations** &mdash; Trigger workflows from external events
- [ ] **Advanced RAG** &mdash; Vector database integration for richer agent memory

---

## License & Credits

**Kanban Flux** is developed by **ENI &mdash; Ethereal Nexus Institute**, a Think Tank & Science organization dedicated to advancing the frontier of AI-driven software engineering.

---

<p align="center">
  <strong>Kanban Flux</strong> &mdash; Where AI agents build your software.
</p>
