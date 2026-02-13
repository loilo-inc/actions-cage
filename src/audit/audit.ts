import * as core from "@actions/core";

import { getOctokit } from "@actions/github";
import { executeCageAudit } from "./audit-cage";
import { ensureLabel, findIssueByTitle, upsertIssue } from "./audit-github";
import { renderAuditSummary } from "./markdown";
import { AuditIssueParams, AuditResult } from "./types";

export async function audit({
  argsList,
  params,
}: {
  argsList: string[][];
  params: AuditIssueParams;
}): Promise<void> {
  const results: AuditResult[] = [];
  for (const args of argsList) {
    const result = await executeCageAudit(args);
    results.push(result);
  }
  const allTotal = results.reduce((sum, r) => sum + r.summary.total_count, 0);
  const { owner, repo, title, dryRun } = params;
  const body = renderAuditSummary(results);
  if (dryRun) {
    core.info(`Dry run: issue not created/updated.\n${body}`);
    return;
  }
  const github = getOctokit(params.token);
  const existing = await findIssueByTitle({ github, owner, repo, title });
  if (allTotal === 0) {
    core.info(`No vulnerabilities found.`);
    if (existing) {
      core.info(`Closing existing issue #${existing.number}.`);
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: existing.number,
        state: "closed",
        state_reason: "completed",
      });
    } else {
      core.info(`No existing issue to close.`);
    }
    return;
  }
  core.info(
    `Creating or updating issue '${params.title}' in ${params.owner}/${params.repo}`,
  );
  await ensureLabel({
    github,
    owner: params.owner,
    repo: params.repo,
    name: "canarycage",
  });
  const updated = await upsertIssue({ github, params, body });
  core.info(`Issue ready: ${updated.html_url}`);
}
