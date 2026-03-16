import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { readdir } from "node:fs/promises";

export async function release() {
  const version = core.getInput("version");
  if (!version) throw new Error("no version input");

  await exec("make", ["build", `VERSION=${version}`]);
  const publishDirs = await listPublishDirs();
  for (const dir of publishDirs) {
    await exec("npm", ["publish", dir]);
  }
  core.info(`📦 package ${version} released!`);
}

export async function listPublishDirs(buildRoot = "build") {
  const entries = await readdir(buildRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${buildRoot}/${entry.name}`);
}
