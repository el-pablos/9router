/**
 * Unit tests for open-sse/translator/request/openai-to-kiro.js
 *
 * Tests cover:
 *  - buildKiroPayload() - basic message conversion
 *  - Image forwarding fix: images in currentMessage must be included in payload
 */

import { describe, it, expect } from "vitest";
import { buildKiroPayload, getModelContextConfig } from "../../open-sse/translator/request/openai-to-kiro.js";

describe("buildKiroPayload", () => {
  describe("basic message conversion", () => {
    it("should convert a simple text message", () => {
      const body = {
        messages: [{ role: "user", content: "Hello" }]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.content).toContain("Hello");
      expect(currentMsg.userInputMessage.modelId).toBe("claude-sonnet-4.6");
      expect(currentMsg.userInputMessage.origin).toBe("AI_EDITOR");
    });

    it("should not include images field when no images are present", () => {
      const body = {
        messages: [{ role: "user", content: "No images here" }]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.images).toBeUndefined();
    });
  });

  describe("image forwarding", () => {
    it("should forward base64 image from image_url content part", () => {
      const fakeBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image" },
              { type: "image_url", image_url: { url: `data:image/png;base64,${fakeBase64}` } }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.images).toBeDefined();
      expect(currentMsg.userInputMessage.images).toHaveLength(1);
      expect(currentMsg.userInputMessage.images[0].format).toBe("png");
      expect(currentMsg.userInputMessage.images[0].source.bytes).toBe(fakeBase64);
    });

    it("should forward multiple base64 images", () => {
      const fakeBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Compare these images" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fakeBase64}` } },
              { type: "image_url", image_url: { url: `data:image/png;base64,${fakeBase64}` } }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.images).toHaveLength(2);
      expect(currentMsg.userInputMessage.images[0].format).toBe("jpeg");
      expect(currentMsg.userInputMessage.images[1].format).toBe("png");
    });

    it("should not include images field when images array is empty", () => {
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Just text" }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.images).toBeUndefined();
    });

    it("should include both images and text content together", () => {
      const fakeBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this image?" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${fakeBase64}` } }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      expect(currentMsg.userInputMessage.content).toContain("What is in this image?");
      expect(currentMsg.userInputMessage.images).toHaveLength(1);
    });

    it("should treat http image URLs as text fallback (Kiro only supports base64)", () => {
      const body = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Look at this" },
              { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});

      const currentMsg = result.conversationState.currentMessage;
      // HTTP URLs are not supported by Kiro — converted to text placeholder
      expect(currentMsg.userInputMessage.images).toBeUndefined();
      expect(currentMsg.userInputMessage.content).toContain("[Image: https://example.com/photo.jpg]");
    });
  });

  describe("tool interaction without client-provided tools", () => {
    // When the client omits `tools` (e.g. after compaction), structured tool
    // content must be flattened to text so Kiro's "tools required" 400 never
    // fires and no phantom tool-calling capability is advertised.

    it("should flatten OpenAI tool_calls + tool result into history text with no tools array", () => {
      const body = {
        messages: [
          { role: "user", content: "Read the file" },
          {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "read_file", arguments: '{"path":"a.txt"}' } }
            ]
          },
          { role: "tool", tool_call_id: "call_1", content: "file contents here" },
          { role: "user", content: "Summarize it" }
        ]
        // note: no `tools`
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
      const cs = result.conversationState;

      // No structured tool content anywhere
      expect(cs.currentMessage.userInputMessage.userInputMessageContext).toBeUndefined();
      const allJson = JSON.stringify(cs);
      expect(allJson).not.toContain("toolUses");
      expect(allJson).not.toContain("toolResults");

      // Tool call + result preserved as readable text (call lands in history,
      // result merges into the final currentMessage — assert across both)
      expect(allJson).toContain("[Tool call: read_file(");
      expect(allJson).toContain("[Tool result: file contents here]");
    });

    it("should flatten Claude tool_use / tool_result blocks with no tools array", () => {
      const body = {
        messages: [
          { role: "user", content: "Do it" },
          {
            role: "assistant",
            content: [
              { type: "text", text: "Calling tool" },
              { type: "tool_use", id: "tu_1", name: "search", input: { q: "kiro" } }
            ]
          },
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tu_1", content: "result text" }
            ]
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
      const cs = result.conversationState;

      const allJson = JSON.stringify(cs);
      expect(allJson).not.toContain("toolUses");
      expect(allJson).not.toContain("toolResults");
      expect(allJson).toContain("[Tool call: search(");
      expect(allJson).toContain("[Tool result: result text]");
    });

    it("should keep structured tools when the client DOES provide a tools array", () => {
      const body = {
        messages: [
          { role: "user", content: "Read the file" },
          {
            role: "assistant",
            content: null,
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "read_file", arguments: '{"path":"a.txt"}' } }
            ]
          },
          { role: "tool", tool_call_id: "call_1", content: "file contents here" },
          { role: "user", content: "Summarize it" }
        ],
        tools: [
          {
            type: "function",
            function: { name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
      const cs = result.conversationState;

      // Structured tool spec carried on currentMessage
      const tools = cs.currentMessage.userInputMessage.userInputMessageContext?.tools;
      expect(tools).toBeDefined();
      expect(tools[0].toolSpecification.name).toBe("read_file");

      // Structured tool history preserved (not flattened to text)
      const allJson = JSON.stringify(cs);
      expect(allJson).toContain("toolUses");
      expect(allJson).not.toContain("[Tool call:");
    });

    it("should salvage orphaned tool_result content as text instead of discarding it", () => {
      // Client provides tools, but compaction removed the assistant tool_use
      // message, leaving a tool_result whose tool_use_id matches nothing.
      const body = {
        messages: [
          { role: "user", content: "Start" },
          // (assistant tool_use for "orphan_call" was compacted away)
          {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "orphan_call", content: "important orphaned output" }
            ]
          },
          { role: "user", content: "Now continue" }
        ],
        tools: [
          {
            type: "function",
            function: { name: "some_tool", description: "x", parameters: { type: "object", properties: {}, required: [] } }
          }
        ]
      };

      const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
      const cs = result.conversationState;
      const allJson = JSON.stringify(cs);

      // The dangling structured reference is gone (would trigger Kiro 400)...
      expect(allJson).not.toContain("orphan_call");
      // ...but the content is preserved as salvaged text, not discarded.
      expect(allJson).toContain("[Tool result: important orphaned output]");
    });
  });
});

