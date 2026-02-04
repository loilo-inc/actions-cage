import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deploy, type GithubDeploymentParams } from "./deploy";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

describe("deploy", () => {
  const mockOctokit = {
    rest: {
      repos: {
        createDeployment: vi.fn(),
        createDeploymentStatus: vi.fn(),
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);
  });

  it("should execute rollout without deployment", async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    await deploy({ args: ["--app", "test"] });

    expect(exec.exec).toHaveBeenCalledWith("cage", [
      "rollout",
      "--app",
      "test",
    ]);
    expect(github.getOctokit).not.toHaveBeenCalled();
  });

  it("should create deployment and set status to success", async () => {
    const deployment: GithubDeploymentParams = {
      owner: "test-owner",
      repo: "test-repo",
      ref: "main",
      environment: "production",
      token: "test-token",
    };

    mockOctokit.rest.repos.createDeployment.mockResolvedValue({
      data: { id: 123, url: "https://github.com/deployments/123" },
    } as any);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await deploy({ deployment, args: ["--app", "test"] });

    expect(github.getOctokit).toHaveBeenCalledWith("test-token");
    expect(mockOctokit.rest.repos.createDeployment).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      required_contexts: [],
      ref: "main",
      auto_merge: false,
      environment: "production",
    });
    expect(mockOctokit.rest.repos.createDeploymentStatus).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      deployment_id: 123,
      state: "in_progress",
      headers: { accept: "application/vnd.github.flash-preview+json" },
    });
    expect(mockOctokit.rest.repos.createDeploymentStatus).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      auto_inactive: true,
      deployment_id: 123,
      state: "success",
      headers: {
        accept:
          "application/vnd.github.ant-man-preview+json, application/vnd.github.flash-preview+json",
      },
    });
  });

  it("should set deployment status to failure on exec error", async () => {
    const deployment: GithubDeploymentParams = {
      owner: "test-owner",
      repo: "test-repo",
      ref: "main",
      environment: "production",
      token: "test-token",
    };

    mockOctokit.rest.repos.createDeployment.mockResolvedValue({
      data: { id: 123, url: "https://github.com/deployments/123" },
    } as any);
    vi.mocked(exec.exec).mockResolvedValue(1);

    await deploy({ deployment, args: ["--app", "test"] });

    expect(mockOctokit.rest.repos.createDeploymentStatus).toHaveBeenCalledWith({
      owner: "test-owner",
      repo: "test-repo",
      deployment_id: 123,
      state: "failure",
    });
    expect(core.setFailed).toHaveBeenCalledWith(
      "Deployment failed with exit code 1",
    );
  });

  it("should throw error when deployment creation fails", async () => {
    const deployment: GithubDeploymentParams = {
      owner: "test-owner",
      repo: "test-repo",
      ref: "main",
      environment: "production",
      token: "test-token",
    };

    mockOctokit.rest.repos.createDeployment.mockResolvedValue({
      data: { message: "error occurred" },
    } as any);

    await expect(
      deploy({ deployment, args: ["--app", "test"] }),
    ).rejects.toThrow("couldn't create deployment: error occurred");
  });

  it("should handle exec exception", async () => {
    const error = new Error("exec failed");
    vi.mocked(exec.exec).mockRejectedValue(error);

    await deploy({ args: ["--app", "test"] });

    expect(core.error).toHaveBeenCalledWith(error);
    expect(core.setFailed).toHaveBeenCalledWith("see error above");
  });
});
