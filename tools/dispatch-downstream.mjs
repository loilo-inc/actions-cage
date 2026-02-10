import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const packageToRepo = new Map([
  ["@loilo-inc/actions-setup-cage", "loilo-inc/actions-setup-cage"],
  ["@loilo-inc/actions-deploy-cage", "loilo-inc/actions-deploy-cage"],
  ["@loilo-inc/actions-audit-cage", "loilo-inc/actions-audit-cage"],
]);

export async function collectChangedRepos({
  repoRoot = process.cwd(),
  changesetDir = path.join(repoRoot, ".changeset"),
  packageMap = packageToRepo,
  logMissingDir = true,
} = {}) {
  let changesetFiles = [];
  try {
    const entries = await fs.readdir(changesetDir, { withFileTypes: true });
    changesetFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .filter((entry) => entry.name !== "README.md")
      .map((entry) => path.join(changesetDir, entry.name));
  } catch {
    if (logMissingDir) {
      console.log("No .changeset directory found. Skipping downstream dispatch.");
    }
    return { repos: [], missingChangesetDir: true };
  }

  const affectedPackages = new Set();
  for (const file of changesetFiles) {
    const content = await fs.readFile(file, "utf8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) continue;

    const frontmatter = match[1];
    for (const rawLine of frontmatter.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const entryMatch = line.match(
        /^"?([^"\s]+)"?\s*:\s*(major|minor|patch)\s*$/
      );
      if (entryMatch) affectedPackages.add(entryMatch[1]);
    }
  }

  const repos = [
    ...new Set(
      [...affectedPackages].map((pkg) => packageMap.get(pkg)).filter(Boolean)
    ),
  ];

  return { repos, missingChangesetDir: false };
}

export async function dispatchRepos({
  repos,
  releaseTag,
  dispatchToken,
  fetchImpl = fetch,
} = {}) {
  for (const repo of repos) {
    console.log(`Dispatching ${repo} with tag ${releaseTag}`);

    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${dispatchToken}`,
        },
        body: JSON.stringify({
          event_type: "release",
          client_payload: {
            tag: releaseTag,
            source: "actions-cage",
          },
        }),
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
  repoRoot = process.cwd(),
  fetchImpl = fetch,
} = {}) {
  const dispatchToken = env.DISPATCH_TOKEN || "";
  const releaseTag = env.RELEASE_TAG || "";

  if (!dispatchToken) {
    console.error("REPO_DISPATCH_TOKEN is not set.");
    return 1;
  }

  if (!releaseTag) {
    console.error("RELEASE_TAG is not set.");
    return 1;
  }

  const { repos, missingChangesetDir } = await collectChangedRepos({ repoRoot });
  if (missingChangesetDir) return 0;

  if (repos.length === 0) {
    console.log("No downstream packages changed. Skipping dispatch.");
    return 0;
  }

  const result = await dispatchRepos({
    repos,
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