describe("buildKiroPayload Indonesian language injection", () => {
  it("injects BAHASA INDONESIA mandate for a plain model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("BAHASA INDONESIA");
    // hard-lock: no escape-hatch clause allowed
    expect(content).not.toContain("## PENGECUALIAN");
  });

  it("injects BAHASA INDONESIA mandate for a thinking+agentic model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.5-thinking-agentic", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("BAHASA INDONESIA");
    // language mandate must coexist with the thinking tag
    expect(content).toContain("<thinking_mode>enabled</thinking_mode>");
    // write/chunk policy must NO LONGER be injected (caused timeout-abort & analysis paralysis)
    expect(content).not.toContain("NO CHUNK LIMIT");
    expect(content).not.toContain("FILE WRITE POLICY");
  });

  it("keeps the original user text intact alongside the language mandate", () => {
    const body = { messages: [{ role: "user", content: "unique-marker-xyz" }] };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("unique-marker-xyz");
    expect(content).toContain("BAHASA INDONESIA");
  });

  it("does NOT inject any write/chunk/file-strategy policy for an -agentic model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.5-agentic", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    // agentic must be a pure alias now: no injected write-strategy opinion at all
    expect(content).not.toContain("FILE WRITE POLICY");
    expect(content).not.toContain("CHUNK LIMIT");
    expect(content).not.toContain("CHUNKED WRITE");
    expect(content).not.toContain("350");
    expect(content).not.toContain("single operation");
    // but the language mandate still applies to every kr model
    expect(content).toContain("BAHASA INDONESIA");
  });
});

describe("context-window enforcement", () => {
  it("truncation should preserve user-first alternation (Bug B regression)", () => {
    // Build payload with large history that will exceed the 200k budget
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(1500)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(1500)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const history = result.conversationState.history;

    // History must start with userInputMessage (not assistant)
    if (history.length > 0) {
      expect(history[0].userInputMessage).toBeDefined();
      expect(history[0].assistantResponseMessage).toBeUndefined();
    }

    // History must end with assistantResponseMessage
    if (history.length > 0) {
      const last = history[history.length - 1];
      expect(last.assistantResponseMessage).toBeDefined();
    }

    // History must alternate: user, assistant, user, assistant...
    for (let i = 0; i < history.length; i++) {
      if (i % 2 === 0) {
        expect(history[i].userInputMessage).toBeDefined();
      } else {
        expect(history[i].assistantResponseMessage).toBeDefined();
      }
    }
  });

  it("should use dynamic maxOutputTokens based on model family", () => {
    const body = { messages: [{ role: "user", content: "test" }] };

    const opusResult = buildKiroPayload("claude-opus-4.8", body, true, {});
    expect(opusResult.inferenceConfig.maxTokens).toBe(32000);

    const haikuResult = buildKiroPayload("claude-haiku-4.5", body, true, {});
    expect(haikuResult.inferenceConfig.maxTokens).toBe(8192);

    const sonnetResult = buildKiroPayload("claude-sonnet-4.5", body, true, {});
    expect(sonnetResult.inferenceConfig.maxTokens).toBe(16384);
  });
});

