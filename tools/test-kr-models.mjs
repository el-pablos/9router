#!/usr/bin/env node
// Parallel tester for kr/* thinking|agentic|thinking-agentic models.
// Accurate verification: concurrency pool + retry-once on transient upstream errors.
import fs from 'fs';

const KEY = process.env.KR_KEY || '';
const BASE = process.env.KR_BASE || 'http://127.0.0.1:20129';
const URL = BASE.replace(/\/$/, '') + '/v1/chat/completions';
const CONCURRENCY = Number(process.env.KR_CONC || 5);
const MAX_TOKENS = Number(process.env.KR_MAXTOK || 4000);
const TIMEOUT_MS = Number(process.env.KR_TIMEOUT || 300000);
const PROGRESS = process.env.KR_PROGRESS || '/tmp/kr-progress.log';
const OUT = process.env.KR_OUT || '/tmp/kr-results.json';
const PROMPT = process.env.KR_PROMPT ||
  'Tulis satu fungsi TypeScript lengkap bernama parseDuration(input: string): number yang mengubah string durasi seperti "1h30m", "45s", "2d" menjadi total detik. Sertakan: tipe/regex parsing, error untuk input invalid, dan 6 contoh unit test inline format vitest (import.meta.vitest). Output kode TypeScript saja.';

const modelsFile = process.argv[2] || '/tmp/target_models.txt';
const models = fs.readFileSync(modelsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);

const UPSTREAM_ERR = /Encountered an unexpected error|\[9router\] Respons Kiro terhenti|Percakapan terlalu panjang|provider may not handle/i;

function log(line) { fs.appendFileSync(PROGRESS, line + '\n'); }

async function callModel(model, attempt = 1) {
  const body = JSON.stringify({ model, messages: [{ role: 'user', content: PROMPT }], max_tokens: MAX_TOKENS, temperature: 0, stream: false });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(URL, { method: 'POST', headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body, signal: ctrl.signal });
    const txt = await res.text();
    clearTimeout(timer);
    const ms = Date.now() - t0;
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    const content = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    const finish = (j && j.choices && j.choices[0] && j.choices[0].finish_reason) || null;
    const usage = (j && j.usage) || null;
    const upstreamErr = UPSTREAM_ERR.test(content) || UPSTREAM_ERR.test(txt);
    const empty = !content || content.trim().length === 0;
    if ((res.status >= 500 || res.status === 429 || upstreamErr) && attempt < 2) {
      log(`  retry ${model} (attempt ${attempt} status=${res.status} upstreamErr=${upstreamErr})`);
      await new Promise(r => setTimeout(r, 4000));
      return callModel(model, attempt + 1);
    }
    const ok = res.status === 200 && !!finish && !upstreamErr && !empty;
    return { model, attempt, status: res.status, finish, ms, chars: content.length, lines: content.split('\n').length, usage, upstreamErr, empty, ok, sample: content.slice(0, 90).replace(/\n/g, ' ') };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    if (attempt < 2) { log(`  retry ${model} (attempt ${attempt} threw ${e.message})`); await new Promise(r => setTimeout(r, 4000)); return callModel(model, attempt + 1); }
    return { model, attempt, status: 0, finish: null, ms, chars: 0, lines: 0, usage: null, upstreamErr: false, empty: true, ok: false, err: String(e.message || e) };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      const r = out[idx];
      log(`[${new Date().toISOString()}] (${idx + 1}/${items.length}) ${r.model} ok=${r.ok} status=${r.status} finish=${r.finish} ms=${r.ms} chars=${r.chars}${r.err ? ' err=' + r.err : ''}`);
    }
  });
  await Promise.all(workers);
  return out;
}

(async () => {
  const start = Date.now();
  fs.writeFileSync(PROGRESS, `START ${new Date().toISOString()} models=${models.length} conc=${CONCURRENCY} maxtok=${MAX_TOKENS} timeout=${TIMEOUT_MS}ms\nURL=${URL}\n`);
  const results = await pool(models, CONCURRENCY, callModel);
  const pass = results.filter(r => r.ok).length;
  const out = { meta: { total: models.length, pass, fail: results.length - pass, conc: CONCURRENCY, maxTokens: MAX_TOKENS, durationMs: Date.now() - start, ts: new Date().toISOString(), url: URL }, results };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  log(`DONE pass=${pass} fail=${results.length - pass} total=${results.length} dur=${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`DONE pass=${pass} fail=${results.length - pass} total=${results.length} -> ${OUT}`);
})();
