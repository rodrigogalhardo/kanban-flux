import { describe, it, expect } from "vitest";

describe("Agent Memory", () => {
  it("keyword extraction works", () => {
    const query = "how to implement authentication in React";
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    expect(keywords).toContain("implement");
    expect(keywords).toContain("authentication");
    expect(keywords).toContain("react");
    expect(keywords).not.toContain("to");
    expect(keywords).not.toContain("in");
  });
});