describe("getModelContextConfig - Opus 1M context window", () => {
  it("Opus 4.8 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.8");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.7 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.7");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.6 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.6");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.5 stays at 200k (no 1M SKU upstream)", () => {
    const config = getModelContextConfig("claude-opus-4.5");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.5 with thinking+agentic suffix stays at 200k", () => {
    const config = getModelContextConfig("claude-opus-4.5-thinking-agentic");
    expect(config.maxInputTokens).toBe(200000);
  });

  it("Opus with -thinking suffix still uses 1M", () => {
    const config = getModelContextConfig("claude-opus-4.8-thinking");
    expect(config.maxInputTokens).toBe(1000000);
  });

  it("Opus with -agentic suffix still uses 1M", () => {
    const config = getModelContextConfig("claude-opus-4.7-agentic");
    expect(config.maxInputTokens).toBe(1000000);
  });

  it("Sonnet still uses 200k (not affected by Opus change)", () => {
    const config = getModelContextConfig("claude-sonnet-4.6");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(16384);
  });

  it("Haiku still uses 200k (not affected by Opus change)", () => {
    const config = getModelContextConfig("claude-haiku-4.5");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(8192);
  });

  it("Unknown model defaults to 200k (Sonnet-like)", () => {
    const config = getModelContextConfig("some-other-model");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(16384);
  });
});

describe("Opus 1M context - truncation threshold is higher", () => {
  it("Opus should NOT truncate a ~500k token conversation", () => {
    // ~500k tokens = ~1.75M chars at 3.5 chars/token
    // With 200k window, this would truncate. With 1M, it should NOT.
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(5000)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(5000)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    // This payload is ~200 turns * 10k chars = ~2M chars = ~571k tokens
    // Should NOT truncate under a 1M window (968k budget = 1M - 32k output)
    const result = buildKiroPayload("claude-opus-4.7", body, true, {});
    const history = result.conversationState.history;

    // With 1M, all 200 history pairs should be preserved (400 entries)
    expect(history.length).toBe(400);
  });

  it("Haiku SHOULD truncate the same ~500k token conversation (200k window)", () => {
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(5000)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(5000)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const history = result.conversationState.history;

    // With 200k window, significant truncation should occur
    expect(history.length).toBeLessThan(400);
    // But still some history preserved
    expect(history.length).toBeGreaterThan(0);
  });
});

describe("1M variant default routing (agentic / thinking / agentic+thinking)", () => {
  const body = { messages: [{ role: "user", content: "hi" }] };
  const cases = [
    ["claude-opus-4.8-agentic", "claude-opus-4.8"],
    ["claude-opus-4.8-thinking", "claude-opus-4.8"],
    ["claude-opus-4.8-thinking-agentic", "claude-opus-4.8"],
    ["claude-opus-4.7-thinking-agentic", "claude-opus-4.7"],
    ["claude-opus-4.6-thinking-agentic", "claude-opus-4.6"],
  ];
  for (const [variant, upstream] of cases) {
    it(`${variant} -> 1M context + valid upstream "${upstream}" (no invalid suffix)`, () => {
      expect(getModelContextConfig(variant).maxInputTokens).toBe(1000000);
      const payload = buildKiroPayload(variant, body, true, {});
      expect(payload._kiroUpstreamModel).toBe(upstream);
      expect(payload._kiroUpstreamModel).not.toContain("-thinking");
      expect(payload._kiroUpstreamModel).not.toContain("-agentic");
    });
  }

  it("non-1M variant (sonnet-4.5-thinking-agentic) stays 200k with valid upstream", () => {
    expect(getModelContextConfig("claude-sonnet-4.5-thinking-agentic").maxInputTokens).toBe(200000);
    const payload = buildKiroPayload("claude-sonnet-4.5-thinking-agentic", body, true, {});
    expect(payload._kiroUpstreamModel).toBe("claude-sonnet-4.5");
  });

  it("opus-4.5 variant stays 200k (not a 1M SKU) with valid upstream", () => {
    expect(getModelContextConfig("claude-opus-4.5-thinking-agentic").maxInputTokens).toBe(200000);
    const payload = buildKiroPayload("claude-opus-4.5-thinking-agentic", body, true, {});
    expect(payload._kiroUpstreamModel).toBe("claude-opus-4.5");
  });
});

