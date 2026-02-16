import * as core from "@actions/core";
import { exec } from "@actions/exec";
import fs from "node:fs/promises";

// GHAでGHPRにnpmリリースする
export async function release() {
  let version = core.getInput("version");
  if (!version) throw new Error("no version input");
  const packages = ["src/audit", "src/deploy", "src/setup", "src/util"];
  await Promise.all(packages.map((pkg) => updatePackageJson(pkg, version)));
  await exec("npm", ["publish", "--workspaces"]);
  core.info(`📦 package ${version} released!`);
}

export async function updatePackageJson(pkg, version) {
  const packageJson = JSON.parse(
    await fs.readFile(`${pkg}/package.json`, "utf-8"),
  );
  packageJson["version"] = version;
  if (packageJson["dependencies"]["@loilo-inc/actions-cage"]) {
    packageJson["dependencies"]["@loilo-inc/actions-cage"] = version;
  }
  await fs.writeFile(
    `${pkg}/package.json`,
    JSON.stringify(packageJson, null, 2),
  );
}
