import * as core from "@actions/core";

import { getOctokit } from "@actions/github";
import { executeCageAudit } from "./audit-cage";
import { findIssueByTitle, upsertIssue } from "./audit-github";
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
  if (allTotal === 0) {
    core.info(`No vulnerabilities found.`);
    core.info(`Checking for existing issue to close...`);
    const github = getOctokit(params.token);
    const existing = await findIssueByTitle({ github, owner, repo, title });
    if (existing) {
      core.info(`Existing issue found: #${existing.number}. Closing it...`);
      if (dryRun) {
        core.info(`Dry run: issue not closed.`);
      } else {
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: existing.number,
          state: "closed",
          state_reason: "completed",
        });
        core.info(`Issue #${existing.number} closed.`);
      }
    } else {
      core.info(`No existing issue to close.`);
    }
    return;
  }
  const body = renderAuditSummary(results);
  if (dryRun) {
    core.info(`Dry run: issue not created/updated.\n${body}`);
  } else {
    const github = getOctokit(params.token);
    core.info(
      `Creating or updating issue '${params.title}' in ${params.owner}/${params.repo}`,
    );
    const updated = await upsertIssue({ github, params, body });
    core.info(`Issue ready: ${updated.html_url}`);
  }
}
