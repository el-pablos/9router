#!/usr/bin/env node
// External-host tester for kr/* models against PUBLIC proxy.tams.codes.
// Hang-focused: pass = completed (HTTP200 + finish + non-empty + no upstream-error). Flags hangs/timeouts explicitly.
import fs from 'fs';
const KEY = process.env.KR_KEY || '';
const URL = (process.env.KR_BASE || 'https://proxy.tams.codes/v1').replace(/\/$/, '') + '/chat/completions';
const CONC = Number(process.env.KR_CONC || 5);
const MAXTOK = Number(process.env.KR_MAXTOK || 4000);
const TIMEOUT = Number(process.env.KR_TIMEOUT || 300000);
const STREAM = process.env.KR_STREAM === '1';
const PROG = process.env.KR_PROGRESS || '/tmp/cihuy-prog.log';
const OUT = process.env.KR_OUT || '/tmp/cihuy-results.json';
const PROMPT = process.env.KR_PROMPT || 'Tulis fungsi TypeScript parseDuration(input:string):number yang ubah "1h30m"/"45s"/"2d" jadi detik, plus error handling dan 6 unit test vitest inline. Kode saja.';
const models = fs.readFileSync(process.argv[2] || '/tmp/target_models.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
const UPERR = /Encountered an unexpected error|Respons Kiro terhenti|Percakapan terlalu panjang|provider may not handle/i;
const log = l => fs.appendFileSync(PROG, l + '\n');

async function call(model, attempt = 1) {
  const body = JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: MAXTOK, temperature: 0, stream: STREAM });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const t0 = Date.now();
  try {
    const res = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body, signal: ctrl.signal });
    let content = '', finish = null, usage = null, doneSeen = false, txt = '';
    if (STREAM) {
      const reader = res.body.getReader(); const dec = new TextDecoder();
      while (true) { const { done, value } = await reader.read(); if (done) break; const c = dec.decode(value); txt += c;
        for (const line of c.split('\n')) { if (!line.startsWith('data:')) continue; const d = line.slice(5).trim(); if (d === '[DONE]') { doneSeen = true; continue; } try { const j = JSON.parse(d); const dc = j.choices && j.choices[0]; if (dc && dc.delta && dc.delta.content) content += dc.delta.content; if (dc && dc.finish_reason) finish = dc.finish_reason; if (j.usage) usage = j.usage; } catch (e) {} } }
    } else { txt = await res.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {} const dc = j && j.choices && j.choices[0]; content = (dc && dc.message && dc.message.content) || ''; finish = (dc && dc.finish_reason) || null; usage = (j && j.usage) || null; }
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const upstreamErr = UPERR.test(content) || UPERR.test(txt);
    const empty = !content || content.trim().length === 0;
    if ((res.status >= 500 || res.status === 429 || upstreamErr) && attempt < 2) { log(`  retry ${model} (a${attempt} status=${res.status})`); await new Promise(r => setTimeout(r, 4000)); return call(model, attempt + 1); }
    const ok = res.status === 200 && !!finish && !upstreamErr && !empty && (STREAM ? doneSeen : true);
    return { model, attempt, status: res.status, finish, ms, chars: content.length, usage, upstreamErr, empty, doneSeen, ok, hang: false };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const isTimeout = /abort/i.test(String(e.message || e));
    if (!isTimeout && attempt < 2) { log(`  retry ${model} (a${attempt} threw ${e.message})`); await new Promise(r => setTimeout(r, 4000)); return call(model, attempt + 1); }
    return { model, attempt, status: 0, finish: null, ms, chars: 0, usage: null, upstreamErr: false, empty: true, doneSeen: false, ok: false, hang: isTimeout, err: String(e.message || e) };
  }
}
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); const r = out[idx]; log(`[${new Date().toISOString()}] (${idx + 1}/${items.length}) ${r.model} ok=${r.ok} hang=${r.hang} status=${r.status} finish=${r.finish} ms=${r.ms} chars=${r.chars}${r.err ? ' err=' + r.err : ''}`); } }));
  return out; }
(async () => { const start = Date.now(); fs.writeFileSync(PROG, `START ${new Date().toISOString()} models=${models.length} conc=${CONC} stream=${STREAM} maxtok=${MAXTOK} timeout=${TIMEOUT}ms\nURL=${URL}\n`);
  const results = await pool(models, CONC, call); const pass = results.filter(r => r.ok).length; const hangs = results.filter(r => r.hang).length;
  fs.writeFileSync(OUT, JSON.stringify({ meta: { total: models.length, pass, fail: results.length - pass, hangs, stream: STREAM, durationMs: Date.now() - start, ts: new Date().toISOString(), url: URL }, results }, null, 2));
  log(`DONE pass=${pass} fail=${results.length - pass} hangs=${hangs} dur=${((Date.now() - start) / 1000).toFixed(1)}s`); console.log(`DONE pass=${pass} fail=${results.length - pass} hangs=${hangs}`); })();
