import * as core from "@actions/core";
import { audit } from "./audit";
import { executeAudit } from "./audit-cage";
import { renderAuditSummaryMarkdown } from "./markdown";
import { parseStringToArgs } from "./util/args";
import { assertInput, boolify } from "./util/gha";

export async function run() {
  const region = assertInput("region");
  const cluster = core.getInput("cluster");
  const service = core.getInput("service");
  const auditContext = core.getInput("audit-context");
  const cageOptions = core.getInput("cage-options");
  const token = assertInput("github-token");
  const issueTitle = core.getInput("issue-title") || `Cage audit report`;
  const dryRun = boolify(core.getInput("dry-run"));
  const { owner, repo } = (() => {
    const repository = process.env.GITHUB_REPOSITORY;
    const m = repository?.match(/^(.+?)\/(.+?)$/);
    if (!m) {
      throw new Error(`GITHUB_REPOSITORY is not set or invalid: ${repository}`);
    }
    const [owner, repo] = [m[1], m[2]];
    return { owner, repo };
  })();
  if (!auditContext && (!cluster || !service)) {
    throw new Error(
      "cluster and service are required when audit-context is not set",
    );
  }
  const args: string[] = ["--region", region];
  if (cluster) args.push("--cluster", cluster);
  if (service) args.push("--service", service);
  if (cageOptions) {
    args.push(...parseStringToArgs(cageOptions));
  }
  if (auditContext) {
    args.push(auditContext);
  }
  if (dryRun) {
    const result = await executeAudit(args);
    const body = renderAuditSummaryMarkdown(result);
    core.info(`Dry run: issue not created/updated.\n${body}`);
    return;
  }
  await audit({
    args,
    params: { owner, repo, token, title: issueTitle },
  });
}
