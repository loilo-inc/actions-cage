import * as core from "@actions/core";
import { exec, getExecOutput } from "@actions/exec";
import { readFile, writeFile } from "node:fs/promises";

export async function release() {
  const version = core.getInput("version");
  if (!version) throw new Error("no version input");
  const wsJson = await getExecOutput("npm", ["pkg", "get", "packages"]);
  const packages = JSON.parse(wsJson.stdout) as string[];
  await Promise.all(packages.map((pkg) => updatePackageJson(pkg, version)));
  await exec("npm", ["publish", "--workspaces"]);
  core.info(`📦 package ${version} released!`);
}

export async function updatePackageJson(pkg: string, version: string) {
  const packageJson = JSON.parse(
    await readFile(`${pkg}/package.json`, "utf-8"),
  );
  packageJson["version"] = version;
  if (packageJson["dependencies"]?.["@loilo-inc/actions-cage"]) {
    packageJson["dependencies"]["@loilo-inc/actions-cage"] = version;
  }
  await writeFile(
    `${pkg}/package.json`,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}
