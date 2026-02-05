import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  audit,
  ensureIssue,
  ensureLabel,
  executeAudit,
  renderAuditSummaryMarkdown,
  runCageAudit,
} from "./audit";
import { AuditResult } from "./types";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

const makeMockOctokit = () => {
  return {
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
};

describe("audit", () => {
  let sample: AuditResult;
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeAll(async () => {
    const samplePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "testdata/audit.json",
    );
    sample = JSON.parse(await readFile(samplePath, "utf-8")) as AuditResult;
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
    vi.mocked(exec.getExecOutput).mockImplementation(async (_cmd, _args) => {
      const json = JSON.stringify(sample);
      return { exitCode: 0, stdout: json, stderr: "" };
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
    expect(md).toContain("|CONTAINER");
    expect(md).toContain("## CRITICAL");
    expect(md).toContain("## Total");
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

describe("ensureLabel", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });
  it("ensures label exists when it already exists", async () => {
    mockOctokit.rest.issues.getLabel.mockResolvedValue({ data: {} });

    await ensureLabel(mockOctokit as any, "o", "r", "canarycage");

    expect(mockOctokit.rest.issues.getLabel).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      name: "canarycage",
    });
    expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });

  it("creates label when not found (404)", async () => {
    mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 });

    await ensureLabel(mockOctokit as any, "o", "r", "test-label");

    expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      name: "test-label",
      color: "fbca04",
      description: "cage audit reports",
    });
  });

  it("throws error when getLabel fails with non-404 status", async () => {
    mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 500 });

    await expect(
      ensureLabel(mockOctokit as any, "o", "r", "test-label"),
    ).rejects.toEqual({ status: 500 });

    expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });
});

describe("ensureIssue", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it("returns existing open issue with canarycage label", async () => {
    const existingIssue = {
      number: 42,
      title: "Test Issue",
      state: "open",
      labels: ["canarycage"],
      html_url: "https://example.com/issues/42",
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "bot" },
    });
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    const result = await ensureIssue(mockOctokit as any, {
      owner: "o",
      repo: "r",
      title: "Test Issue",
      token: "t",
    });

    expect(result).toEqual(existingIssue);
  });

  it("creates new issue when no existing issue found", async () => {
    const createdIssue = {
      number: 99,
      title: "New Issue",
      state: "open",
      labels: ["canarycage"],
      html_url: "https://example.com/issues/99",
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "bot" },
    });
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.create.mockResolvedValue({ data: createdIssue });

    const result = await ensureIssue(mockOctokit as any, {
      owner: "o",
      repo: "r",
      title: "New Issue",
      token: "t",
    });

    expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "o",
        repo: "r",
        title: "New Issue",
        labels: ["canarycage"],
      }),
    );
    expect(result).toEqual(createdIssue);
  });

  it("handles label as object with name property", async () => {
    const existingIssue = {
      number: 42,
      title: "Test Issue",
      state: "open",
      labels: [{ name: "canarycage" }],
      html_url: "https://example.com/issues/42",
    };
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "bot" },
    });
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    const result = await ensureIssue(mockOctokit as any, {
      owner: "o",
      repo: "r",
      title: "Test Issue",
      token: "t",
    });

    expect(result).toEqual(existingIssue);
  });
});

describe("runCageAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("executes cage audit and returns JSON output", async () => {
    vi.mocked(exec.getExecOutput).mockImplementation(async (_cmd, _args) => {
      const json = JSON.stringify({ test: "data" });
      return { exitCode: 0, stdout: json, stderr: "" };
    });

    const raw = await runCageAudit(["--region", "us-west-2", "ctx"]);
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({ test: "data" });
  });

  it("throws error when cage audit fails", async () => {
    vi.mocked(exec.getExecOutput).mockImplementation(async (_cmd, _args) => {
      const errMsg = "Some error occurred";
      throw new Error(errMsg);
    });

    await expect(
      runCageAudit(["--region", "us-west-2", "ctx"]),
    ).rejects.toThrow("Some error occurred");
  });
});

describe("renderAuditSummaryMarkdown", () => {
  it("renders markdown with vulnerabilities", () => {
    const md = renderAuditSummaryMarkdown(sample);
    expect(md).toContain("## Scan Summary");
    expect(md).toContain(`- Region: \`${sample.region}\``);
    expect(md).toContain(`- Cluster: \`${sample.cluster}\``);
    expect(md).toContain(`- Service: \`${sample.service}\``);
    expect(md).toContain(`- Scanned At: \`${sample.scanned_at}\``);
    expect(md).toContain(
      `- Highest Severity: \`${sample.summary.highest_severity}\``,
    );
    expect(md).toContain("| Critical | High | Medium | Low | Info | Total |");
    expect(md).toContain(
      `| ${sample.summary.critical_count} | ${sample.summary.high_count} | ${sample.summary.medium_count} | ${sample.summary.low_count} | ${sample.summary.info_count} | ${sample.summary.total_count} |`,
    );
    expect(md).toContain(`## Vulnerabilities (${sample.summary.total_count})`);
    expect(md).toContain("| Severity | CVE | Package | Version | Containers |");
  });

  it("renders markdown with no vulnerabilities", () => {
    const emptyResult: AuditResult = {
      ...sample,
      vulns: [],
      summary: { ...sample.summary, total_count: 0 },
    };
    const md = renderAuditSummaryMarkdown(emptyResult);
    expect(md).toContain("No vulnerabilities found.");
    expect(md).not.toContain(
      "| Severity | CVE | Package | Version | Containers |",
    );
  });

  it("escapes pipe characters in vulnerability data", () => {
    const resultWithPipes: AuditResult = {
      ...sample,
      vulns: [
        {
          ...sample.vulns[0],
          cve: { ...sample.vulns[0].cve, package_name: "pkg|name" },
        },
      ],
    };
    const md = renderAuditSummaryMarkdown(resultWithPipes);
    expect(md).toContain("pkg\\|name");
  });

  it("escapes newlines in vulnerability data", () => {
    const resultWithNewlines: AuditResult = {
      ...sample,
      vulns: [
        {
          ...sample.vulns[0],
          containers: ["container\nwith\nnewlines"],
        },
      ],
    };
    const md = renderAuditSummaryMarkdown(resultWithNewlines);
    expect(md).toContain("container with newlines");
  });
});
