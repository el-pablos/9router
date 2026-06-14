import Database from "better-sqlite3";
import fs from "node:fs";

const DB_PATH = "/var/lib/9router/db/data.sqlite";
const BACKUP_PATH = "/tmp/9router-backup.json";

function sj(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

const raw = fs.readFileSync(BACKUP_PATH, "utf-8");
const data = JSON.parse(raw);
console.log("Backup keys:", Object.keys(data));

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec("BEGIN IMMEDIATE");

let errors = 0;

function run(sql, ...args) {
  try {
    db.prepare(sql).run(...args);
  } catch (e) {
    console.warn("WARN:", e.message.split("\n")[0]);
    errors++;
  }
}

// settings
if (data.settings) {
  run(`INSERT OR REPLACE INTO settings(id, data) VALUES(1, ?)`, [sj(data.settings)]);
  console.log("Imported settings");
}

// providerConnections
if (data.providerConnections?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO providerConnections(id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const c of data.providerConnections) {
    const { id, provider, authType, name, email, priority, isActive, createdAt, updatedAt, ...rest } = c;
    stmt.run([id, provider, authType || "oauth", name || null, email || null, priority || null, isActive === false ? 0 : 1, sj(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]);
  }
  console.log(`Imported ${data.providerConnections.length} providerConnections`);
}

// providerNodes
if (data.providerNodes?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO providerNodes(id, type, name, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`);
  for (const n of data.providerNodes) {
    const { id, type, name, createdAt, updatedAt, ...rest } = n;
    stmt.run([id, type || null, name || null, sj(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]);
  }
  console.log(`Imported ${data.providerNodes.length} providerNodes`);
}

// proxyPools
if (data.proxyPools?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO proxyPools(id, isActive, testStatus, data, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`);
  for (const p of data.proxyPools) {
    const { id, isActive, testStatus, createdAt, updatedAt, ...rest } = p;
    stmt.run([id, isActive === false ? 0 : 1, testStatus || "unknown", sj(rest), createdAt || new Date().toISOString(), updatedAt || new Date().toISOString()]);
  }
  console.log(`Imported ${data.proxyPools.length} proxyPools`);
}

// apiKeys
if (data.apiKeys?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO apiKeys(id, key, name, machineId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, ?)`);
  for (const k of data.apiKeys) {
    stmt.run([k.id, k.key, k.name || null, k.machineId || null, k.isActive === false ? 0 : 1, k.createdAt || new Date().toISOString()]);
  }
  console.log(`Imported ${data.apiKeys.length} apiKeys`);
}

// combos
if (data.combos?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO combos(id, name, kind, models, createdAt, updatedAt) VALUES(?, ?, ?, ?, ?, ?)`);
  for (const c of data.combos) {
    stmt.run([c.id, c.name, c.kind || null, sj(c.models || []), c.createdAt || new Date().toISOString(), c.updatedAt || new Date().toISOString()]);
  }
  console.log(`Imported ${data.combos.length} combos`);
}

// kv entries
const kvStmt = db.prepare(`INSERT OR REPLACE INTO kv(scope, key, value) VALUES(?, ?, ?)`);
if (data.modelAliases) {
  for (const [alias, model] of Object.entries(data.modelAliases)) {
    kvStmt.run(["modelAliases", alias, sj(model)]);
  }
  console.log(`Imported ${Object.keys(data.modelAliases).length} modelAliases`);
}
if (data.customModels?.length) {
  for (const m of data.customModels) {
    const k = `${m.providerAlias}|${m.id}|${m.type || "llm"}`;
    kvStmt.run(["customModels", k, sj(m)]);
  }
  console.log(`Imported ${data.customModels.length} customModels`);
}
if (data.mitmAlias) {
  for (const [tool, mappings] of Object.entries(data.mitmAlias)) {
    kvStmt.run(["mitmAlias", tool, sj(mappings || {})]);
  }
  console.log(`Imported ${Object.keys(data.mitmAlias).length} mitmAlias`);
}
if (data.pricing) {
  for (const [provider, models] of Object.entries(data.pricing)) {
    kvStmt.run(["pricing", provider, sj(models || {})]);
  }
  console.log(`Imported ${Object.keys(data.pricing).length} pricing entries`);
}

// usageHistory
if (data.history?.length) {
  const stmt = db.prepare(`INSERT INTO usageHistory(timestamp, provider, model, connectionId, apiKey, endpoint, promptTokens, completionTokens, cost, status, tokens, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const e of data.history) {
    const t = e.tokens || {};
    stmt.run([
      e.timestamp || new Date().toISOString(),
      e.provider || null, e.model || null, e.connectionId || null, e.apiKey || null, e.endpoint || null,
      t.prompt_tokens || t.input_tokens || 0,
      t.completion_tokens || t.output_tokens || 0,
      e.cost || 0,
      e.status || "ok",
      sj(t),
      sj({}),
    ]);
  }
  console.log(`Imported ${data.history.length} usageHistory records`);
}

// usageDaily
if (data.dailySummary) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO usageDaily(dateKey, data) VALUES(?, ?)`);
  for (const [dateKey, day] of Object.entries(data.dailySummary)) {
    stmt.run([dateKey, sj(day)]);
  }
  console.log(`Imported ${Object.keys(data.dailySummary).length} usageDaily records`);
}

// totalRequestsLifetime
if (typeof data.totalRequestsLifetime === "number") {
  run(`INSERT OR REPLACE INTO _meta(key, value) VALUES('totalRequestsLifetime', ?)`, [String(data.totalRequestsLifetime)]);
  console.log(`Imported totalRequestsLifetime: ${data.totalRequestsLifetime}`);
}

// disabled models
if (data.disabled) {
  for (const [provider, ids] of Object.entries(data.disabled)) {
    kvStmt.run(["disabledModels", provider, sj(ids || [])]);
  }
  console.log(`Imported ${Object.keys(data.disabled).length} disabled model entries`);
}

// requestDetails
if (data.records?.length) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO requestDetails(id, timestamp, provider, model, connectionId, status, data) VALUES(?, ?, ?, ?, ?, ?, ?)`);
  for (const r of data.records) {
    stmt.run([r.id, r.timestamp || new Date().toISOString(), r.provider || null, r.model || null, r.connectionId || null, r.status || null, sj(r)]);
  }
  console.log(`Imported ${data.records.length} requestDetails records`);
}

db.exec("COMMIT");
db.close();

console.log("\n===IMPORT DONE===");
console.log("Errors:", errors);
