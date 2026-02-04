import * as core from "@actions/core";
import * as io from "@actions/io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./runner";

vi.mock("@actions/core");
vi.mock("@actions/io");
vi.mock("./runner");

describe("index", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should call run when GITHUB_ACTIONS is true", async () => {
    process.env["GITHUB_ACTIONS"] = "true";
    vi.mocked(run).mockResolvedValue(undefined);

    await import("./index");
    await new Promise((resolve) => setImmediate(resolve));

    expect(run).toHaveBeenCalledWith({ core, io });
  });

  it("should not call run when GITHUB_ACTIONS is not true", async () => {
    process.env["GITHUB_ACTIONS"] = "false";

    await import("./index");
    await new Promise((resolve) => setImmediate(resolve));

    expect(run).not.toHaveBeenCalled();
  });

  it("should call core.setFailed with error message when run rejects with Error", async () => {
    process.env["GITHUB_ACTIONS"] = "true";
    const error = new Error("Test error");
    vi.mocked(run).mockRejectedValue(error);

    await import("./index");
    await new Promise((resolve) => setImmediate(resolve));

    expect(core.setFailed).toHaveBeenCalledWith("Test error");
  });

  it("should call core.setFailed with string when run rejects with non-Error", async () => {
    process.env["GITHUB_ACTIONS"] = "true";
    vi.mocked(run).mockRejectedValue("string error");

    await import("./index");
    await new Promise((resolve) => setImmediate(resolve));

    expect(core.setFailed).toHaveBeenCalledWith("string error");
  });
});
