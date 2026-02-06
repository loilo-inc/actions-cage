import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommentBody } from "../markdown";
import type { AuditResult } from "../types";
const resolve = (path: string) =>
  join(dirname(fileURLToPath(import.meta.url)), path);

const files = ["audit-ok.json", "audit-with-vulns.json"];
for (const file of files) {
  const samplePath = resolve(file);
  const data = JSON.parse(await readFile(samplePath, "utf-8")) as AuditResult;
  await writeFile(
    resolve(file.replace(".json", ".md")),
    buildCommentBody(data),
  );
}
