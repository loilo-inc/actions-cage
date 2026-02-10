import * as core from "@actions/core";
import {
  assertInput,
  boolify,
  parseStringToArgs,
} from "@loilo-inc/actions-cage";
import {
  aggregateDeploymentParams,
  deploy,
  GithubDeploymentParams,
} from "./deploy";

export async function run() {
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
}
