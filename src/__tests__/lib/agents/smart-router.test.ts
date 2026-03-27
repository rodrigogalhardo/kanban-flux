import { describe, it, expect } from "vitest";
import { routeTask, getProviderFallback, calculateComplexity, profileTask } from "@/lib/agents/smart-router";

describe("Smart Router", () => {
  describe("profileTask", () => {
    it("detects code-related tasks", () => {
      const profile = profileTask({
        description: "Implement the authentication API endpoint",
        checklists: [],
        labels: ["Backend"],
        agentRole: "backend",
      });
      expect(profile.isCodeRelated).toBe(true);
    });

    it("detects analysis tasks", () => {
      const profile = profileTask({
        description: "Analyze market competition and evaluate strategies",
        checklists: [],
        labels: [],
        agentRole: "analyst",
      });
      expect(profile.isAnalysis).toBe(true);
    });
  });

  describe("calculateComplexity", () => {
    it("returns low for simple tasks", () => {
      const result = calculateComplexity({
        descriptionLength: 50,
        hasChecklist: false,
        checklistItems: 0,
        labelCount: 1,
        isCodeRelated: false,
        isAnalysis: false,
        agentRole: "frontend",
      });
      expect(result).toBe("low");
    });

    it("returns high for complex code tasks", () => {
      const result = calculateComplexity({
        descriptionLength: 600,
        hasChecklist: true,
        checklistItems: 8,
        labelCount: 3,
        isCodeRelated: true,
        isAnalysis: false,
        agentRole: "architect",
      });
      expect(result).toBe("high");
    });
  });

  describe("routeTask", () => {
    it("routes low complexity to cheapest model", () => {
      const decision = routeTask({
        description: "Fix typo",
        checklists: [],
        labels: [],
        agentRole: "frontend",
        availableProviders: ["GEMINI", "CLAUDE"],
      });
      expect(decision.provider).toBe("GEMINI");
      expect(decision.estimatedCost).toBeLessThan(1);
    });

    it("routes high complexity to premium model", () => {
      const decision = routeTask({
        description: "Design and implement the entire microservice architecture with event-driven communication, database sharding, and distributed caching layer",
        checklists: [{ items: [
          { id: "1", text: "Task 1", completed: false },
          { id: "2", text: "Task 2", completed: false },
          { id: "3", text: "Task 3", completed: false },
          { id: "4", text: "Task 4", completed: false },
          { id: "5", text: "Task 5", completed: false },
          { id: "6", text: "Task 6", completed: false },
        ] }],
        labels: ["Backend", "Architecture"],
        agentRole: "architect",
        availableProviders: ["GEMINI", "CLAUDE", "OPENAI"],
      });
      expect(decision.provider).toBe("CLAUDE");
    });
  });

  describe("getProviderFallback", () => {
    it("returns fallback when primary fails", () => {
      const fallback = getProviderFallback("GEMINI", ["GEMINI", "OPENAI"]);
      expect(fallback).not.toBeNull();
      expect(fallback!.provider).toBe("OPENAI");
    });

    it("returns null when no fallback available", () => {
      const fallback = getProviderFallback("GEMINI", ["GEMINI"]);
      expect(fallback).toBeNull();
    });
  });
});
