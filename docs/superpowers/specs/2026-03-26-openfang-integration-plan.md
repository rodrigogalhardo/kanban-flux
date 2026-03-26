# Lumys OS Integration Plan - Kanban Flux

## Context

Kanban Flux currently uses BullMQ + Redis as the agent execution engine. Lumys OS is an AI Operating System in Rust that provides: WASM sandbox, 53 built-in tools, 16 security layers, 27 LLM providers, workflow engine, agent memory with vector embeddings, and A2A protocol. This plan outlines a two-phase integration.

---

## Phase 1: Curto Prazo - Lumys OS como Worker dos Agentes (Side-by-Side)

### Objetivo
Rodar Lumys OS como serviço separado ao lado do Kanban Flux. O Next.js continua como UI, mas delega a execução dos agentes para o Lumys OS ao invés do BullMQ worker.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  Railway Project                                            │
│                                                             │
│  ┌──────────────┐     ┌─────────┐     ┌──────────────────┐  │
│  │  Web App      │────▶│  Redis   │     │  Lumys OS Daemon  │  │
│  │  (Next.js)    │     │  (Queue) │◀────│  (Rust Binary)    │  │
│  │               │     └─────────┘     │                    │  │
│  │  - UI/UX      │                     │  - Agent Runtime   │  │
│  │  - API Routes │     ┌─────────┐     │  - WASM Sandbox    │  │
│  │  - Enqueue    │────▶│Postgres │◀────│  - 53 Tools        │  │
│  │    jobs       │     │         │     │  - Vector Memory   │  │
│  └──────────────┘     └─────────┘     │  - Workflow Engine │  │
│                                        │  - Security (16x)  │  │
│                                        └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Etapas de Implementação

#### 1.1 Setup Lumys OS como Serviço no Railway
**Estimativa: 1-2 dias**

- Criar Dockerfile para Lumys OS (compilar binário Rust)
- Adicionar como serviço "lumys-os" no Railway
- Configurar variáveis: LLM_PROVIDER, LLM_API_KEY, DATABASE_URL
- Healthcheck: GET /api/health
- Lumys OS expõe API REST na porta 4200

```dockerfile
# Dockerfile.lumys-os
FROM rust:1.75-slim AS builder
WORKDIR /app
RUN git clone https://github.com/rodrigogalhardo/lumys-os .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/lumys-os /usr/local/bin/lumys-os
EXPOSE 4200
CMD ["lumys-os", "start", "--host", "0.0.0.0", "--port", "4200"]
```

#### 1.2 Criar Adapter Bridge: Kanban Flux → Lumys OS
**Estimativa: 2-3 dias**

Criar um módulo que traduz agent runs do Kanban Flux para chamadas à API do Lumys OS.

**Novo arquivo:** `src/lib/agents/lumys-os-bridge.ts`

```typescript
// Bridge between Kanban Flux executor and Lumys OS runtime
const OPENFANG_URL = process.env.OPENFANG_URL || "http://lumys-os:4200";

interface Lumys OSMessage {
  role: "user";
  content: string;
  tools?: string[];
}

// Send a task to Lumys OS for execution
export async function executeViaLumys OS(agentConfig: {
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  provider: string;
}, taskContext: string, tools: string[]): Promise<{
  response: string;
  actions: any[];
  tokenUsage: number;
}> {
  // 1. Create or get agent in Lumys OS
  const agentId = await ensureAgent(agentConfig);

  // 2. Send message to agent
  const result = await fetch(`${OPENFANG_URL}/api/agents/${agentId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: taskContext,
      tools,
      wait: true, // synchronous execution
      timeout: 300, // 5 min
    }),
  });

  return result.json();
}