describe("buildKiroPayload Indonesian language injection", () => {
  it("injects BAHASA INDONESIA mandate for a plain model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.6", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("BAHASA INDONESIA");
    // hard-lock: no escape-hatch clause allowed
    expect(content).not.toContain("## PENGECUALIAN");
  });

  it("injects BAHASA INDONESIA mandate for a thinking+agentic model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.5-thinking-agentic", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("BAHASA INDONESIA");
    // language mandate must coexist with the thinking tag
    expect(content).toContain("<thinking_mode>enabled</thinking_mode>");
    // write/chunk policy must NO LONGER be injected (caused timeout-abort & analysis paralysis)
    expect(content).not.toContain("NO CHUNK LIMIT");
    expect(content).not.toContain("FILE WRITE POLICY");
  });

  it("keeps the original user text intact alongside the language mandate", () => {
    const body = { messages: [{ role: "user", content: "unique-marker-xyz" }] };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    expect(content).toContain("unique-marker-xyz");
    expect(content).toContain("BAHASA INDONESIA");
  });

  it("does NOT inject any write/chunk/file-strategy policy for an -agentic model", () => {
    const body = { messages: [{ role: "user", content: "Hello" }] };
    const result = buildKiroPayload("claude-sonnet-4.5-agentic", body, true, {});
    const content = result.conversationState.currentMessage.userInputMessage.content;
    // agentic must be a pure alias now: no injected write-strategy opinion at all
    expect(content).not.toContain("FILE WRITE POLICY");
    expect(content).not.toContain("CHUNK LIMIT");
    expect(content).not.toContain("CHUNKED WRITE");
    expect(content).not.toContain("350");
    expect(content).not.toContain("single operation");
    // but the language mandate still applies to every kr model
    expect(content).toContain("BAHASA INDONESIA");
  });
});

describe("context-window enforcement", () => {
  it("truncation should preserve user-first alternation (Bug B regression)", () => {
    // Build payload with large history that will exceed the 200k budget
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(1500)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(1500)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const history = result.conversationState.history;

    // History must start with userInputMessage (not assistant)
    if (history.length > 0) {
      expect(history[0].userInputMessage).toBeDefined();
      expect(history[0].assistantResponseMessage).toBeUndefined();
    }

    // History must end with assistantResponseMessage
    if (history.length > 0) {
      const last = history[history.length - 1];
      expect(last.assistantResponseMessage).toBeDefined();
    }

    // History must alternate: user, assistant, user, assistant...
    for (let i = 0; i < history.length; i++) {
      if (i % 2 === 0) {
        expect(history[i].userInputMessage).toBeDefined();
      } else {
        expect(history[i].assistantResponseMessage).toBeDefined();
      }
    }
  });

  it("should use dynamic maxOutputTokens based on model family", () => {
    const body = { messages: [{ role: "user", content: "test" }] };

    const opusResult = buildKiroPayload("claude-opus-4.8", body, true, {});
    expect(opusResult.inferenceConfig.maxTokens).toBe(32000);

    const haikuResult = buildKiroPayload("claude-haiku-4.5", body, true, {});
    expect(haikuResult.inferenceConfig.maxTokens).toBe(8192);

    const sonnetResult = buildKiroPayload("claude-sonnet-4.5", body, true, {});
    expect(sonnetResult.inferenceConfig.maxTokens).toBe(16384);
  });
});

