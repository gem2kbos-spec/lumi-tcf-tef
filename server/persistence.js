import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function supabaseEnabled() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }

function supabaseHeaders(extra = {}) {
  return { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...extra };
}

async function readSupabaseDocument(key, fallback) {
  const endpoint = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/lumi_documents?key=eq.${encodeURIComponent(key)}&select=value&limit=1`;
  const response = await fetch(endpoint, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase 读取失败 (${response.status})：${(await response.text()).slice(0, 300)}`);
  const rows = await response.json(); return rows[0]?.value ?? structuredClone(fallback);
}

async function writeSupabaseDocument(key, value) {
  const endpoint = `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/lumi_documents?on_conflict=key`;
  const response = await fetch(endpoint, { method: "POST", headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error(`Supabase 写入失败 (${response.status})：${(await response.text()).slice(0, 300)}`);
}

async function readLocalDocument(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return structuredClone(fallback); throw error; }
}

async function writeLocalDocument(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2)); await rename(temporary, file);
}

export async function readDocument(key, fallback, localFile) { return supabaseEnabled() ? readSupabaseDocument(key, fallback) : readLocalDocument(localFile, fallback); }
export async function writeDocument(key, value, localFile) { return supabaseEnabled() ? writeSupabaseDocument(key, value) : writeLocalDocument(localFile, value); }

