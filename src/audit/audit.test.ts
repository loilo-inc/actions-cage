import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audit } from "./audit";
import { executeAudit } from "./audit-cage";
import {
  addIssueComment,
  ensureIssue,
  ensureLabel,
  findIssueByTitle,
} from "./audit-github";
import { AuditIssueParams } from "./types";

vi.mock("@actions/core");
vi.mock("@actions/github");
vi.mock("./audit-cage");
vi.mock("./audit-github");

describe("audit", () => {
  const mockParams: AuditIssueParams = {
    owner: "test-owner",
    repo: "test-repo",
    title: "Security Audit",
    token: "test-token",
  };

  const mockArgs = ["arg1", "arg2"];
  const mockGithub = {
    rest: {
      issues: {
        update: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should close existing issue when no vulnerabilities found", async () => {
    const mockResult = { summary: { total_count: 0 } };
    const mockExisting = { number: 42 };

    vi.mocked(executeAudit).mockResolvedValue(mockResult as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);
    vi.mocked(findIssueByTitle).mockResolvedValue(mockExisting as any);

    await audit({ args: mockArgs, params: mockParams });

    expect(mockGithub.rest.issues.update).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      issue_number: 42,
      state: "closed",
      state_reason: "completed",
    });
    expect(ensureLabel).not.toHaveBeenCalled();
  });

  it("should create/update issue and add comment when vulnerabilities found", async () => {
    const mockResult = { summary: { total_count: 5 } };
    const mockUpdated = { number: 1, html_url: "https://github.com/test" };

    vi.mocked(executeAudit).mockResolvedValue(mockResult as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);
    vi.mocked(findIssueByTitle).mockResolvedValue(null);
    vi.mocked(ensureIssue).mockResolvedValue(mockUpdated as any);

    await audit({ args: mockArgs, params: mockParams });

    expect(ensureLabel).toHaveBeenCalled();
    expect(ensureIssue).toHaveBeenCalled();
    expect(addIssueComment).toHaveBeenCalledWith({
      github: mockGithub,
      owner: "test-owner",
      repo: "test-repo",
      issueNumber: 1,
      result: mockResult,
    });
  });

  it("should log appropriate messages", async () => {
    const mockResult = { summary: { total_count: 0 } };
    const mockExisting = { number: 42 };

    vi.mocked(executeAudit).mockResolvedValue(mockResult as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);
    vi.mocked(findIssueByTitle).mockResolvedValue(mockExisting as any);

    await audit({ args: mockArgs, params: mockParams });

    expect(core.info).toHaveBeenCalledWith(
      "Creating or updating issue 'Security Audit' in test-owner/test-repo",
    );
  });
});
