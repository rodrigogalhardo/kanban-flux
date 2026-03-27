const translations: Record<string, Record<string, string>> = {
  en: {
    "dashboard": "Dashboard",
    "my_tasks": "My Tasks",
    "team": "Team",
    "reports": "Reports",
    "projects": "Projects",
    "agents": "AI Agents",
    "intelligence": "Intelligence",
    "marketplace": "Marketplace",
    "briefing": "Briefing",
    "sprints": "Sprints",
    "artifacts": "Artifacts",
    "settings": "Settings",
    "create_project": "Create Project",
    "no_agents": "No agents configured",
    "run_agent": "Run Agent",
    "loading": "Loading...",
  },
  "pt-BR": {
    "dashboard": "Painel",
    "my_tasks": "Minhas Tarefas",
    "team": "Equipe",
    "reports": "Relat\u00f3rios",
    "projects": "Projetos",
    "agents": "Agentes IA",
    "intelligence": "Intelig\u00eancia",
    "marketplace": "Marketplace",
    "briefing": "Briefing",
    "sprints": "Sprints",
    "artifacts": "Artefatos",
    "settings": "Configura\u00e7\u00f5es",
    "create_project": "Criar Projeto",
    "no_agents": "Nenhum agente configurado",
    "run_agent": "Executar Agente",
    "loading": "Carregando...",
  },
};

let currentLocale = "en";

export function setLocale(locale: string) {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem("kanban-locale", locale);
  }
}

export function getLocale(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("kanban-locale") || "en";
  }
  return currentLocale;
}

export function t(key: string): string {
  const locale = getLocale();
  return translations[locale]?.[key] || translations["en"]?.[key] || key;
}
