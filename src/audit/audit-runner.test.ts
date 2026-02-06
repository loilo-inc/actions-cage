import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as auditModule from "./audit";
import { run } from "./audit-runner";

vi.mock("@actions/core");
vi.mock("./audit");

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = "owner/repo";
  });

  it("should throw error when region is not provided", async () => {
    vi.mocked(core.getInput).mockImplementation(() => "");
    await expect(run()).rejects.toThrow("region is required");
  });

  it("should throw error when audit-context and cluster/service are missing", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      return "";
    });
    await expect(run()).rejects.toThrow(
      "cluster and service are required when audit-context is not set",
    );
  });

  it("should execute audit with audit-context", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      if (key === "audit-context") return "ctx";
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "svc-a";
      return "";
    });
    vi.mocked(auditModule.audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(auditModule.audit)).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-east-1",
        "--cluster",
        "my-cluster",
        "--service",
        "svc-a",
        "ctx",
      ],
      issue: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Cage audit report",
      },
    });
  });

  it("should execute audit with correct args", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "my-service";
      return "";
    });
    vi.mocked(auditModule.audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(auditModule.audit)).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-east-1",
        "--cluster",
        "my-cluster",
        "--service",
        "my-service",
      ],
      issue: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Cage audit report",
      },
    });
  });

  it("should execute audit for multiple services and keep one issue", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "svc-a,svc-b";
      return "";
    });
    vi.mocked(auditModule.audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(auditModule.audit)).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-east-1",
        "--cluster",
        "my-cluster",
        "--service",
        "svc-a,svc-b",
      ],
      issue: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Cage audit report",
      },
    });
  });

  it("should run dry-run mode and not call audit", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      if (key === "audit-context") return "some-context";
      if (key === "dry-run") return "true";
      return "";
    });
    vi.mocked(auditModule.executeAudit).mockResolvedValue({
      success: true,
    } as any);
    vi.mocked(auditModule.renderAuditSummaryMarkdown).mockReturnValue(
      "markdown",
    );
    vi.mocked(core.info).mockImplementation(() => {});

    await run();

    expect(vi.mocked(auditModule.executeAudit)).toHaveBeenCalled();
    expect(vi.mocked(auditModule.audit)).not.toHaveBeenCalled();
    expect(vi.mocked(core.info)).toHaveBeenCalledWith(
      expect.stringContaining("Dry run"),
    );
  });

  it("should parse cage-options correctly", async () => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "region") return "us-east-1";
      if (key === "github-token") return "token123";
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "my-service";
      if (key === "cage-options") return "--flag1 value1";
      return "";
    });
    vi.mocked(auditModule.audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(auditModule.audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--flag1", "value1"]),
      }),
    );
  });
});
