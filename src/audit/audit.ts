import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getOctokit } from "@actions/github";
import type * as gh from "@actions/github/lib/utils";
import { renderAuditSummaryMarkdown, renderIssueBody } from "./markdown";
import { AuditIssueParams, AuditResult } from "./types";

type Github = InstanceType<typeof gh.GitHub>;
const kLabelColor = "#fbca04";

function buildCommentMarker(result: AuditResult): string {
  return `<!-- cage-audit:service=${result.service} -->`;
}

function buildCommentBody(result: AuditResult): string {
  const marker = buildCommentMarker(result);
  return [marker, renderAuditSummaryMarkdown(result)].join("\n");
}

export async function runCageAudit(args: string[]): Promise<string> {
  const { stdout: outText } = await exec.getExecOutput("cage", [
    "audit",
    ...args,
    "--json",
  ]);
  return outText;
}

export function parseAuditJson(raw: string): AuditResult {
  const parsed = JSON.parse(raw);
  return parsed as AuditResult;
}

export async function executeAudit(args: string[]): Promise<AuditResult> {
  const raw = await runCageAudit(args);
  return parseAuditJson(raw);
}

export async function findIssueByTitle({
  github,
  owner,
  repo,
  title,
}: {
  github: Github;
  owner: string;
  repo: string;
  title: string;
}) {
  const me = await github.rest.users.getAuthenticated();
  const perPage = 100;
  let page = 1;
  // Paginate through all matching issues to ensure we don't miss any beyond the first page.
  // Stop when we either find a matching issue or there are no more pages.
  // We intentionally keep the existing filters (state, label, creator) to avoid changing behavior.
  while (true) {
    const issuesResp = await github.rest.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: perPage,
      page,
      labels: "canarycage",
      creator: me.data.login,
    });
    const issues = issuesResp.data;
    const match = issues.find(
      (issue) => !issue.pull_request && issue.title === title,
    );
    if (match) {
      return match;
    }
    if (issues.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

export async function ensureLabel({
  github,
  owner,
  repo,
  name,
}: {
  github: Github;
  owner: string;
  repo: string;
  name: string;
}) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name });
  } catch (e: any) {
    if (e?.status !== 404) {
      throw e;
    }
    await github.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: kLabelColor.slice(1),
      description: "cage audit reports",
    });
  }
}

export async function ensureIssue(github: Github, params: AuditIssueParams) {
  const { owner, repo, title } = params;
  const existing = await findIssueByTitle({ github, owner, repo, title });
  if (existing) {
    const hasCanaryCageLabel = existing.labels
      .map((l) => (typeof l === "string" ? l : l.name))
      .some((v) => v === "canarycage");
    if (!hasCanaryCageLabel) {
      throw new Error(
        `Issue ${owner}/${repo}#${existing.number} does not have canarycage label.`,
      );
    }
    return existing;
  }
  const created = await github.rest.issues.create({
    owner,
    repo,
    title,
    body: renderIssueBody(),
    labels: ["canarycage"],
  });
  return created.data;
}

async function pinIssue(
  github: Github,
  owner: string,
  repo: string,
  issueNumber: number,
) {
  await github.request("PUT /repos/{owner}/{repo}/issues/{issue_number}/pin", {
    owner,
    repo,
    issue_number: issueNumber,
    headers: {
      accept: "application/vnd.github+json",
    },
  });
}

export async function findIssueComment({
  issueNumber,
  github,
  result,
  owner,
  repo,
}: {
  github: Github;
  result: AuditResult;
  owner: string;
  repo: string;
  issueNumber: number;
}) {
  const marker = buildCommentMarker(result);
  let page = 1;
  const perPage = 100;
  while (true) {
    const comments = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
      page,
    });
    const match = comments.data.find(
      (comment) =>
        typeof comment.body === "string" && comment.body.includes(marker),
    );
    if (match) {
      return match;
    }
    if (comments.data.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

async function addIssueComment({
  github,
  owner,
  repo,
  issueNumber,
  result,
}: {
  github: Github;
  owner: string;
  repo: string;
  issueNumber: number;
  result: AuditResult;
}) {
  const existing = await findIssueComment({
    github,
    owner,
    repo,
    issueNumber,
    result,
  });
  const body = buildCommentBody(result);
  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return;
  }
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

export async function audit({
  args,
  issue,
}: {
  args: string[];
  issue: AuditIssueParams;
}): Promise<void> {
  const result = await executeAudit(args);
  const github = getOctokit(issue.token);
  core.info(
    `Creating or updating issue: ${issue.owner}/${issue.repo}#${issue.title}`,
  );
  await ensureLabel({
    github,
    owner: issue.owner,
    repo: issue.repo,
    name: "canarycage",
  });
  const updated = await ensureIssue(github, issue);
  core.info(`Issue ready: ${updated.html_url}`);
  await addIssueComment({
    github,
    owner: issue.owner,
    repo: issue.repo,
    issueNumber: updated.number,
    result,
  });
  core.info(`Comment added: #${updated.number}`);
  await pinIssue(github, issue.owner, issue.repo, updated.number);
  core.info(`Issue pinned: #${updated.number}`);
}
