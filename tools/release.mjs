import * as core from "@actions/core";
import { exec } from "@actions/exec";
import fs from "node:fs/promises";

const packages = ["src/audit", "src/deploy", "src/setup", "src/util"];

// GHAでGHPRにnpmリリースする
export async function release() {
  let version = core.getInput("version");
  if (!version) throw new Error("no version input");
  for (const pkg of packages) {
    const packageJson = JSON.parse(
      await fs.readFile(`${pkg}/package.json`, "utf-8"),
    );
    packageJson["version"] = version;
    await fs.writeFile(`${pkg}/package.json`, JSON.stringify(packageJson));
  }
  await exec("npm", ["publish", "--workspace"]);
  core.info(`📦 package ${version} released!`);
}