describe("getModelContextConfig - Opus 1M context window", () => {
  it("Opus 4.8 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.8");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.7 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.7");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.6 uses 1M context window", () => {
    const config = getModelContextConfig("claude-opus-4.6");
    expect(config.maxInputTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.5 stays at 200k (no 1M SKU upstream)", () => {
    const config = getModelContextConfig("claude-opus-4.5");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(32000);
  });

  it("Opus 4.5 with thinking+agentic suffix stays at 200k", () => {
    const config = getModelContextConfig("claude-opus-4.5-thinking-agentic");
    expect(config.maxInputTokens).toBe(200000);
  });

  it("Opus with -thinking suffix still uses 1M", () => {
    const config = getModelContextConfig("claude-opus-4.8-thinking");
    expect(config.maxInputTokens).toBe(1000000);
  });

  it("Opus with -agentic suffix still uses 1M", () => {
    const config = getModelContextConfig("claude-opus-4.7-agentic");
    expect(config.maxInputTokens).toBe(1000000);
  });

  it("Sonnet still uses 200k (not affected by Opus change)", () => {
    const config = getModelContextConfig("claude-sonnet-4.6");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(16384);
  });

  it("Haiku still uses 200k (not affected by Opus change)", () => {
    const config = getModelContextConfig("claude-haiku-4.5");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(8192);
  });

  it("Unknown model defaults to 200k (Sonnet-like)", () => {
    const config = getModelContextConfig("some-other-model");
    expect(config.maxInputTokens).toBe(200000);
    expect(config.maxOutputTokens).toBe(16384);
  });
});

describe("Opus 1M context - truncation threshold is higher", () => {
  it("Opus should NOT truncate a ~500k token conversation", () => {
    // ~500k tokens = ~1.75M chars at 3.5 chars/token
    // With 200k window, this would truncate. With 1M, it should NOT.
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(5000)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(5000)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    // This payload is ~200 turns * 10k chars = ~2M chars = ~571k tokens
    // Should NOT truncate under a 1M window (968k budget = 1M - 32k output)
    const result = buildKiroPayload("claude-opus-4.7", body, true, {});
    const history = result.conversationState.history;

    // With 1M, all 200 history pairs should be preserved (400 entries)
    expect(history.length).toBe(400);
  });

  it("Haiku SHOULD truncate the same ~500k token conversation (200k window)", () => {
    const msgs = [];
    for (let i = 0; i < 200; i++) {
      msgs.push({ role: "user", content: `Q${i}: ${"X".repeat(5000)}` });
      msgs.push({ role: "assistant", content: `A${i}: ${"Y".repeat(5000)}` });
    }
    msgs.push({ role: "user", content: "final question" });

    const body = { messages: msgs };
    const result = buildKiroPayload("claude-haiku-4.5", body, true, {});
    const history = result.conversationState.history;

    // With 200k window, significant truncation should occur
    expect(history.length).toBeLessThan(400);
    // But still some history preserved
    expect(history.length).toBeGreaterThan(0);
  });
});

describe("1M variant default routing (agentic / thinking / agentic+thinking)", () => {
  const body = { messages: [{ role: "user", content: "hi" }] };
  const cases = [
    ["claude-opus-4.8-agentic", "claude-opus-4.8"],
    ["claude-opus-4.8-thinking", "claude-opus-4.8"],
    ["claude-opus-4.8-thinking-agentic", "claude-opus-4.8"],
    ["claude-opus-4.7-thinking-agentic", "claude-opus-4.7"],
    ["claude-opus-4.6-thinking-agentic", "claude-opus-4.6"],
  ];
  for (const [variant, upstream] of cases) {
    it(`${variant} -> 1M context + valid upstream "${upstream}" (no invalid suffix)`, () => {
      expect(getModelContextConfig(variant).maxInputTokens).toBe(1000000);
      const payload = buildKiroPayload(variant, body, true, {});
      expect(payload._kiroUpstreamModel).toBe(upstream);
      expect(payload._kiroUpstreamModel).not.toContain("-thinking");
      expect(payload._kiroUpstreamModel).not.toContain("-agentic");
    });
  }

  it("non-1M variant (sonnet-4.5-thinking-agentic) stays 200k with valid upstream", () => {
    expect(getModelContextConfig("claude-sonnet-4.5-thinking-agentic").maxInputTokens).toBe(200000);
    const payload = buildKiroPayload("claude-sonnet-4.5-thinking-agentic", body, true, {});
    expect(payload._kiroUpstreamModel).toBe("claude-sonnet-4.5");
  });

  it("opus-4.5 variant stays 200k (not a 1M SKU) with valid upstream", () => {
    expect(getModelContextConfig("claude-opus-4.5-thinking-agentic").maxInputTokens).toBe(200000);
    const payload = buildKiroPayload("claude-opus-4.5-thinking-agentic", body, true, {});
    expect(payload._kiroUpstreamModel).toBe("claude-opus-4.5");
  });
});
