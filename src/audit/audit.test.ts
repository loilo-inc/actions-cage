import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audit } from "./audit";
import { executeCageAudit } from "./audit-cage";
import { ensureLabel, findIssueByTitle, upsertIssue } from "./audit-github";
import { renderAuditSummary } from "./markdown";
import { AuditIssueParams } from "./types";

vi.mock("@actions/core");
vi.mock("@actions/github");
vi.mock("./audit-cage");
vi.mock("./audit-github");
vi.mock("./markdown");

describe("audit", () => {
  const mockParams: AuditIssueParams = {
    owner: "test-owner",
    repo: "test-repo",
    title: "Security Audit",
    token: "test-token",
  };

  const mockArgs = [["arg1", "arg2"]];
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

  it("should handle dry run mode", async () => {
    vi.mocked(executeCageAudit).mockResolvedValue({
      summary: { total_count: 5 },
    } as any);
    vi.mocked(renderAuditSummary).mockReturnValue("summary");

    await audit({
      argsList: mockArgs,
      params: { ...mockParams, dryRun: true },
    });

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
    expect(getOctokit).not.toHaveBeenCalled();
  });

  it("should close existing issue when no vulnerabilities found", async () => {
    vi.mocked(executeCageAudit).mockResolvedValue({
      summary: { total_count: 0 },
    } as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);
    vi.mocked(findIssueByTitle).mockResolvedValue({ number: 42 } as any);

    await audit({ argsList: mockArgs, params: mockParams });

    expect(mockGithub.rest.issues.update).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      issue_number: 42,
      state: "closed",
      state_reason: "completed",
    });
  });

  it("should create or update issue when vulnerabilities exist", async () => {
    vi.mocked(executeCageAudit).mockResolvedValue({
      summary: { total_count: 3 },
    } as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);
    vi.mocked(findIssueByTitle).mockResolvedValue(null);
    vi.mocked(upsertIssue).mockResolvedValue({
      html_url: "https://github.com/test-owner/test-repo/issues/1",
    } as any);
    vi.mocked(renderAuditSummary).mockReturnValue("summary");

    await audit({ argsList: mockArgs, params: mockParams });

    expect(ensureLabel).toHaveBeenCalledWith({
      github: mockGithub,
      owner: "test-owner",
      repo: "test-repo",
      name: "canarycage",
    });
    expect(upsertIssue).toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining("Issue ready"),
    );
  });

  it("should execute multiple audits", async () => {
    const multipleArgs = [["arg1"], ["arg2"], ["arg3"]];
    vi.mocked(executeCageAudit).mockResolvedValue({
      summary: { total_count: 0 },
    } as any);
    vi.mocked(getOctokit).mockReturnValue(mockGithub as any);

    await audit({
      argsList: multipleArgs,
      params: mockParams,
    });

    expect(executeCageAudit).toHaveBeenCalledTimes(3);
  });
});
