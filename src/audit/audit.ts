import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { getOctokit } from "@actions/github";
import type * as gh from "@actions/github/lib/utils";

type Github = InstanceType<typeof gh.GitHub>;

export type AuditSummary = {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  info_count: number;
  total_count: number;
  highest_severity: string;
};

export type AuditVuln = {
  cve: {
    name: string;
    description: string;
    package_name: string;
    package_version: string;
    uri: string;
    severity: string;
  };
  containers: string[];
};

export type AuditResult = {
  region: string;
  cluster?: string;
  service?: string;
  summary: AuditSummary;
  vulns: AuditVuln[];
  scanned_at: string;
};

export type AuditIssueParams = {
  owner: string;
  repo: string;
  token: string;
  title: string;
};

function normalizeSeverity(sev: string): string {
  return sev ? sev.toUpperCase() : "UNKNOWN";
}

function markdownEscape(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function renderAuditSummaryMarkdown(result: AuditResult): string {
  const meta = [
    `- Region: \`${result.region}\``,
    result.cluster ? `- Cluster: \`${result.cluster}\`` : null,
    result.service ? `- Service: \`${result.service}\`` : null,
    `- Scanned At: \`${result.scanned_at}\``,
    `- Highest Severity: \`${normalizeSeverity(result.summary.highest_severity)}\``,
  ].filter(Boolean);

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
    const sev = normalizeSeverity(v.cve.severity);
    const cve = v.cve.uri
      ? `[${markdownEscape(v.cve.name)}](${v.cve.uri})`
      : markdownEscape(v.cve.name);
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

async function findIssueByTitle(github: Github, owner: string, repo: string, title: string) {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "all",
    per_page: 100,
  });
  const match = issues.find(
    (issue: any) => !issue.pull_request && issue.title === title,
  );
  return match ?? null;
}

async function upsertIssue(
  github: Github,
  params: AuditIssueParams,
  body: string,
) {
  const { owner, repo, title } = params;
  const existing = await findIssueByTitle(github, owner, repo, title);
  if (existing) {
    const updated = await github.rest.issues.update({
      owner,
      repo,
      issue_number: existing.number,
      title,
      body,
      state: "open",
    });
    return updated.data;
  }
  const created = await github.rest.issues.create({
    owner,
    repo,
    title,
    body,
  });
  return created.data;
}

async function pinIssue(github: Github, owner: string, repo: string, issueNumber: number) {
  await github.request("PUT /repos/{owner}/{repo}/issues/{issue_number}/pin", {
    owner,
    repo,
    issue_number: issueNumber,
    headers: {
      accept: "application/vnd.github+json",
    },
  });
}

export async function audit({
  args,
  issue,
}: {
  args: string[];
  issue: AuditIssueParams;
}) {
  const result = await executeAudit(args);
  const body = renderAuditSummaryMarkdown(result);
  const github = getOctokit(issue.token);
  core.info(`Creating or updating issue: ${issue.owner}/${issue.repo}#${issue.title}`);
  const updated = await upsertIssue(github, issue, body);
  core.info(`Issue updated: ${updated.html_url}`);
  await pinIssue(github, issue.owner, issue.repo, updated.number);
  core.info(`Issue pinned: #${updated.number}`);
  return { result, issue: updated };
}
