import { readFile } from "fs/promises";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it } from "vitest";
import { renderAuditSummaryMarkdown } from "./markdown";
import type { AuditResult } from "./types";

async function readSample(path: string): Promise<AuditResult> {
  const data = await readFile(
    resolve(fileURLToPath(import.meta.url), "..", path),
    "utf-8",
  );
  return JSON.parse(data) as AuditResult;
}

describe("renderAuditSummaryMarkdown", () => {
  let okResult: AuditResult;
  let withVulnResult: AuditResult;
  beforeAll(async () => {
    [withVulnResult, okResult] = await Promise.all([
      readSample("testdata/audit-with-vulns.json"),
      readSample("testdata/audit-ok.json"),
    ]);
  });
  it("renders markdown summary", async () => {
    const md = renderAuditSummaryMarkdown(okResult);
    await expect(md).toMatchFileSnapshot(resolve("testdata/audit-ok.md"));
  });
  it("renders markdown with vulnerabilities", async () => {
    const md = renderAuditSummaryMarkdown(withVulnResult);
    await expect(md).toMatchFileSnapshot(
      resolve("testdata/audit-with-vulns.md"),
    );
  });
});
