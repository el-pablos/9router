import { describe, it, expect } from "vitest";
import { buildKiroPayload } from "../../open-sse/translator/request/openai-to-kiro.js";

const MARKER = "KIRO AGENTIC SYSTEM PROMPT";

const fakeCredentials = { providerSpecificData: { profileArn: "arn:test" } };
const fakeBody = (model) => ({
  model,
  messages: [{ role: "user", content: "halo" }],
  stream: false,
});

describe("buildKiroPayload agentic guard", () => {
  it("non-agentic model: finalContent must NOT contain language prompt marker", () => {
    const p = buildKiroPayload("kr/claude-haiku-4.5", fakeBody("kr/claude-haiku-4.5"), false, fakeCredentials);
    const finalContent = p.conversationState.currentMessage.userInputMessage.content;
    expect(finalContent).not.toContain(MARKER);
  });
  it("agentic model: finalContent MUST contain language prompt marker", () => {
    const p = buildKiroPayload("kr/claude-haiku-4.5-agentic", fakeBody("kr/claude-haiku-4.5-agentic"), false, fakeCredentials);
    const finalContent = p.conversationState.currentMessage.userInputMessage.content;
    expect(finalContent).toContain(MARKER);
  });
  it("non-agentic still has timestamp marker", () => {
    const p = buildKiroPayload("kr/claude-haiku-4.5", fakeBody("kr/claude-haiku-4.5"), false, fakeCredentials);
    const finalContent = p.conversationState.currentMessage.userInputMessage.content;
    expect(finalContent).toContain("[Context: Current time is");
  });
});
