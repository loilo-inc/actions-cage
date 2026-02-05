import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  audit,
  executeAudit,
  renderAuditSummaryMarkdown,
} from "../audit/audit";
import { parseStringToArgs } from "../util/args";
import { run } from "./runner";

vi.mock("../audit/audit");
vi.mock("../util/args");
vi.mock("@actions/core");

const mockCore = vi.mocked(core);

describe("audit/runner/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = "owner/repo";
  });

  it("should throw error when region is missing", async () => {
    mockCore.getInput.mockReturnValue("");

    await expect(run()).rejects.toThrow("region is required");
  });

  it("should throw error when github-token is missing", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      return "";
    });

    await expect(run()).rejects.toThrow("github-token is required");
  });

  it("should throw error when cluster and service are missing without audit-context", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "github-token") return "token";
      return "";
    });

    await expect(run()).rejects.toThrow(
      "cluster and service are required when audit-context is not set",
    );
  });

  it("should call audit with correct args when cluster and service are provided", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "cluster") return "my-cluster";
      if (name === "service") return "my-service";
      if (name === "github-token") return "token";
      return "";
    });

    await run();

    expect(audit).toHaveBeenCalledWith({
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
        token: "token",
        title: "Cage audit report (us-east-1/my-cluster/my-service)",
      },
    });
  });

  it("should call audit with correct args when audit-context is provided", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "audit-context") return "context.json";
      if (name === "github-token") return "token";
      return "";
    });

    await run();

    expect(audit).toHaveBeenCalledWith({
      args: ["--region", "us-east-1", "context.json"],
      issue: {
        owner: "owner",
        repo: "repo",
        token: "token",
        title: "Cage audit report (us-east-1)",
      },
    });
  });

  it("should parse and include cage-options in args", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "cluster") return "my-cluster";
      if (name === "service") return "my-service";
      if (name === "cage-options") return "--verbose --debug";
      if (name === "github-token") return "token";
      return "";
    });
    vi.mocked(parseStringToArgs).mockReturnValue(["--verbose", "--debug"]);

    await run();

    expect(parseStringToArgs).toHaveBeenCalledWith("--verbose --debug");
    expect(audit).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-east-1",
        "--cluster",
        "my-cluster",
        "--service",
        "my-service",
        "--verbose",
        "--debug",
      ],
      issue: expect.any(Object),
    });
  });

  it("should use custom issue title when provided", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "cluster") return "my-cluster";
      if (name === "service") return "my-service";
      if (name === "github-token") return "token";
      if (name === "issue-title") return "Custom Title";
      return "";
    });

    await run();

    expect(audit).toHaveBeenCalledWith({
      args: expect.any(Array),
      issue: expect.objectContaining({ title: "Custom Title" }),
    });
  });

  it("should use custom repository when provided", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "cluster") return "my-cluster";
      if (name === "service") return "my-service";
      if (name === "github-token") return "token";
      if (name === "github-repository") return "custom-owner/custom-repo";
      return "";
    });

    await run();

    expect(audit).toHaveBeenCalledWith({
      args: expect.any(Array),
      issue: expect.objectContaining({
        owner: "custom-owner",
        repo: "custom-repo",
      }),
    });
  });

  it("should execute dry run without creating issue", async () => {
    const mockResult = { status: "success" };
    const mockBody = "Audit summary";
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "region") return "us-east-1";
      if (name === "cluster") return "my-cluster";
      if (name === "service") return "my-service";
      if (name === "github-token") return "token";
      if (name === "dry-run") return "true";
      return "";
    });
    vi.mocked(executeAudit).mockResolvedValue(mockResult as any);
    vi.mocked(renderAuditSummaryMarkdown).mockReturnValue(mockBody);

    await run();

    expect(executeAudit).toHaveBeenCalledWith([
      "--region",
      "us-east-1",
      "--cluster",
      "my-cluster",
      "--service",
      "my-service",
    ]);
    expect(renderAuditSummaryMarkdown).toHaveBeenCalledWith(mockResult);
    expect(mockCore.info).toHaveBeenCalledWith(
      `Dry run: issue not created/updated.\n${mockBody}`,
    );
    expect(audit).not.toHaveBeenCalled();
  });
});
