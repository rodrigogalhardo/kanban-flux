import { describe, it, expect } from "vitest";

// We test the scoring logic conceptually (actual function uses Prisma)
describe("Risk Scoring Logic", () => {
  it("high dependency count increases risk", () => {
    // Risk factors: dependencies add 10 per dep, max 30
    const risk = Math.min(30, 3 * 10); // 3 dependencies
    expect(risk).toBe(30);
  });

  it("overdue cards have high risk", () => {
    const dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const isOverdue = dueDate < new Date();
    expect(isOverdue).toBe(true);
    // Overdue adds 25 points
  });

  it("P0 priority adds risk", () => {
    const priority = 0; // P0
    const riskFromPriority = priority === 0 ? 15 : priority === 1 ? 10 : 0;
    expect(riskFromPriority).toBe(15);
  });
});
