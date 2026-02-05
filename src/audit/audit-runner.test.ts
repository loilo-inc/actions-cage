import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as argsUtil from "../util/args";
import * as ghaUtil from "../util/gha";
import * as auditModule from "./audit";
import { run } from "./audit-runner";

vi.mock("@actions/core");
vi.mock("./audit");
vi.mock("../util/args");
vi.mock("../util/gha");

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = "owner/repo";
  });

  it("should throw error when region is not provided", async () => {
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) => {
      if (key === "region") throw new Error("region is required");
      return "token";
    });
    vi.mocked(core.getInput).mockReturnValue("");

    await expect(run()).rejects.toThrow("region is required");
  });

  it("should throw error when audit-context and cluster/service are missing", async () => {
    vi.mocked(ghaUtil.assertInput).mockReturnValue("us-east-1");
    vi.mocked(core.getInput).mockReturnValue("");
    vi.mocked(ghaUtil.boolify).mockReturnValue(false);

    await expect(run()).rejects.toThrow(
      "cluster and service are required when audit-context is not set",
    );
  });

  it("should execute audit with audit-context", async () => {
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) =>
      key === "region" ? "us-east-1" : "token123",
    );
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "audit-context") return "ctx";
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "svc-a";
      return "";
    });
    vi.mocked(ghaUtil.boolify).mockReturnValue(false);
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
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) =>
      key === "region" ? "us-east-1" : "token123",
    );
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "my-service";
      return "";
    });
    vi.mocked(ghaUtil.boolify).mockReturnValue(false);
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
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) =>
      key === "region" ? "us-east-1" : "token123",
    );
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "svc-a,svc-b";
      return "";
    });
    vi.mocked(ghaUtil.boolify).mockReturnValue(false);
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
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) =>
      key === "region" ? "us-east-1" : "token123",
    );
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "audit-context") return "some-context";
      return "";
    });
    vi.mocked(ghaUtil.boolify).mockReturnValue(true);
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
    vi.mocked(ghaUtil.assertInput).mockImplementation((key) =>
      key === "region" ? "us-east-1" : "token123",
    );
    vi.mocked(core.getInput).mockImplementation((key) => {
      if (key === "cluster") return "my-cluster";
      if (key === "service") return "my-service";
      if (key === "cage-options") return "--flag1 value1";
      return "";
    });
    vi.mocked(ghaUtil.boolify).mockReturnValue(false);
    vi.mocked(argsUtil.parseStringToArgs).mockReturnValue([
      "--flag1",
      "value1",
    ]);
    vi.mocked(auditModule.audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(argsUtil.parseStringToArgs)).toHaveBeenCalledWith(
      "--flag1 value1",
    );
    expect(vi.mocked(auditModule.audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--flag1", "value1"]),
      }),
    );
  });
});
