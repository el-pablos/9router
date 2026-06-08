// KiroExecutor stream-termination behavior (Bug B2: "berhenti gada notif").
//
// Kiro upstream (AWS CodeWhisperer) streams binary EventStream frames. When the
// stream ends WITHOUT a terminal event (messageStopEvent, atau metering+context),
// executor lama tetap menutup dengan finish_reason:"stop" — sehingga klien CLI
// (Claude Code / OpenCode / dll) mengira respons selesai normal padahal terpotong.
// Frame exception upstream juga dibuang diam-diam.
//
// File ini menguji transformEventStreamToSSE secara langsung dengan menyusun frame
// EventStream biner sintetis (sesuai parseEventFrame di executors/kiro.js).
import { describe, it, expect } from "vitest";
import KiroExecutor from "../../open-sse/executors/kiro.js";

const enc = new TextEncoder();

// Susun satu frame AWS EventStream: prelude(12) + headers + payload + CRC(4).
// headers = array of [name, value] string-typed (header type 7).
function buildFrame(headers, payloadObj) {
  let headerLen = 0;
  const encoded = headers.map(([name, value]) => {
    const n = enc.encode(name);
    const v = enc.encode(value);
    headerLen += 1 + n.length + 1 + 2 + v.length;
    return { n, v };
  });
  const payloadBytes =
    payloadObj !== undefined ? enc.encode(JSON.stringify(payloadObj)) : new Uint8Array(0);
  const totalLength = 12 + headerLen + payloadBytes.length + 4;
  const buf = new Uint8Array(totalLength);
  const view = new DataView(buf.buffer);
  view.setUint32(0, totalLength, false);
  view.setUint32(4, headerLen, false);
  view.setUint32(8, 0, false); // prelude CRC (diabaikan parser)
  let off = 12;
  for (const { n, v } of encoded) {
    buf[off++] = n.length;
    buf.set(n, off);
    off += n.length;
    buf[off++] = 7; // string type
    view.setUint16(off, v.length, false);
    off += 2;
    buf.set(v, off);
    off += v.length;
  }
  buf.set(payloadBytes, off);
  // 4 byte CRC terakhir dibiarkan nol (diabaikan parser)
  return buf;
}

function streamFromFrames(frames) {
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(f);
      controller.close();
    },
  });
}

async function runExecutor(frames, model = "claude-sonnet-4.5") {
  const exec = new KiroExecutor();
  const fakeResponse = {
    ok: true,
    status: 200,
    statusText: "OK",
    body: streamFromFrames(frames),
  };
  const out = exec.transformEventStreamToSSE(fakeResponse, model);
  return await out.text();
}

describe("KiroExecutor stream termination (Bug B2: silent stop)", () => {
  it("emits finish_reason 'length' + visible note when the stream ends WITHOUT a terminal event", async () => {
    const frames = [
      buildFrame([[":event-type", "assistantResponseEvent"]], { content: "Hello" }),
    ];
    const text = await runExecutor(frames);
    expect(text).toContain("Hello");
    expect(text).toContain('"finish_reason":"length"');
    expect(text).toContain("terpotong sebelum selesai");
    expect(text).toContain("[DONE]");
  });

  it("surfaces an upstream exception frame instead of dropping it silently", async () => {
    const frames = [
      buildFrame([[":event-type", "assistantResponseEvent"]], { content: "partial" }),
      buildFrame(
        [
          [":message-type", "exception"],
          [":exception-type", "ThrottlingException"],
        ],
        { message: "rate limited" }
      ),
    ];
    const text = await runExecutor(frames);
    expect(text).toContain("Respons Kiro terhenti");
    expect(text).toContain("ThrottlingException");
    expect(text).toContain('"finish_reason":"length"');
  });

  it("normal stream with messageStopEvent still finishes with 'stop' and no truncation note", async () => {
    const frames = [
      buildFrame([[":event-type", "assistantResponseEvent"]], { content: "Done" }),
      buildFrame([[":event-type", "messageStopEvent"]], {}),
    ];
    const text = await runExecutor(frames);
    expect(text).toContain("Done");
    expect(text).toContain('"finish_reason":"stop"');
    expect(text).not.toContain("terpotong sebelum selesai");
  });
});
