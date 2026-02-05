import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getOctokit } from "@actions/github";
import type * as gh from "@actions/github/lib/utils";
import { AuditIssueParams, AuditResult } from "./types";

type Github = InstanceType<typeof gh.GitHub>;

function markdownEscape(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderAuditSummaryMarkdown(result: AuditResult): string {
  const meta = [
    `- Region: \`${result.region}\``,
    `- Cluster: \`${result.cluster}\``,
    `- Service: \`${result.service}\``,
    `- Scanned At: \`${result.scanned_at}\``,
    `- Highest Severity: \`${result.summary.highest_severity}\``,
  ];

  const summaryTable = [
    "| Critical | High | Medium | Low | Info | Total |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${result.summary.critical_count} | ${result.summary.high_count} | ${result.summary.medium_count} | ${result.summary.low_count} | ${result.summary.info_count} | ${result.summary.total_count} |`,
  ];

  const vulnsHeader = [
    "| Severity | CVE | Package | Version | Containers |",
    "| --- | --- | --- | --- | --- |",
  ];

  const vulnsRows = result.vulns.map((v) => {
    const sev = v.cve.severity;
    const cve = `[${markdownEscape(v.cve.name)}](${v.cve.uri})`;
    const pkg = markdownEscape(v.cve.package_name);
    const ver = markdownEscape(v.cve.package_version);
    const containers = markdownEscape(v.containers.join(", "));
    return `| ${sev} | ${cve} | ${pkg} | ${ver} | ${containers} |`;
  });

  const vulnsSection =
    result.vulns.length === 0
      ? ["No vulnerabilities found."]
      : [...vulnsHeader, ...vulnsRows];

  return [
    "## Scan Summary",
    ...meta,
    "",
    ...summaryTable,
    "",
    `## Vulnerabilities (${result.summary.total_count})`,
    ...vulnsSection,
  ].join("\n");
}

function renderIssueBody(): string {
  return [
    "Cage audit report.",
    "",
    "Results are posted as comments per service.",
  ].join("\n");
}

function buildCommentMarker(result: AuditResult): string {
  return `<!-- cage-audit:service=${result.service} -->`;
}

function buildCommentBody(result: AuditResult): string {
  const marker = buildCommentMarker(result);
  return [marker, renderAuditSummaryMarkdown(result)].join("\n");
}

export async function runCageAudit(args: string[]): Promise<string> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const listeners = {
    stdout: (data: Buffer) => stdout.push(data.toString()),
    stderr: (data: Buffer) => stderr.push(data.toString()),
  };
  const code = await exec.exec("cage", ["audit", ...args, "--json"], {
    listeners,
    ignoreReturnCode: true,
  });
  const outText = stdout.join("");
  const errText = stderr.join("");
  if (code !== 0) {
    const detail = [outText, errText].filter(Boolean).join("\n");
    throw new Error(`cage audit failed with exit code ${code}\n${detail}`);
  }
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

async function findIssueByTitle(
  github: Github,
  owner: string,
  repo: string,
  title: string,
) {
  const me = await github.rest.users.getAuthenticated();
  const issuesResp = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    per_page: 100,
    labels: "canarycage",
    creator: me.data.login,
  });
  const issues = issuesResp.data;
  const match = issues.find(
    (issue) => !issue.pull_request && issue.title === title,
  );
  return match ?? null;
}

async function ensureLabel(
  github: Github,
  owner: string,
  repo: string,
  name: string,
) {
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
const kLabelColor = "#fbca04";

async function ensureIssue(github: Github, params: AuditIssueParams) {
  const { owner, repo, title } = params;
  const existing = await findIssueByTitle(github, owner, repo, title);
  if (existing) {
    if (existing.state !== "open") {
      throw new Error(`Issue ${owner}/${repo}#${existing.number} is not open.`);
    }
    const existingLabels = existing.labels
      .map((l) => (typeof l === "string" ? l : l.name))
      .some((v) => v === "canarycage");
    if (!existingLabels) {
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

async function addIssueComment(
  github: Github,
  owner: string,
  repo: string,
  issueNumber: number,
  result: AuditResult,
) {
  const marker = buildCommentMarker(result);
  const commentsResp = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const comments = commentsResp.data;
  const existing = comments.find(
    (comment) =>
      typeof comment.body === "string" && comment.body.includes(marker),
  );
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
  await ensureLabel(github, issue.owner, issue.repo, "canarycage");
  const updated = await ensureIssue(github, issue);
  core.info(`Issue ready: ${updated.html_url}`);
  await addIssueComment(
    github,
    issue.owner,
    issue.repo,
    updated.number,
    result,
  );
  core.info(`Comment added: #${updated.number}`);
  await pinIssue(github, issue.owner, issue.repo, updated.number);
  core.info(`Issue pinned: #${updated.number}`);
}
