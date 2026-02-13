import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audit } from "./audit";
import { iterateAuditTargets, parseServiceInput, run } from "./audit-runner";
vi.mock("@actions/core");
vi.mock("./audit");
vi.mock("./markdown");
vi.mock("./audit-cage");

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = "owner/repo";
  });

  const mockInput = (inputs: Record<string, string>) => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      return inputs[key] || "";
    });
  };

  it("should throw error when GITHUB_REPOSITORY is not set", async () => {
    delete process.env.GITHUB_REPOSITORY;
    mockInput({
      "audit-contexts": "ctx1",
      region: "us-east-1",
      "github-token": "token123",
    });

    await expect(run()).rejects.toThrow(
      "GITHUB_REPOSITORY is not set or invalid: undefined",
    );
  });

  it("should throw error when neither audit-contexts nor audit-services provided", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
    });
    await expect(run()).rejects.toThrow(
      "Either 'audit-contexts' or 'audit-services' input must be provided.",
    );
  });

  it("should execute audit with context options", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
      "audit-contexts": "ctx1",
      "cage-options": "",
      "issue-title": "Test Report",
    });

    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      args: ["--region", "us-east-1", "ctx1"],
      params: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Test Report",
      },
    });
  });

  it("should execute audit with service options", async () => {
    mockInput({
      region: "us-west-2",
      "github-token": "token456",
      "audit-services": "cluster1/svc1",
    });

    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-west-2",
        "--cluster",
        "cluster1",
        "--service",
        "svc1",
      ],
      params: {
        owner: "owner",
        repo: "repo",
        token: "token456",
        title: "Cage audit report",
      },
    });
  });

  it("should use default issue title when not provided", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
      "audit-contexts": "ctx1",
      "issue-title": "",
    });

    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ title: "Cage audit report" }),
      }),
    );
  });

  it("should handle dry-run mode without creating issue", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
      "audit-contexts": "ctx1",
      "dry-run": "true",
    });
    vi.mocked(audit).mockResolvedValue(undefined);

    await run();

    expect(vi.mocked(audit)).not.toHaveBeenCalled();
    expect(vi.mocked(core.info)).toHaveBeenCalled();
  });

  it("should include cage-options in audit arguments", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
      "audit-contexts": "ctx1",
      "cage-options": "--opt1\nvalue1\n--opt2\nvalue2",
    });
    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      args: [
        "--region",
        "us-east-1",
        "--opt1",
        "value1",
        "--opt2",
        "value2",
        "ctx1",
      ],
      params: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Cage audit report",
      },
    });
  });
});

describe("parseServiceInput", () => {
  it("should parse valid cluster/service format", () => {
    const [cluster, service] = parseServiceInput("my-cluster/my-service");
    expect(cluster).toBe("my-cluster");
    expect(service).toBe("my-service");
  });

  it("should parse cluster/service with special characters", () => {
    const [cluster, service] = parseServiceInput(
      "prod-cluster-01/api-service_v2",
    );
    expect(cluster).toBe("prod-cluster-01");
    expect(service).toBe("api-service_v2");
  });

  it("should throw error for invalid format without slash", () => {
    expect(() => parseServiceInput("invalid-format")).toThrow(
      "Invalid audit-service format: invalid-format. Expected format is <cluster>/<service>.",
    );
  });

  it("should throw error for empty input", () => {
    expect(() => parseServiceInput("")).toThrow(
      "Invalid audit-service format: . Expected format is <cluster>/<service>.",
    );
  });

  it("should throw error when only slash is provided", () => {
    expect(() => parseServiceInput("/")).toThrow(
      "Invalid audit-service format: /. Expected format is <cluster>/<service>.",
    );
  });

  it("should handle multiple slashes by matching first occurrence", () => {
    const [cluster, service] = parseServiceInput("cluster/service/extra");
    expect(cluster).toBe("cluster");
    expect(service).toBe("service/extra");
  });
});

describe("iterateAuditTargets", () => {
  it("should yield options for each context", () => {
    const generator = iterateAuditTargets({ contexts: "ctx1\nctx2" });
    const results = Array.from(generator);
    expect(results).toEqual([
      { options: [], args: ["ctx1"] },
      { options: [], args: ["ctx2"] },
    ]);
  });

  it("should yield cluster and service options for each service", () => {
    const generator = iterateAuditTargets({
      services: "cluster1/svc1\ncluster2/svc2",
    });
    const results = Array.from(generator);
    expect(results).toEqual([
      { options: ["--cluster", "cluster1", "--service", "svc1"], args: [] },
      { options: ["--cluster", "cluster2", "--service", "svc2"], args: [] },
    ]);
  });

  it("should yield both contexts and services", () => {
    const generator = iterateAuditTargets({
      contexts: "ctx1",
      services: "cluster1/svc1",
    });
    const results = Array.from(generator);
    expect(results).toEqual([
      { options: [], args: ["ctx1"] },
      { options: ["--cluster", "cluster1", "--service", "svc1"], args: [] },
    ]);
  });

  it("should return empty generator when neither contexts nor services provided", () => {
    const generator = iterateAuditTargets({});
    const results = Array.from(generator);
    expect(results).toEqual([]);
  });

  it("should handle single context", () => {
    const generator = iterateAuditTargets({ contexts: "single-ctx" });
    const results = Array.from(generator);
    expect(results).toEqual([{ options: [], args: ["single-ctx"] }]);
  });

  it("should handle single service", () => {
    const generator = iterateAuditTargets({
      services: "my-cluster/my-service",
    });
    const results = Array.from(generator);
    expect(results).toEqual([
      {
        options: ["--cluster", "my-cluster", "--service", "my-service"],
        args: [],
      },
    ]);
  });

  it("should throw error for invalid service format", () => {
    const generator = iterateAuditTargets({ services: "invalid-service" });
    expect(() => Array.from(generator)).toThrow(
      "Invalid audit-service format: invalid-service. Expected format is <cluster>/<service>.",
    );
  });
});
