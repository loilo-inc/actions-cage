import * as core from "@actions/core";
import { parseStringToArgs } from "../util/args";
import { assertInput, boolify } from "../util/gha";
import { audit, executeAudit, renderAuditSummaryMarkdown } from "./audit";

export async function run() {
  const region = assertInput("region");
  const cluster = core.getInput("cluster");
  const service = core.getInput("service");
  const auditContext = core.getInput("audit-context");
  const cageOptions = core.getInput("cage-options");
  const token = assertInput("github-token");
  const issueTitle = core.getInput("issue-title") || `Cage audit report`;
  const repository =
    core.getInput("github-repository") || process.env.GITHUB_REPOSITORY;
  const dryRun = boolify(core.getInput("dry-run"));

  if (!auditContext && (!cluster || !service)) {
    throw new Error(
      "cluster and service are required when audit-context is not set",
    );
  }
  const [owner, repo] = repository!.split("/");
  if (!owner || !repo) {
    throw new Error("github-repository is required");
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
    issue: { owner, repo, token, title: issueTitle },
  });
}
