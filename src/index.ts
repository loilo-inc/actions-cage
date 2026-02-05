import * as core from "@actions/core";
import * as modAudit from "./audit/runner";
import * as modDeploy from "./deploy/runner";
import * as modSetup from "./setup/runner";

async function run(runner: () => Promise<void>) {
  try {
    await runner();
  } catch (e) {
    if (e instanceof Error) {
      core.error(e);
    }
    core.setFailed("see error above");
  }
}

export function deploy() {
  return run(modDeploy.run);
}

export function audit() {
  return run(modAudit.run);
}

export function setup() {
  return run(modSetup.run);
}
