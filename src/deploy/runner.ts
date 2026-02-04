import * as core from "@actions/core";
import { parseStringToArgs } from "./args";
import {
  aggregateDeploymentParams,
  deploy,
  GithubDeploymentParams,
} from "./deploy";

function boolify(s: string): boolean {
  return s !== "" && !s.match(/^(false|0|undefined|null)$/);
}

function assertInput(name: string): string {
  const v = core.getInput(name);
  if (!v) {
    throw new Error(`${name} is required`);
  }
  return v;
}

export async function main() {
  const deployContext = assertInput("deploy-context");
  const region = assertInput("region");
  const createDeployment = boolify(core.getInput("create-deployment"));
  const environment = core.getInput("environment");
  const idleDuration = core.getInput("canary-task-idle-duration");
  const updateService = boolify(core.getInput("update-service"));
  const cageOptions = core.getInput("cage-options");
  const token = core.getInput("github-token");
  const ref = core.getInput("github-ref");
  const repository = core.getInput("github-repository");
  try {
    let deployment: GithubDeploymentParams | undefined;
    if (createDeployment) {
      deployment = aggregateDeploymentParams({
        ref,
        repository,
        environment,
        token,
      });
    }
    const args = ["--region", region];
    if (idleDuration) {
      args.push("--canaryTaskIdleDuration", idleDuration);
    }
    if (updateService) {
      args.push("--updateService");
    }
    if (cageOptions) {
      args.push(...parseStringToArgs(cageOptions));
    }
    args.push(deployContext);
    await deploy({ deployment, args });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e);
    }
    core.setFailed("see error above");
  }
}
