import type * as gh from "@actions/github/lib/utils";
import {
  buildCommentBody,
  buildCommentMarker,
  renderIssueBody,
} from "./markdown";
import type { AuditIssueParams, AuditResult } from "./types";

type Github = InstanceType<typeof gh.GitHub>;
const kLabelColor = "#fbca04";
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

export async function ensureIssue({
  github,
  params,
}: {
  github: Github;
  params: AuditIssueParams;
}) {
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
  const per_page = 100;
  while (true) {
    const comments = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page,
      page,
    });
    const match = comments.data.find(
      (comment) =>
        typeof comment.body === "string" && comment.body.startsWith(marker),
    );
    if (match) {
      return match;
    }
    if (comments.data.length < per_page) {
      break;
    }
    page += 1;
  }
  return null;
}

export async function addIssueComment({
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
