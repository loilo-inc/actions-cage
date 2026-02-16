import * as core from "@actions/core";
import { assertInput, boolify, parseListInput } from "@loilo-inc/actions-cage";
import { audit } from "./audit";

export async function run() {
  const region = assertInput("region");
  const token = assertInput("github-token");
  const auditContexts = core.getInput("audit-contexts");
  const auditServices = core.getInput("audit-services");
  const cageOptions = core.getInput("cage-options");
  const dryRun = boolify(core.getInput("dry-run"));
  const { owner, repo, issueTitle } = (() => {
    const issueTitle = core.getInput("issue-title");
    const repository = process.env.GITHUB_REPOSITORY;
    const m = repository?.match(/^(.+?)\/(.+?)$/);
    if (!m) {
      throw new Error(`GITHUB_REPOSITORY is not set or invalid: ${repository}`);
    }
    if (issueTitle.trim() === "") {
      throw new Error("issue-title input cannot be empty");
    }
    const [owner, repo] = [m[1], m[2]];
    return { owner, repo, issueTitle };
  })();
  const fullArgsList = Array.from(
    iterateAuditTargets({
      contexts: auditContexts,
      services: auditServices,
    }),
  ).map(({ options, args }) => [
    "--region",
    region,
    ...options,
    ...parseListInput(cageOptions),
    ...args,
  ]);
  if (fullArgsList.length === 0) {
    throw new Error(
      "Either 'audit-contexts' or 'audit-services' input must be provided.",
    );
  }
  await audit({
    argsList: fullArgsList,
    params: { owner, repo, token, title: issueTitle, dryRun },
  });
}

export function* iterateAuditTargets({
  contexts,
  services,
}: {
  contexts?: string;
  services?: string;
}): Generator<{ options: string[]; args: string[] }> {
  if (contexts) {
    for (const ctx of parseListInput(contexts)) {
      yield { options: [], args: [ctx] };
    }
  }
  if (services) {
    for (const line of parseListInput(services)) {
      const [cluster, svc] = parseServiceInput(line);
      yield { options: ["--cluster", cluster, "--service", svc], args: [] };
    }
  }
}

export function parseServiceInput(input: string): [string, string] {
  const pat = /^(.+?)\/(.+?)$/;
  const m = input.match(pat);
  if (!m) {
    throw new Error(
      `Invalid audit-service format: ${input}. Expected format is <cluster>/<service>.`,
    );
  }
  const [, cluster, svc] = m;
  return [cluster, svc];
}
