type _Core = typeof import("@actions/core");
type Core = Pick<_Core, "getInput" | "setFailed" | "info" | "warning">;
type _IO = typeof import("@actions/io");
type IO = Pick<_IO, "which">;
import { downloadCage } from "./download";
import { fetchReleases } from "./github";
import { getPlatform } from "./type";
import { getValidCandidate } from "./validator";

function assertInput(core: Core, name: string): string {
  const v = core.getInput(name);
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

export async function run({ core, io }: { core: Core; io: IO }) {
  const token = assertInput(core, "github-token");
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
