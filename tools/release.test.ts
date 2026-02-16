import * as core from "@actions/core";
import { exec } from "@actions/exec";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./release.mjs";

vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("node:fs/promises");

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error when version input is missing", async () => {
    vi.mocked(core.getInput).mockReturnValue("");
    await expect(main()).rejects.toThrow("no version input");
  });

  it("updates package.json files with new version", async () => {
    vi.mocked(core.getInput).mockReturnValue("1.2.3");
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(exec).mockResolvedValue(0);

    await main();

    expect(fs.readFile).toHaveBeenCalledTimes(4);
    expect(fs.writeFile).toHaveBeenCalledTimes(4);
  });

  it("publishes packages with npm", async () => {
    vi.mocked(core.getInput).mockReturnValue("1.2.3");
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: "1.0.0" }),
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(exec).mockResolvedValue(0);

    await main();

    expect(exec).toHaveBeenCalledWith("npm", ["publish", "--workspace"]);
  });

  it("logs success message", async () => {
    vi.mocked(core.getInput).mockReturnValue("2.0.0");
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: "1.0.0" }),
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(exec).mockResolvedValue(0);

    await main();

    expect(core.info).toHaveBeenCalledWith("📦 package 2.0.0 released!");
  });
});
