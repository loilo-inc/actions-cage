import process from "node:process";
import { pathToFileURL } from "node:url";

const repos = [
  "loilo-inc/actions-setup-cage",
  "loilo-inc/actions-deploy-cage",
  "loilo-inc/actions-audit-cage",
];

export async function dispatchRepos({
  repos,
  releaseTag,
  dispatchToken,
  fetchImpl = fetch,
} = {}) {
  const payloadBase = {
    event_type: "actions-cage-release",
    client_payload: {
      source: "actions-cage",
    },
  };
  if (releaseTag) {
    payloadBase.client_payload.tag = releaseTag;
  }

  for (const repo of repos) {
    console.log(
      releaseTag
        ? `Dispatching ${repo} with tag ${releaseTag}`
        : `Dispatching ${repo}`
    );

    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${dispatchToken}`,
        },
        body: JSON.stringify(payloadBase),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        repo,
        status: response.status,
        statusText: response.statusText,
        body: text,
      };
    }
  }

  return { ok: true };
}

export async function main({
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const dispatchToken = env.DISPATCH_TOKEN || "";
  const releaseTag = env.RELEASE_TAG || "";

  if (!dispatchToken) {
    console.error("REPO_DISPATCH_TOKEN is not set.");
    return 1;
  }

  const uniqueRepos = [...new Set(repos)];

  const result = await dispatchRepos({
    repos: uniqueRepos,
    releaseTag,
    dispatchToken,
    fetchImpl,
  });

  if (!result.ok) {
    console.error(
      `Dispatch failed for ${result.repo}: ${result.status} ${result.statusText}`
    );
    if (result.body) console.error(result.body);
    return 1;
  }

  return 0;
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  const code = await main();
  if (code !== 0) process.exit(code);
}
