export const DEFAULT_BOARD_TEMPLATES = [
  {
    name: "SaaS Development",
    description: "Full-featured board for SaaS projects",
    category: "saas",
    columns: ["Todo", "Brainstorming", "In Progress", "Code Review", "QA", "Bug", "Done"],
    cardTemplates: [
      { title: "Setup project structure", priority: 1, labels: ["Backend", "DevOps"] },
      { title: "Design database schema", priority: 0, labels: ["Backend", "Design"] },
      { title: "Implement authentication", priority: 0, labels: ["Backend", "Feature"] },
      { title: "Create landing page", priority: 1, labels: ["Frontend", "Design"] },
      { title: "Setup CI/CD pipeline", priority: 1, labels: ["DevOps"] },
      { title: "Write API documentation", priority: 2, labels: ["Documentation"] },
    ],
  },
  {
    name: "Landing Page",
    description: "Quick landing page project",
    category: "landing-page",
    columns: ["Todo", "Brainstorming", "In Progress", "QA", "Done"],
    cardTemplates: [
      { title: "Design hero section", priority: 1, labels: ["Frontend", "Design"] },
      { title: "Build responsive layout", priority: 1, labels: ["Frontend"] },
      { title: "Implement contact form", priority: 2, labels: ["Frontend", "Backend"] },
      { title: "SEO optimization", priority: 2, labels: ["Frontend"] },
    ],
  },
  {
    name: "API Project",
    description: "Backend API development board",
    category: "api",
    columns: ["Todo", "Brainstorming", "In Progress", "Testing", "Code Review", "Done"],
    cardTemplates: [
      { title: "Design API architecture", priority: 0, labels: ["Backend", "Design"] },
      { title: "Setup database models", priority: 1, labels: ["Backend"] },
      { title: "Implement CRUD endpoints", priority: 1, labels: ["Backend", "Feature"] },
      { title: "Add authentication middleware", priority: 0, labels: ["Backend", "Feature"] },
      { title: "Write integration tests", priority: 1, labels: ["Backend"] },
      { title: "API documentation (Swagger)", priority: 2, labels: ["Documentation"] },
    ],
  },
];
