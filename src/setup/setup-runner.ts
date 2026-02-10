import * as core from "@actions/core";
import * as io from "@actions/io";
import { assertInput } from "./util/gha";
import { downloadCage } from "./download";
import { fetchReleases } from "./github";
import { getPlatform } from "./type";
import { getValidCandidate } from "./validator";

export async function run() {
  const token = assertInput("github-token");
  const usePreRelease = core.getInput("use-pre") === "true";
  const releases = await fetchReleases(token);
  const platform = getPlatform();
  const requiredVersion = core.getInput("cage-version") || undefined;
  const cage = getValidCandidate({
    releases,
    platform,
    usePreRelease,
    requiredVersion,
  });
  if (!cage) {
    throw new Error(`Could not find any valid release for ${requiredVersion}`);
  }
  if (!requiredVersion) {
    core.info(`No version specified. Using latest version: ${cage.version}`);
  }
  const isInstalled = await io.which("cage", false);
  if (!isInstalled) {
    await downloadCage(cage);
  }
}
