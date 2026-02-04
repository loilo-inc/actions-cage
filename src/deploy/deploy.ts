import { getOctokit } from "@actions/github";
import * as exec from "@actions/exec";
import * as core from "@actions/core";
import type * as gh from "@actions/github/lib/utils";

type Github = InstanceType<typeof gh.GitHub>;

export function parseRef(ref: string): string {
  // refs/heads/master -> master
  // refs/tags/v0.1.0 -> v0.1.0
  const m = ref.match(/^refs\/.+?\/(.+?)$/);
  if (m) {
    return m[1];
  }
  return ref;
}

export function aggregateDeploymentParams({
  environment,
  ref,
  token,
  repository,
}: Partial<{
  environment: string;
  ref: string;
  token: string;
  repository: string;
}>): GithubDeploymentParams {
  let missings: string[] = [];
  !environment && missings.push("--environment");
  !ref && missings.push("--github-ref");
  !token && missings.push("--github-token");
  !repository && missings.push("--github-repository");
  if (!environment || !ref || !token || !repository) {
    throw new Error(
      `${missings.join(",")} are required if --create-deployment specified.`,
    );
  }
  const [owner, repo] = repository.split("/");
  const parsedRef = parseRef(ref);
  return {
    owner,
    repo,
    ref: parsedRef,
    token,
    environment,
  };
}

export type GithubDeploymentParams = {
  owner: string;
  repo: string;
  ref: string;
  environment: string;
  token: string;
};

export async function deploy({
  deployment,
  args,
}: {
  deployment?: GithubDeploymentParams;
  args: string[];
}) {
  let github: Github | undefined;
  let deployId: number | undefined;
  if (deployment) {
    github = getOctokit(deployment.token);
    const { owner, repo, ref, environment } = deployment;
    console.log("Creating deployment...", owner, repo, ref, environment);
    const resp = await github.rest.repos.createDeployment({
      owner,
      repo,
      required_contexts: [],
      ref,
      auto_merge: false,
      environment: environment,
    });
    // @ts-ignore
    const { id, url, message } = resp.data;
    if (!id || !url) {
      throw new Error("couldn't create deployment: " + message);
    }
    deployId = id;
    console.log(`Deployment created: ${url}`);
  }
  let code = 1;
  try {
    console.log(`Start rolling out...`);
    if (github && deployment && deployId) {
      const { owner, repo } = deployment;
      await github.rest.repos.createDeploymentStatus({
        owner,
        repo,
        deployment_id: deployId,
        state: "in_progress",
        headers: {
          accept: "application/vnd.github.flash-preview+json",
        },
      });
    }
    code = await exec.exec("cage", ["rollout", ...args]);
  } catch (e) {
    if (e instanceof Error) {
      console.error(e);
    }
    core.setFailed("see error above");
  } finally {
    if (github && deployment && deployId) {
      const { owner, repo } = deployment;
      if (code === 0) {
        console.log(`Updating deployment state to 'success'...`);
        await github.rest.repos.createDeploymentStatus({
          owner,
          repo,
          auto_inactive: true,
          deployment_id: deployId,
          state: "success",
          headers: {
            accept:
              "application/vnd.github.ant-man-preview+json, application/vnd.github.flash-preview+json",
          },
        });
      } else {
        console.log(`Updating deployment state to 'failure'...`);
        await github.rest.repos.createDeploymentStatus({
          owner,
          repo,
          deployment_id: deployId,
          state: "failure",
        });
      }
      console.log(`Deployment state updated.`);
      if (code !== 0) {
        core.setFailed(`Deployment failed with exit code ${code}`);
      }
    }
  }
}
