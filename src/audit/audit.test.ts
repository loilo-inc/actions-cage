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
      users: {
        getAuthenticated: vi.fn(),
      },
      issues: {
        listForRepo: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
        listComments: vi.fn(),
        createComment: vi.fn(),
        updateComment: vi.fn(),
        getLabel: vi.fn(),
        createLabel: vi.fn(),
      },
    },
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
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "bot" },
    });
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.create.mockResolvedValue({
      data: { number: 12, html_url: "https://example.com/issues/12" },
    });
    mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });
    mockOctokit.rest.issues.updateComment.mockResolvedValue({ data: {} });
    mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.getLabel.mockResolvedValue({ data: {} });
    mockOctokit.rest.issues.createLabel.mockResolvedValue({ data: {} });
  });

  it("renders markdown summary", () => {
    const md = renderAuditSummaryMarkdown(sample as AuditResult);
    expect(md).toContain("## Scan Summary");
    expect(md).toContain("## Vulnerabilities");
    expect(md).toContain("CRITICAL");
  });

  it("executes audit and creates issue/comment", async () => {
    const result = await executeAudit(["--region", "us-west-2", "ctx"]);
    expect(result.summary.total_count).toBe(sample.summary.total_count);

    await audit({
      args: ["--region", "us-west-2", "ctx"],
      issue: { owner: "o", repo: "r", token: "t", title: "t" },
    });

    expect(mockOctokit.rest.users.getAuthenticated).toHaveBeenCalled();
    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({ labels: "canarycage", creator: "bot" }),
    );
    expect(mockOctokit.rest.issues.getLabel).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      name: "canarycage",
    });
    expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["canarycage"] }),
    );
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "o", repo: "r", issue_number: 12 }),
    );
    expect(mockOctokit.request).toHaveBeenCalledWith(
      "PUT /repos/{owner}/{repo}/issues/{issue_number}/pin",
      expect.objectContaining({ owner: "o", repo: "r", issue_number: 12 }),
    );
  });

  it("updates existing service comment", async () => {
    const existingIssue = {
      number: 12,
      title: "t",
      state: "open",
      labels: ["canarycage"],
      html_url: "https://example.com/issues/12",
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [
        {
          id: 99,
          body: "<!-- cage-audit:service=example-service --> old",
        },
      ],
    });

    await audit({
      args: ["--region", "us-west-2", "ctx"],
      issue: { owner: "o", repo: "r", token: "t", title: "t" },
    });

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    );
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("fails when existing issue is closed", async () => {
    const existingIssue = {
      number: 12,
      title: "t",
      state: "closed",
      labels: ["canarycage"],
      html_url: "https://example.com/issues/12",
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    await expect(
      audit({
        args: ["--region", "us-west-2", "ctx"],
        issue: { owner: "o", repo: "r", token: "t", title: "t" },
      }),
    ).rejects.toThrow("is not open");
  });

  it("fails when existing issue lacks canarycage label", async () => {
    const existingIssue = {
      number: 12,
      title: "t",
      state: "open",
      labels: ["other"],
      html_url: "https://example.com/issues/12",
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    await expect(
      audit({
        args: ["--region", "us-west-2", "ctx"],
        issue: { owner: "o", repo: "r", token: "t", title: "t" },
      }),
    ).rejects.toThrow("does not have canarycage label");
  });

  it("creates label when missing", async () => {
    mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 });

    await audit({
      args: ["--region", "us-west-2", "ctx"],
      issue: { owner: "o", repo: "r", token: "t", title: "t" },
    });

    expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "canarycage" }),
    );
  });
});
