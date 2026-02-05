import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  audit,
  executeAudit,
  renderAuditSummaryMarkdown,
  type AuditResult,
} from "./audit";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

vi.mock("@actions/github");
vi.mock("@actions/exec");

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

  const samplePath = join(dirname(fileURLToPath(import.meta.url)), "sample.json");
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
