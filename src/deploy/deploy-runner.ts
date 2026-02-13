import * as core from "@actions/core";
import { assertInput, boolify, parseListInput } from "@loilo-inc/actions-cage";
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
  args.push(...parseListInput(cageOptions));
  args.push(deployContext);
  await deploy({ deployment, args });
}
