import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as deployModule from "./deploy";
import { run } from "./deploy-runner";

vi.mock("@actions/core");
vi.mock("./deploy");

describe("deploy-runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockInput = (inputs: Record<string, string>) => {
    vi.mocked(core.getInput).mockImplementation((key) => {
      return inputs[key] || "";
    });
  };

  it("should call run with required inputs", async () => {
    mockInput({
      "deploy-context": "my-context",
      region: "us-east-1",
    });
    vi.mocked(deployModule.deploy).mockResolvedValue(undefined);

    await run();

    expect(core.getInput).toHaveBeenCalledWith("cage-options");
    expect(deployModule.deploy).toHaveBeenCalled();
  });

  it("should create deployment when createDeployment is true", async () => {
    mockInput({
      "deploy-context": "my-context",
      region: "us-east-1",
      "create-deployment": "true",
      environment: "production",
      "github-token": "token123",
      "github-ref": "main",
      "github-repository": "owner/repo",
    });
    vi.mocked(deployModule.aggregateDeploymentParams).mockReturnValue(
      {} as any,
    );
    vi.mocked(deployModule.deploy).mockResolvedValue(undefined);

    await run();

    expect(deployModule.aggregateDeploymentParams).toHaveBeenCalledWith({
      ref: "main",
      repository: "owner/repo",
      environment: "production",
      token: "token123",
    });
  });

  it("should parse cage options and add to args", async () => {
    mockInput({
      "deploy-context": "my-context",
      region: "us-east-1",
      "cage-options": "--option1\nvalue1",
    });
    vi.mocked(deployModule.deploy).mockResolvedValue(undefined);

    await run();

    expect(deployModule.deploy).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining([
          "--region",
          "us-east-1",
          "--option1",
          "value1",
          "my-context",
        ]),
      }),
    );
  });
});
