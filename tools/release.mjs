import * as core from "@actions/core";
import { exec } from "@actions/exec";
import fs from "node:fs/promises";

const resolve = (path) => new URL(path, import.meta.url).pathname;

const packages = ["src/audit", "src/deploy", "src/setup", "src/util"];

// GHAでGHPRにnpmリリースする
export async function main() {
  let version = core.getInput("version");
  if (!version) throw new Error("no version input");
  for (const pkg of packages) {
    const packageJson = JSON.parse(
      await fs.readFile(resolve(`${pkg}/package.json`), "utf-8"),
    );
    packageJson["version"] = version;
    await fs.writeFile(
      resolve(`${pkg}/package.json`),
      JSON.stringify(packageJson),
    );
  }
  await exec("npm", ["publish", "--workspace"]);
  core.info(`📦 package ${version} released!`);
}

if (process.env.GITHUB_ACTIONS) {
  main();
}
