import * as core from "@actions/core";
import { exec, getExecOutput } from "@actions/exec";
import * as fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { release, updatePackageJson } from "./release.js";
vi.mock("@actions/exec");
vi.mock("@actions/core");
vi.mock("node:fs/promises");

describe("release", () => {
  it("should throw error when version input is missing", async () => {
    vi.mocked(core.getInput).mockReturnValue("");

    await expect(release()).rejects.toThrow("no version input");
  });

  it("should update all packages and publish", async () => {
    const mockPackageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: {},
    };
    vi.mocked(core.getInput).mockReturnValue("2.0.0");
    vi.mocked(getExecOutput).mockResolvedValue({
      stdout: JSON.stringify(["packages/pkg-a", "packages/pkg-b"]),
    } as any);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    await release();

    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenCalledWith("npm", ["publish", "--workspaces"]);
    expect(core.info).toHaveBeenCalledWith("📦 package 2.0.0 released!");
  });
});

describe("updatePackageJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update version in package.json", async () => {
    const mockPackageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: {},
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    await updatePackageJson("src/test", "2.0.0");

    expect(fs.writeFile).toHaveBeenCalledWith(
      "src/test/package.json",
      JSON.stringify({ ...mockPackageJson, version: "2.0.0" }, null, 2) + "\n",
    );
  });

  it("should update @loilo-inc/actions-cage dependency if present", async () => {
    const mockPackageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: { "@loilo-inc/actions-cage": "1.0.0" },
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    await updatePackageJson("src/test", "2.0.0");

    expect(fs.writeFile).toHaveBeenCalledWith(
      "src/test/package.json",
      JSON.stringify(
        {
          name: "test-package",
          version: "2.0.0",
          dependencies: { "@loilo-inc/actions-cage": "2.0.0" },
        },
        null,
        2,
      ) + "\n",
    );
  });

  it("should not update @loilo-inc/actions-cage if not present", async () => {
    const mockPackageJson = {
      name: "test-package",
      version: "1.0.0",
      dependencies: { "other-package": "1.0.0" },
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockPackageJson));

    await updatePackageJson("src/test", "2.0.0");

    expect(fs.writeFile).toHaveBeenCalledWith(
      "src/test/package.json",
      JSON.stringify({ ...mockPackageJson, version: "2.0.0" }, null, 2) + "\n",
    );
  });
});
