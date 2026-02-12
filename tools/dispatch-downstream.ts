import * as core from "@actions/core";
import process from "node:process";
import { pathToFileURL } from "node:url";

const packagesToRepo = new Map<string, string>([
  ["@loilo-inc/actions-setup-cage", "loilo-inc/actions-setup-cage"],
  ["@loilo-inc/actions-deploy-cage", "loilo-inc/actions-deploy-cage"],
  ["@loilo-inc/actions-audit-cage", "loilo-inc/actions-audit-cage"],
]);

interface DispatchResult {
  ok: boolean;
  repo?: string;
  status?: number;
  statusText?: string;
  body?: string;
}

export async function dispatchRepos({
  repo,
  githubToken,
  version,
}: {
  repo: string;
  githubToken: string;
  version: string;
}): Promise<DispatchResult> {
  const payloadBase: Record<string, unknown> = {
    event_type: "actions-cage-release",
    client_payload: { source: "actions-cage", version },
  };
  core.info(`Dispatching ${repo} with tag ${version}`);

  const response = await fetch(
    `https://api.github.com/repos/${repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify(payloadBase),
    },
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

  return { ok: true };
}

type Package = { name: string; version: string };
export async function main({
  env = process.env,
}: {
  env?: NodeJS.ProcessEnv;
} = {}): Promise<number> {
  const githubToken = core.getInput("github-token") || env.GITHUB_TOKEN || "";
  const publishedPackages =
    core.getInput("published-packages") || env.PUBLISHED_PACKAGES || "";

  if (!githubToken) {
    core.setFailed("github-token is not set.");
    return 1;
  }
  if (!publishedPackages) {
    core.setFailed("published-packages is not set.");
    return 1;
  }

  const packages: Package[] = JSON.parse(publishedPackages);
  const releases = packages.map((pkg) => {
    const repo = packagesToRepo.get(pkg.name);
    if (!repo) throw new Error(`Unknown package name: ${pkg.name}`);
    return { repo, pkg };
  });

  for (const { repo, pkg } of releases) {
    const result = await dispatchRepos({
      repo,
      githubToken,
      version: pkg.version,
    });
    if (!result.ok) {
      core.setFailed(
        `Failed to dispatch to ${repo}: ${result.status} ${result.statusText}\n${result.body}`,
      );
      return 1;
    }
  }

  return 0;
}

if (pathToFileURL(process.argv[1] || "").href === import.meta.url) {
  const code = await main();
  process.exit(code);
}
