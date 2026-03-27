import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // --- Admin User ---
  const adminUser = await prisma.user.upsert({
    where: { email: "galhardo.dn@gmail.com" },
    update: { name: "Rodrigo Galhardo", password: "admin123" },
    create: {
      id: "admin-user",
      name: "Rodrigo Galhardo",
      email: "galhardo.dn@gmail.com",
      password: "admin123",
      avatar: null,
    },
  });
  console.log(`✔ Admin user: ${adminUser.name} (${adminUser.id})`);

  // --- Workspace ---
  const workspace = await prisma.workspace.upsert({
    where: { id: "default-workspace" },
    update: { name: "ENI Workspace" },
    create: {
      id: "default-workspace",
      name: "ENI Workspace",
    },
  });
  console.log(`✔ Workspace: ${workspace.name}`);

  // --- Workspace Membership ---
  const existingMembership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: adminUser.id,
        workspaceId: workspace.id,
      },
    },
  });
  if (!existingMembership) {
    await prisma.workspaceMember.create({
      data: {
        userId: adminUser.id,
        workspaceId: workspace.id,
        role: "ADMIN",
      },
    });
    console.log(`✔ Admin workspace membership created`);
  } else {
    console.log(`✔ Admin workspace membership already exists`);
  }

  // --- Labels (upsert by name) ---
  const labelData = [
    { name: "Bug", color: "#FF5630" },
    { name: "Feature", color: "#0052CC" },
    { name: "Urgent", color: "#FF8B00" },
    { name: "Design", color: "#6554C0" },
    { name: "Backend", color: "#00B8D9" },
    { name: "Frontend", color: "#36B37E" },
    { name: "DevOps", color: "#403294" },
    { name: "Documentation", color: "#97A0AF" },
    { name: "AI/ML", color: "#E774BB" },
  ];

  let labelCount = 0;
  for (const ld of labelData) {
    const existing = await prisma.label.findFirst({ where: { name: ld.name } });
    if (!existing) {
      await prisma.label.create({ data: ld });
      labelCount++;
    }
  }
  console.log(`✔ Labels: ${labelCount} created, ${labelData.length - labelCount} already existed`);

  console.log("\nSeed completed successfully!");
  console.log(`- 1 admin user`);
  console.log(`- 1 workspace`);
  console.log(`- ${labelData.length} labels`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
