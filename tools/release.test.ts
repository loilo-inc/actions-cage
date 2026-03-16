import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPublishDirs, release } from "./release.js";

vi.mock("@actions/exec");
vi.mock("@actions/core");
vi.mock("node:fs/promises");

describe("release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when version input is missing", async () => {
    vi.mocked(core.getInput).mockReturnValue("");

    await expect(release()).rejects.toThrow("no version input");
  });

  it("should build versioned artifacts and publish each build directory", async () => {
    vi.mocked(core.getInput).mockReturnValue("2.0.0");
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "setup", isDirectory: () => true },
      { name: "deploy", isDirectory: () => true },
      { name: "README.md", isDirectory: () => false },
    ] as any);

    await release();

    expect(exec).toHaveBeenNthCalledWith(1, "make", ["build", "VERSION=2.0.0"]);
    expect(exec).toHaveBeenNthCalledWith(2, "npm", ["publish", "build/deploy"]);
    expect(exec).toHaveBeenNthCalledWith(3, "npm", ["publish", "build/setup"]);
    expect(core.info).toHaveBeenCalledWith("📦 package 2.0.0 released!");
  });
});

describe("listPublishDirs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should only return directories inside build", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: "setup", isDirectory: () => true },
      { name: "deploy", isDirectory: () => true },
      { name: "LICENSE", isDirectory: () => false },
    ] as any);

    await expect(listPublishDirs()).resolves.toEqual([
      "build/deploy",
      "build/setup",
    ]);
  });
});
