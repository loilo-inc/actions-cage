import fs from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, test } from "vitest";
import { main } from "./build";

describe("build", () => {
  test("should build and copy files for each action config", async (t) => {
    const buildDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "actions-cage-build-test-"),
    );
    t.onTestFinished(() => fs.rm(buildDir, { recursive: true, force: true }));
    await main({ version: "0.0.0-test", buildDir });
    const makeExpectedFiles = (actionName: string) => ({
      name: actionName,
      files: [
        path.join(buildDir, actionName, "lib", "index.js"),
        path.join(buildDir, actionName, "lib", "index.js.map"),
        path.join(buildDir, actionName, "action.yml"),
        path.join(buildDir, actionName, "LICENSE"),
        path.join(buildDir, actionName, "package.json"),
      ],
    });
    const projects = [
      makeExpectedFiles("@loilo-inc/actions-setup-cage"),
      makeExpectedFiles("@loilo-inc/actions-deploy-cage"),
      makeExpectedFiles("@loilo-inc/actions-audit-cage"),
    ];
    for (const { name, files } of projects) {
      for (const file of files) {
        await fs.access(file);
      }
      const packageJsonFile = files.find(
        (f) => path.basename(f) === "package.json",
      );
      expect(packageJsonFile).toBeDefined();
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonFile as string, "utf-8"),
      );
      expect(packageJson.name).toBe(name);
      expect(packageJson.version).toBe("0.0.0-test");
    }
  });
});
