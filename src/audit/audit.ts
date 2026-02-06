import * as core from "@actions/core";

import { getOctokit } from "@actions/github";
import { executeAudit } from "./audit-cage";
import {
  addIssueComment,
  ensureIssue,
  ensureLabel,
  findIssueByTitle,
} from "./audit-github";
import { AuditIssueParams } from "./types";

export async function audit({
  args,
  params,
}: {
  args: string[];
  params: AuditIssueParams;
}): Promise<void> {
  const result = await executeAudit(args);
  const github = getOctokit(params.token);
  const { owner, repo, title } = params;
  const existing = await findIssueByTitle({ github, owner, repo, title });
  if (result.summary.total_count === 0) {
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
  const updated = await ensureIssue({ github, params });
  core.info(`Issue ready: ${updated.html_url}`);
  await addIssueComment({
    github,
    owner: params.owner,
    repo: params.repo,
    issueNumber: updated.number,
    result,
  });
  core.info(`Comment added: #${updated.number}`);
}
