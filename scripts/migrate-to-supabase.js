import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { readDocument, supabaseEnabled, writeDocument } from "../server/persistence.js";

if (!supabaseEnabled()) throw new Error("请先配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY");
const dryRun = process.argv.includes("--dry-run"); const dataDir = path.resolve("server/data");
const documents = [
  ["members", path.join(dataDir, "members.json")],
  ["progress:legacy", path.join(dataDir, "progress.json")],
  ["vocabulary:legacy", path.join(dataDir, "vocabulary.json")],
  ["journal:legacy", path.join(dataDir, "knowledge-journal.json")]
];

try {
  for (const userId of await readdir(path.join(dataDir, "users"))) {
    documents.push([`progress:${userId}`, path.join(dataDir, "users", userId, "progress.json")]);
    documents.push([`vocabulary:${userId}`, path.join(dataDir, "users", userId, "vocabulary.json")]);
    documents.push([`journal:${userId}`, path.join(dataDir, "users", userId, "knowledge-journal.json")]);
  }
} catch (error) { if (error.code !== "ENOENT") throw error; }

let migrated = 0; const skipped = [];
for (const [key, file] of documents) {
  try {
    const value = JSON.parse(await readFile(file, "utf8"));
    if (!dryRun) { await writeDocument(key, value, file); const verified = await readDocument(key, null, file); if (verified === null) throw new Error("写入后读取验证失败"); }
    migrated++;
  } catch (error) { if (error.code === "ENOENT") skipped.push(key); else throw error; }
}
console.log(JSON.stringify({ dryRun, migrated, skipped, message: dryRun ? "只检查了本地数据，尚未写入 Supabase" : "迁移完成且已逐项读取验证；本地文件仍保留为备份" }, null, 2));

