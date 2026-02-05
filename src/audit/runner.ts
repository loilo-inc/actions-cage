import * as core from "@actions/core";
import { parseStringToArgs } from "../deploy/args";
import { audit, executeAudit, renderAuditSummaryMarkdown } from "./audit";

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

function getRepository(input: string | undefined): { owner: string; repo: string } {
  const repoStr = input || process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repoStr.split("/");
  if (!owner || !repo) {
    throw new Error("github-repository is required");
  }
  return { owner, repo };
}

export async function run() {
  const region = assertInput("region");
  const cluster = core.getInput("cluster");
  const service = core.getInput("service");
  const auditContext = core.getInput("audit-context");
  const cageOptions = core.getInput("cage-options");
  const token = assertInput("github-token");
  const issueTitleInput = core.getInput("issue-title");
  const repository = core.getInput("github-repository");
  const dryRun = boolify(core.getInput("dry-run"));

  if (!auditContext && (!cluster || !service)) {
    throw new Error("cluster and service are required when audit-context is not set");
  }

  const { owner, repo } = getRepository(repository || undefined);
  const args: string[] = ["--region", region];
  if (cluster) args.push("--cluster", cluster);
  if (service) args.push("--service", service);
  if (cageOptions) {
    args.push(...parseStringToArgs(cageOptions));
  }
  if (auditContext) {
    args.push(auditContext);
  }

  const issueTitle =
    issueTitleInput ||
    `Cage audit report (${region}${cluster ? `/${cluster}` : ""}${service ? `/${service}` : ""})`;

  if (dryRun) {
    const result = await executeAudit(args);
    const body = renderAuditSummaryMarkdown(result);
    core.info(`Dry run: issue not created/updated.\n${body}`);
    return;
  }

  await audit({
    args,
    issue: { owner, repo, token, title: issueTitle },
  });
}
