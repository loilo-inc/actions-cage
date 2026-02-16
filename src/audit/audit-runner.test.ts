import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { audit } from "./audit";
import { iterateAuditTargets, parseServiceInput, run } from "./audit-runner";
vi.mock("@actions/core");
vi.mock("./audit");
vi.mock("./markdown");
vi.mock("./audit-cage");

describe("run", () => {
  const defaultInputs = {
    region: "us-east-1",
    "github-token": "token123",
    "issue-title": "Cage audit report",
  };
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
    mockInput(defaultInputs);

    await expect(run()).rejects.toThrow(
      "GITHUB_REPOSITORY is not set or invalid: undefined",
    );
  });

  it("should throw error when issue-title is empty", async () => {
    mockInput({
      ...defaultInputs,
      "issue-title": "   ",
    });

    await expect(run()).rejects.toThrow("issue-title input cannot be empty");
  });

  it("should throw error when neither audit-contexts nor audit-services provided", async () => {
    mockInput(defaultInputs);
    await expect(run()).rejects.toThrow(
      "Either 'audit-contexts' or 'audit-services' input must be provided.",
    );
  });

  it("should execute audit with context options", async () => {
    mockInput({
      ...defaultInputs,
      "audit-contexts": "ctx1",
      "issue-title": "Test Report",
    });

    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      argsList: [["--region", "us-east-1", "ctx1"]],
      params: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Test Report",
        dryRun: false,
      },
    });
  });

  it("should execute audit with service options", async () => {
    mockInput({
      ...defaultInputs,
      "audit-services": "cluster1/svc1",
    });

    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      argsList: [
        ["--region", "us-east-1", "--cluster", "cluster1", "--service", "svc1"],
      ],
      params: {
        owner: "owner",
        repo: "repo",
        token: defaultInputs["github-token"],
        title: defaultInputs["issue-title"],
        dryRun: false,
      },
    });
  });

  it("should include cage-options in audit arguments", async () => {
    mockInput({
      ...defaultInputs,
      "audit-contexts": "ctx1",
      "cage-options": "--opt1\nvalue1\n--opt2\nvalue2",
    });
    await run();

    expect(vi.mocked(audit)).toHaveBeenCalledWith({
      argsList: [
        [
          "--region",
          "us-east-1",
          "--opt1",
          "value1",
          "--opt2",
          "value2",
          "ctx1",
        ],
      ],
      params: {
        owner: "owner",
        repo: "repo",
        token: "token123",
        title: "Cage audit report",
        dryRun: false,
      },
    });
  });
  it("should throw error when no audit targets found", async () => {
    mockInput({
      region: "us-east-1",
      "github-token": "token123",
      "audit-contexts": "\n\n",
      "audit-services": "",
      "issue-title": "Cage audit report",
    });
    await expect(run()).rejects.toThrow(
      "Either 'audit-contexts' or 'audit-services' input must be provided.",
    );
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