async function ensureAgent(config: any): Promise<string> {
  // Check if agent exists
  const list = await fetch(`${OPENFANG_URL}/api/agents`).then(r => r.json());
  const existing = list.find((a: any) => a.name === config.name);
  if (existing) return existing.id;

  // Create agent
  const res = await fetch(`${OPENFANG_URL}/api/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: config.name,
      system_prompt: config.systemPrompt,
      model: config.model,
      provider: config.provider,
      capabilities: ["file_read", "file_write", "shell_exec", "web_fetch", "web_search", "memory_store", "memory_recall"],
    }),
  });
  const agent = await res.json();
  return agent.id;
}
```

#### 1.3 Dual Execution Mode
**Estimativa: 1-2 dias**

Permitir escolher entre BullMQ worker (atual) e Lumys OS por agente.

Adicionar ao Agent model:
```prisma
executionMode String @default("bullmq")  // "bullmq" ou "lumys-os"
```

No executor, verificar o mode:
```typescript
if (agent.executionMode === "lumys-os") {
  // Delegate to Lumys OS
  const result = await executeViaLumys OS(agentConfig, context, tools);
  // Parse result and apply actions
} else {
  // Current BullMQ execution
  const response = await provider.execute(context, apiKey);
}
```

#### 1.4 Mapear Tools do Kanban Flux → Lumys OS
**Estimativa: 2-3 dias**

Traduzir os 22 agent tools do Kanban Flux para capabilities do Lumys OS:

| Kanban Flux Tool | Lumys OS Equivalent |
|-----------------|---------------------|
| comment | channel_send (via webhook) |
| move_card | HTTP POST to Kanban API |
| create_card | HTTP POST to Kanban API |
| git_commit | file_write + shell_exec (git) |
| create_pr | shell_exec (gh cli) |
| shell_exec (code) | shell_exec (nativo) |
| attach_file | file_write |
| save_memory | memory_store |
| recall_memory | memory_recall |
| web_search | web_search (DuckDuckGo) |

Criar custom tools no Lumys OS (via HAND.toml) que chamam a API do Kanban Flux:

```toml
[hand]
name = "kanban"
description = "Kanban Flux board operations"

[[hand.tools]]
name = "kanban_comment"
description = "Post a comment on a kanban card"
endpoint = "http://web:3000/api/cards/{card_id}/comments"
method = "POST"

[[hand.tools]]
name = "kanban_move_card"
description = "Move a card to a different column"
endpoint = "http://web:3000/api/cards/{card_id}"
method = "PATCH"
```

#### 1.5 Migrar Memory para Lumys OS
**Estimativa: 1-2 dias**

Lumys OS tem memory substrate com vector embeddings (SQLite + embeddings). Migrar o AgentMemory atual para usar o Lumys OS memory:

- Export memórias existentes → POST para Lumys OS memory_store
- Novo recall_memory → chama Lumys OS semantic search
- Vantagem: busca por similaridade semântica vs keyword atual

#### 1.6 Ativar Security Layers
**Estimativa: 1 dia**

Configurar as camadas de segurança do Lumys OS:
- Taint tracking (prevenir exfiltração de secrets)
- Approval gates para shell_exec e browser
- WASM sandbox para execução de código
- Path traversal prevention
- Rate limiting por agente

#### 1.7 Testes e Validação
**Estimativa: 2-3 dias**

- Criar um projeto de teste
- Executar briefing → Analyst via Lumys OS
- Comparar output com execução BullMQ
- Validar: performance, custo, qualidade do output
- Benchmark: latência, throughput, memory usage

### Entregáveis Phase 1
- [ ] Lumys OS rodando como serviço no Railway
- [ ] Bridge adapter funcional
- [ ] Dual execution mode (BullMQ ou Lumys OS por agente)
- [ ] 22 tools mapeados
- [ ] Memory migrada para Lumys OS
- [ ] Security layers ativos
- [ ] Testes end-to-end passando
- [ ] Toggle na UI para escolher execution mode

### Estimativa Total Phase 1: 10-15 dias

---

## Phase 2: Médio Prazo - Migrar Plataforma para Lumys OS

### Objetivo
Substituir completamente o BullMQ worker, Redis (para queue), e o executor customizado pelo Lumys OS como runtime único. O Next.js continua como UI mas toda execução de agentes é Lumys OS nativo.

### Arquitetura Final

```
┌───────────────────────────────────────────────────────────────┐
│  Kanban Flux Platform                                         │
│                                                               │
│  ┌──────────────┐            ┌────────────────────────────┐   │
│  │  Next.js UI   │───HTTP────▶│  Lumys OS Kernel            │   │
│  │               │            │                              │   │
│  │  - Dashboard  │◀──SSE/WS──│  ┌─────────────────────┐    │   │
│  │  - Boards     │            │  │  Agent Registry       │    │   │
│  │  - Projects   │            │  │  14 Antigravity Agents│    │   │
│  │  - Intelligence│           │  └─────────────────────┘    │   │
│  │  - Briefing   │            │                              │   │
│  │  - Marketplace│            │  ┌─────────────────────┐    │   │
│  │  - Portal     │            │  │  Workflow Engine       │    │   │
│  └──────────────┘            │  │  Todo→Brainstorm→Dev  │    │   │
│                               │  │  →QA→Done pipeline    │    │   │
│  ┌──────────────┐            │  └─────────────────────┘    │   │
│  │  PostgreSQL   │◀───────────│                              │   │
│  │  (Prisma)     │            │  ┌─────────────────────┐    │   │
│  └──────────────┘            │  │  Memory Substrate     │    │   │
│                               │  │  SQLite + Embeddings  │    │   │
│                               │  └─────────────────────┘    │   │
│                               │                              │   │
│                               │  ┌─────────────────────┐    │   │
│                               │  │  Tool Runner          │    │   │
│                               │  │  53 tools + Kanban    │    │   │
│                               │  │  custom tools         │    │   │
│                               │  └─────────────────────┘    │   │
│                               │                              │   │
│                               │  ┌─────────────────────┐    │   │
│                               │  │  Security             │    │   │
│                               │  │  WASM + Taint + Auth  │    │   │
│                               │  │  + Approval Gates     │    │   │
│                               │  └─────────────────────┘    │   │
│                               │                              │   │
│                               │  ┌─────────────────────┐    │   │
│                               │  │  Scheduler            │    │   │
│                               │  │  Cron + Triggers +    │    │   │
│                               │  │  Event-driven         │    │   │
│                               │  └─────────────────────┘    │   │
│                               └────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Etapas de Implementação

#### 2.1 Converter Agentes para Lumys OS Agents
**Estimativa: 3-5 dias**

Traduzir os 14 agentes Antigravity (atualmente definidos em markdown + Prisma) para agent.toml do Lumys OS:

```toml
# agents/analyst/agent.toml
[agent]
name = "Analyst Agent"
description = "Analyzes projects, validates concepts, decomposes into tasks"
model = "gemini-2.5-flash"
provider = "gemini"

[agent.capabilities]
tools = [
  "web_search", "web_fetch",
  "memory_store", "memory_recall",
  "file_read", "file_write",
  "kanban_comment", "kanban_create_card",
  "kanban_move_card", "kanban_assign_agent",
]

[agent.scheduling]
mode = "reactive"    # triggered by messages

[agent.limits]
max_tokens_per_hour = 100000
max_context_tokens = 200000
```

Criar um script de migração que:
1. Lê os agentes do Prisma
2. Gera agent.toml para cada um
3. Registra no Lumys OS via API

#### 2.2 Converter Workflows para Lumys OS Workflow Engine
**Estimativa: 3-5 dias**

O fluxo Briefing → Analyst → Cards → Agents → QA → Done vira um Lumys OS Workflow:

```toml
[workflow]
name = "project_pipeline"
description = "Full project execution pipeline"

[[workflow.steps]]
name = "analyze_briefing"
agent = "analyst"
prompt_template = "Analyze this project briefing and create task cards: {{input}}"
output_var = "analysis"
timeout = 300

[[workflow.steps]]
name = "create_tasks"
agent = "master"
prompt_template = "Based on this analysis, create and assign tasks to the team: {{analysis}}"
mode = "sequential"
output_var = "task_plan"

[[workflow.steps]]
name = "execute_tasks"
agent = "team"
prompt_template = "Execute your assigned tasks based on: {{task_plan}}"
mode = "fan_out"    # all agents work in parallel
output_var = "results"

[[workflow.steps]]
name = "qa_review"
agent = "qa"
prompt_template = "Review all completed work: {{results}}"
mode = "collect"
error_mode = "retry"
max_retries = 2

[[workflow.steps]]
name = "final_report"
agent = "analyst"
prompt_template = "Generate final project report based on: {{results}}"
mode = "sequential"
```

#### 2.3 Migrar Auto-Trigger para Lumys OS Triggers
**Estimativa: 2-3 dias**

Substituir o auto-trigger customizado por Lumys OS Trigger Engine:

```toml
[[triggers]]
name = "card_moved_to_qa"
event_pattern = "kanban.card.moved"
condition = "column == 'QA'"
agent = "qa"
prompt_template = "Review this card that was moved to QA: {{card_title}}\n\n{{card_description}}"

[[triggers]]
name = "card_moved_to_bug"
event_pattern = "kanban.card.moved"
condition = "column == 'Bug'"
agent = "{{original_agent}}"
prompt_template = "Fix this bug: {{card_title}}\n\nQA feedback: {{qa_comment}}"

[[triggers]]
name = "human_comment"
event_pattern = "kanban.comment.created"
condition = "is_human == true"
agent = "{{assigned_agent}}"
prompt_template = "Human commented on your task: {{comment_text}}"
```

#### 2.4 Migrar Scheduling para Lumys OS Scheduler
**Estimativa: 1-2 dias**

- SLA checker → Lumys OS periodic agent (cron: "0 */6 * * *")
- Memory decay → Lumys OS periodic agent (cron: "0 0 * * *")
- Risk scoring → Lumys OS event trigger (on card update)

#### 2.5 Substituir BullMQ Queue
**Estimativa: 2-3 dias**

- Remover BullMQ + Redis dependência
- API routes chamam Lumys OS diretamente
- Lumys OS gerencia filas internamente (com resource quotas)
- SSE/WebSocket via Lumys OS API (streaming nativo)

Mudanças:
```typescript
// ANTES (BullMQ)
const { enqueueAgentRun } = await import("@/lib/agents/queue");
await enqueueAgentRun(run.id);

// DEPOIS (Lumys OS)
const { sendToLumys OS } = await import("@/lib/agents/lumys-os-bridge");
await sendToLumys OS(run.agentId, run.cardId, taskContext);
```

#### 2.6 Integrar Lumys OS Memory Substrate
**Estimativa: 2-3 dias**

Substituir AgentMemory (Prisma) pelo Lumys OS Memory Substrate:
- Structured KV → per-agent config
- Semantic Search → vector embeddings para recall
- Knowledge Graph → entities + relations (complementa GraphNode/GraphEdge)
- Session Store → conversation history por card

Vantagem principal: **busca semântica** vs keyword match atual. Agente pergunta "como fizemos autenticação?" e encontra memórias relevantes mesmo sem keywords exatas.

#### 2.7 Ativar Lumys OS Hands
**Estimativa: 3-5 dias**

Criar Hands customizados para o Kanban Flux:

**Kanban Hand:**
```toml
[hand]
name = "kanban"
version = "1.0"
description = "Autonomous kanban board management"

[hand.schedule]
mode = "continuous"
interval = 300    # check every 5 minutes

[hand.tools]
required = ["kanban_comment", "kanban_move_card", "kanban_create_card", "web_fetch"]

[hand.metrics]
cards_completed = "counter"
avg_cycle_time = "gauge"
bug_rate = "gauge"
```

**Researcher Hand (para o Analyst):**
- Usa o Researcher Hand built-in do Lumys OS
- Configurar para pesquisar tecnologias, competidores, etc.
- Output vai direto para o card como attachment

**Collector Hand (para monitoring):**
- Monitora métricas do projeto (cards overdue, agents idle)
- Alerta via webhook quando detecta problemas
- Roda continuamente em background

#### 2.8 Browser Automation para QA
**Estimativa: 2-3 dias**

Usar o Browser Hand do Lumys OS para QA visual:
- QA agent abre preview URL no browser
- Navega pelas páginas
- Tira screenshots
- Valida elementos na tela
- Reporta bugs com screenshots anexados

```toml
[hand]
name = "visual_qa"

[hand.tools]
required = ["browser_navigate", "browser_screenshot", "browser_fill_form", "kanban_comment", "kanban_attach_file"]
```

#### 2.9 Code Execution Sandbox Real
**Estimativa: 2-3 dias**

Usar WASM sandbox + docker_exec do Lumys OS para:
- Frontend agent roda `npm run build` e verifica erros
- Backend agent roda `npm test`
- QA agent roda testes automatizados
- Tudo sandboxed com limites de CPU/memory

#### 2.10 OFP Mesh Networking (Escala)
**Estimativa: 3-5 dias**

Para 20 projetos x 20 agentes:
- Múltiplas instâncias Lumys OS em mesh
- Agentes distribuídos entre nós
- Load balancing automático
- Failover: se um nó cai, agentes migram

```toml
# lumys-os.toml
[network]
listen_addr = "0.0.0.0:8765"
bootstrap_peers = [
  "lumys-os-worker-1.railway.internal:8765",
  "lumys-os-worker-2.railway.internal:8765",
]
```

#### 2.11 Remover Código Legado
**Estimativa: 2-3 dias**

Após validar que tudo funciona via Lumys OS:
- Remover `src/lib/agents/executor.ts`
- Remover `src/lib/agents/providers/` (gemini, claude, openai)
- Remover `src/lib/agents/queue.ts`
- Remover `src/lib/redis.ts`
- Remover `src/worker.ts`
- Remover dependências: bullmq, ioredis, @google/generative-ai, @anthropic-ai/sdk, openai
- Manter: lumys-os-bridge.ts como interface única

#### 2.12 Testes de Migração
**Estimativa: 3-5 dias**

- Testes end-to-end: briefing → project → cards → agents → QA → Done
- Testes de escalabilidade: 10 projetos simultâneos
- Testes de failover: matar worker, verificar recovery
- Testes de segurança: taint tracking, injection prevention
- Benchmark: performance vs BullMQ
- User acceptance testing

### Entregáveis Phase 2
- [ ] Todos os 14 agentes como Lumys OS agents (agent.toml)
- [ ] Workflow Engine configurado para pipeline completo
- [ ] Triggers substituindo auto-trigger customizado
- [ ] Lumys OS Scheduler substituindo cron jobs
- [ ] BullMQ + Redis removidos
- [ ] Memory substrate com vector embeddings
- [ ] Browser automation para QA visual
- [ ] Code sandbox real (WASM + docker)
- [ ] OFP mesh para escalabilidade
- [ ] Código legado removido
- [ ] Testes end-to-end passando
- [ ] Benchmark de performance

### Estimativa Total Phase 2: 25-35 dias

---

## Resumo

| Phase | Duração | Risco | Resultado |
|-------|---------|-------|-----------|
| **Phase 1** | 10-15 dias | Baixo | Lumys OS side-by-side, dual mode, ganho imediato de security + sandbox |
| **Phase 2** | 25-35 dias | Médio | Migração completa, BullMQ removido, escala enterprise, 53 tools nativos |

### Decisão: Quando iniciar Phase 2?

Iniciar Phase 2 quando:
1. Phase 1 está estável há pelo menos 1 semana
2. Lumys OS v1.0 é lançado (ou commit atual é validado em produção)
3. Benchmark confirma performance >= BullMQ
4. Todos os 22 tools funcionam via Lumys OS

### Dependências Externas
- Lumys OS v1.0 release (estimado mid-2026)
- Railway suporte a Rust builds (já suporta)
- Gemini API estabilidade (já validado)
