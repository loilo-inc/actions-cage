import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audit, executeAudit, renderAuditSummaryMarkdown } from "./audit";
import { AuditResult } from "./types";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

describe("audit", () => {
  const mockOctokit = {
    rest: {
      issues: {
        listForRepo: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    },
    paginate: vi.fn(),
    request: vi.fn(),
  };

  const samplePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "testdata/audit.json",
  );
  const sample = JSON.parse(readFileSync(samplePath, "utf-8")) as AuditResult;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
    vi.mocked(exec.exec).mockImplementation(async (_cmd, _args, opts) => {
      const json = JSON.stringify(sample);
      opts?.listeners?.stdout?.(Buffer.from(json));
      return 0;
    });
    mockOctokit.paginate.mockResolvedValue([]);
    mockOctokit.rest.issues.create.mockResolvedValue({
      data: { number: 12, html_url: "https://example.com/issues/12" },
    });
  });

  it("renders markdown summary", () => {
    const md = renderAuditSummaryMarkdown(sample as AuditResult);
    expect(md).toContain("## Scan Summary");
    expect(md).toContain("## Vulnerabilities");
    expect(md).toContain("CRITICAL");
  });

  it("executes audit and creates issue", async () => {
    const result = await executeAudit(["--region", "us-west-2", "ctx"]);
    expect(result.summary.total_count).toBe(sample.summary.total_count);

    await audit({
      args: ["--region", "us-west-2", "ctx"],
      issue: { owner: "o", repo: "r", token: "t", title: "t" },
    });

    expect(mockOctokit.rest.issues.create).toHaveBeenCalled();
    expect(mockOctokit.request).toHaveBeenCalledWith(
      "PUT /repos/{owner}/{repo}/issues/{issue_number}/pin",
      expect.objectContaining({ owner: "o", repo: "r", issue_number: 12 }),
    );
  });
});
