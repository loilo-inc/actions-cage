import * as github from "@actions/github";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLabel, findIssueByTitle, upsertIssue } from "./audit-github";
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

describe("upsertIssue", () => {
  let mockOctokit: ReturnType<typeof makeMockOctokit>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = makeMockOctokit();
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it("returns existing issue when found", async () => {
    const existingIssue = {
      number: 1,
      title: "Test Issue",
      pull_request: undefined,
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({
      data: [existingIssue],
    });
    mockOctokit.rest.issues.update.mockResolvedValue({ data: existingIssue });
    const result = await upsertIssue({
      github: mockOctokit as any,
      params: { owner: "o", repo: "r", title: "Test Issue", token: "t" },
      body: "Issue body",
    });

    expect(result).toEqual(existingIssue);
    expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled();
  });

  it("creates new issue when not found", async () => {
    const newIssue = {
      number: 2,
      title: "New Issue",
      pull_request: undefined,
    };
    mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
    mockOctokit.rest.issues.create.mockResolvedValue({ data: newIssue });

    const result = await upsertIssue({
      github: mockOctokit as any,
      params: { owner: "o", repo: "r", title: "New Issue", token: "t" },
      body: "New issue body",
    });

    expect(result).toEqual(newIssue);
    expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      title: "New Issue",
      body: "New issue body",
      labels: ["canarycage"],
    });
  });
});
