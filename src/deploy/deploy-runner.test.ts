import * as core from "@actions/core";
import { describe, expect, test, vi } from "vitest";
import * as deploy from "./deploy";
import { run } from "./deploy-runner";

describe("rdeploy/runner", () => {
  const input = (key: string, value: string) => {
    vi.spyOn(core, "getInput").mockImplementationOnce((name: string) => {
      expect(name).toBe(key);
      return value;
    });
  };
  test("basic", async () => {
    input("deploy-context", ".");
    input("region", "us-west-2");
    input("create-deployment", "true");
    input("environment", "production");
    input("canary-task-idle-duration", "10");
    input("update-service", "true");
    input("cage-options", "--foo 'bar' --baz");
    input("github-token", "token");
    input("github-ref", "refs/heads/main");
    input("github-repository", "owner/repo");
    const deploySpy = vi.spyOn(deploy, "deploy").mockResolvedValueOnce();
    await run();
    expect(deploySpy).toHaveBeenCalledWith({
      deployment: {
        environment: "production",
        ref: "main",
        owner: "owner",
        repo: "repo",
        token: "token",
      },
      args: [
        "--region",
        "us-west-2",
        "--canaryTaskIdleDuration",
        "10",
        "--updateService",
        "--foo",
        "bar",
        "--baz",
        ".",
      ],
    });
  });
  test("minimal", async () => {
    input("deploy-context", ".");
    input("region", "us-west-2");
    const deploySpy = vi.spyOn(deploy, "deploy").mockResolvedValueOnce();
    await run();
    expect(deploySpy).toHaveBeenCalledWith({
      deployment: undefined,
      args: ["--region", "us-west-2", "."],
    });
  });
});
