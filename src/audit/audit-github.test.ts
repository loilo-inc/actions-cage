import * as github from "@actions/github";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addIssueComment,
  ensureIssue,
  ensureLabel,
  findIssueByTitle,
  findIssueComment,
} from "./audit-github";
import { buildCommentMarker } from "./markdown";
import { AuditResult } from "./types";

vi.mock("@actions/github");

const resolve = (path: string) =>
  join(dirname(fileURLToPath(import.meta.url)), path);

const makeMockOctokit = () => {
  return {
    rest: {
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
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    const result = await ensureIssue({
      github: mockOctokit as any,
      params: { owner: "o", repo: "r", title: "Test Issue", token: "t" },
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
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.create.mockResolvedValue({ data: createdIssue });

    const result = await ensureIssue({
      github: mockOctokit as any,
      params: { owner: "o", repo: "r", title: "New Issue", token: "t" },
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
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    const result = await ensureIssue({
      github: mockOctokit as any,
      params: { owner: "o", repo: "r", title: "Test Issue", token: "t" },
    });

    expect(result).toEqual(existingIssue);
  });

  it("throws error when existing issue lacks canarycage label", async () => {
    const existingIssue = {
      number: 42,
      title: "Test Issue",
      state: "open",
      labels: ["other-label"],
      html_url: "https://example.com/issues/42",
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });

    await expect(
      ensureIssue({
        github: mockOctokit as any,
        params: { owner: "o", repo: "r", title: "Test Issue", token: "t" },
      }),
    ).rejects.toThrow("Issue o/r#42 does not have canarycage label.");
  });
});

describe("findIssueByTitle", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
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
      body: `${buildCommentMarker(withVulnResult)} found`,
    };
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [comment],
    });

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
      body: `${buildCommentMarker(withVulnResult)} found`,
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
      body: `${buildCommentMarker(withVulnResult)} found`,
    };
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [{ id: 123, body: null }, comment],
    });

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

describe("addIssueComment", () => {
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

  it("updates existing comment when found", async () => {
    const comment = {
      id: 123,
      body: `${buildCommentMarker(withVulnResult)} found`,
    };
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [comment],
    });

    await addIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "o",
        repo: "r",
        comment_id: 123,
        body: expect.any(String),
      }),
    );
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("creates new comment when not found", async () => {
    mockOctokit.rest.issues.listComments.mockResolvedValue({
      data: [],
    });

    await addIssueComment({
      github: mockOctokit as any,
      owner: "o",
      repo: "r",
      issueNumber: 42,
      result: withVulnResult,
    });

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "o",
        repo: "r",
        issue_number: 42,
        body: expect.any(String),
      }),
    );
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });
});
