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
  findIssueByTitle,
  renderAuditSummaryMarkdown,
  runCageAudit,
} from "./audit";
import { AuditResult } from "./types";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

const resolve = (path: string) =>
  join(dirname(fileURLToPath(import.meta.url)), path);

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

const readSample = async (file: string): Promise<AuditResult> => {
  const data = await readFile(resolve(file), "utf-8");
  return JSON.parse(data) as AuditResult;
};

describe("audit", () => {
  let withVulnResult: AuditResult;
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeAll(async () => {
    withVulnResult = await readSample("testdata/audit-with-vulns.json");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
    vi.mocked(exec.getExecOutput).mockImplementation(async (_cmd, _args) => {
      const json = JSON.stringify(withVulnResult);
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

  it("executes audit and creates issue/comment", async () => {
    const result = await executeAudit(["--region", "us-west-2", "ctx"]);
    expect(result.summary.total_count).toBe(withVulnResult.summary.total_count);

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

  it("creates new issue when existing is closed", async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [],
    });
    await audit({
      args: ["--region", "us-west-2", "ctx"],
      issue: { owner: "o", repo: "r", token: "t", title: "t" },
    });

    expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ["canarycage"] }),
    );
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
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

    await ensureLabel({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      name: "canarycage",
    });

    expect(mockOctokit.rest.issues.getLabel).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      name: "canarycage",
    });
    expect(mockOctokit.rest.issues.createLabel).not.toHaveBeenCalled();
  });

  it("creates label when not found (404)", async () => {
    mockOctokit.rest.issues.getLabel.mockRejectedValue({ status: 404 });

    await ensureLabel({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      name: "test-label",
    });

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
      ensureLabel({
        github: mockOctokit as any,
        owner: "o",
        repo: "r",
        name: "test-label",
      }),
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

describe("findIssueByTitle", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
    mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
      data: { login: "bot" },
    });
  });

  it("returns issue when found on first page", async () => {
    const issue = {
      number: 1,
      title: "Test Issue",
      pull_request: undefined,
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [issue],
    });

    const result = await findIssueByTitle({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      title: "Test Issue",
    });

    expect(result).toEqual(issue);
    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1);
  });

  it("returns null when issue not found", async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [{ number: 1, title: "Other Issue", pull_request: undefined }],
    });

    const result = await findIssueByTitle({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      title: "Test Issue",
    });

    expect(result).toBeNull();
  });

  it("skips pull requests", async () => {
    const pr = {
      number: 1,
      title: "Test Issue",
      pull_request: { url: "..." },
    };
    const issue = {
      number: 2,
      title: "Test Issue",
      pull_request: undefined,
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [pr, issue],
    });

    const result = await findIssueByTitle({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      title: "Test Issue",
    });

    expect(result).toEqual(issue);
  });

  it("paginates through multiple pages", async () => {
    const issue = {
      number: 101,
      title: "Test Issue",
      pull_request: undefined,
    };
    mockOctokit.rest.issues.listForRepo
      .mockResolvedValueOnce({
        data: Array(100)
          .fill(null)
          .map((_, i) => ({
            number: i,
            title: "Other",
            pull_request: undefined,
          })),
      })
      .mockResolvedValueOnce({
        data: [issue],
      });

    const result = await findIssueByTitle({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      title: "Test Issue",
    });

    expect(result).toEqual(issue);
    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledTimes(2);
    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenNthCalledWith(2, {
      owner: "o",
      repo: "r",
      state: "open",
      per_page: 100,
      page: 2,
      labels: "canarycage",
      creator: "bot",
    });
  });

  it("stops pagination when page has fewer results", async () => {
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [{ number: 1, title: "Other", pull_request: undefined }],
    });

    const result = await findIssueByTitle({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      title: "Test Issue",
    });

    expect(result).toBeNull();
    expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledTimes(1);
  });
});

describe("findIssueComment", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  let withVulnResult: AuditResult;

  beforeAll(async () => {
    withVulnResult = await readSample("testdata/audit-with-vulns.json");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it("returns comment when found on first page", async () => {
    const comment = {
      id: 123,
      body: "<!-- cage-audit:service=example-service --> content",
    };
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [comment],
    });

    const { findIssueComment } = await import("./audit");
    const result = await findIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(result).toEqual(comment);
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledTimes(1);
  });

  it("returns null when comment not found", async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 123, body: "no marker here" }],
    });

    const { findIssueComment } = await import("./audit");
    const result = await findIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(result).toBeNull();
  });

  it("paginates through multiple pages", async () => {
    const comment = {
      id: 999,
      body: "<!-- cage-audit:service=example-service --> found",
    };
    mockOctokit.rest.issues.listComments
      .mockResolvedValueOnce({
        data: Array(100)
          .fill(null)
          .map((_, i) => ({ id: i, body: `comment ${i}` })),
      })
      .mockResolvedValueOnce({
        data: [comment],
      });

    const { findIssueComment } = await import("./audit");
    const result = await findIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(result).toEqual(comment);
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledTimes(2);
    expect(mockOctokit.rest.issues.listComments).toHaveBeenNthCalledWith(2, {
      owner: "o",
      repo: "r",
      issue_number: 42,
      per_page: 100,
      page: 2,
    });
  });

  it("stops pagination when page has fewer results", async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 1, body: "no marker" }],
    });

    const { findIssueComment } = await import("./audit");
    const result = await findIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(result).toBeNull();
    expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledTimes(1);
  });

  it("ignores comments with non-string body", async () => {
    const comment = {
      id: 456,
      body: "<!-- cage-audit:service=example-service --> found",
    };
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 123, body: null }, comment],
    });

    const { findIssueComment } = await import("./audit");
    const result = await findIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(result).toEqual(comment);
  });
});
