import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/agents/crypto";
import { rateLimit } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { allowed } = rateLimit("briefing-generate", 5, 60000); // 5 per minute
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  const { idea, projectType, targetAudience, features } = await req.json();

  if (!idea) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }

  // Get Gemini API key
  const apiKeyRecord = await prisma.agentApiKey.findFirst({ where: { provider: "GEMINI" } });
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "No AI API key configured. Add one in /agents" }, { status: 400 });
  }

  const apiKey = decrypt(apiKeyRecord.encryptedKey, apiKeyRecord.iv);

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a senior product manager and technical analyst. Generate a comprehensive project briefing document in Markdown format based on the user's idea.

## User's Idea
${idea}

${projectType ? `## Project Type\n${projectType}` : ""}
${targetAudience ? `## Target Audience\n${targetAudience}` : ""}
${features ? `## Requested Features\n${features}` : ""}

## Generate a Professional Briefing Document

The briefing must include these sections:

# Project: [Project Name]

## 1. Executive Summary
A 2-3 paragraph overview of the project, its purpose, and expected outcomes.

## 2. Problem Statement
What problem does this solve? Who has this problem? Why is it important?

## 3. Target Audience
Who are the primary users? What are their characteristics and needs?

## 4. Core Features & Requirements
List all features organized by priority:
### Must Have (MVP)
- Feature 1: description + acceptance criteria
- Feature 2: description + acceptance criteria
### Should Have
- Feature 3: description
### Nice to Have
- Feature 4: description

## 5. Technical Requirements
- Recommended tech stack
- Architecture considerations
- Integrations needed
- Performance requirements
- Security requirements

## 6. User Flows
Describe the main user journeys step by step.

## 7. UI/UX Guidelines
- Design style and tone
- Key screens/pages needed
- Responsive requirements
- Accessibility standards

## 8. Success Metrics
- KPIs to measure project success
- Acceptance criteria for launch

## 9. Timeline & Milestones
Suggested phases and milestones.

## 10. Risks & Mitigations
Potential risks and how to address them.

---

Write the briefing in clear, professional English. Be specific and actionable. Include concrete examples and acceptance criteria. The briefing should be detailed enough that an AI development team can build the entire project from it without further clarification.`;

  try {
    const result = await model.generateContent(prompt);
    const briefingContent = result.response.text();
    const tokenUsage = result.response.usageMetadata?.totalTokenCount || 0;

    // Extract project name from the generated briefing
    const nameMatch = briefingContent.match(/^#\s*Project:\s*(.+)$/m);
    const projectName = nameMatch ? nameMatch[1].trim() : "Untitled Project";

    return NextResponse.json({
      briefing: briefingContent,
      projectName,
      tokenUsage,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
