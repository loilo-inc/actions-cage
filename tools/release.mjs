import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import semver from "semver";

const repoRoot = process.cwd();
const ref = process.env.GITHUB_REF || "";
const refName = ref.startsWith("refs/") ? ref.split("/").pop() : "";
const tag =
  process.argv[2] ||
  process.env.RELEASE_TAG ||
  process.env.GITHUB_REF_NAME ||
  refName ||
  "";

const targetVersion = semver.clean(tag);
if (!targetVersion) {
  console.error(`Invalid or missing semver tag: "${tag}"`);
  process.exit(1);
}

const changesetDir = path.join(repoRoot, ".changeset");
let changesetFiles = [];
try {
  const entries = await fs.readdir(changesetDir, { withFileTypes: true });
  changesetFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md") && e.name !== "README.md")
    .map((e) => path.join(changesetDir, e.name));
} catch {
  console.error(".changeset directory not found.");
  process.exit(1);
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
    const m = line.match(/^"?([^"\s]+)"?\s*:\s*(major|minor|patch)\s*$/);
    if (m) affectedPackages.add(m[1]);
  }
}

if (affectedPackages.size === 0) {
  console.log("No changeset packages found. Skipping version override.");
  process.exit(0);
}

const rootPkg = JSON.parse(
  await fs.readFile(path.join(repoRoot, "package.json"), "utf8")
);
const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];

const packageNameToPath = new Map();
for (const ws of workspaces) {
  const pkgPath = path.join(repoRoot, ws, "package.json");
  try {
    const pkgJson = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    if (pkgJson?.name) packageNameToPath.set(pkgJson.name, pkgPath);
  } catch {
    // Ignore missing or unreadable workspace package.json
  }
}

for (const name of affectedPackages) {
  const pkgPath = packageNameToPath.get(name);
  if (!pkgPath) {
    console.error(`Package not found for changeset entry: ${name}`);
    process.exit(1);
  }

  const pkgJson = JSON.parse(await fs.readFile(pkgPath, "utf8"));
  pkgJson.version = targetVersion;
  await fs.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n");
  console.log(`Set ${name} -> ${targetVersion}`);
}
