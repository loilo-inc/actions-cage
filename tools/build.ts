import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const buildDir = path.join(rootDir, "build");
const actionConfigs = [
  {
    id: "setup",
    entryPoint: path.join(rootDir, "src/setup/setup-runner.ts"),
    manifestPath: path.join(rootDir, "src/setup/package.json"),
    actionPath: path.join(rootDir, "src/setup/action.yml"),
  },
  {
    id: "deploy",
    entryPoint: path.join(rootDir, "src/deploy/deploy-runner.ts"),
    manifestPath: path.join(rootDir, "src/deploy/package.json"),
    actionPath: path.join(rootDir, "src/deploy/action.yml"),
  },
  {
    id: "audit",
    entryPoint: path.join(rootDir, "src/audit/audit-runner.ts"),
    manifestPath: path.join(rootDir, "src/audit/package.json"),
    actionPath: path.join(rootDir, "src/audit/action.yml"),
  },
] as const;

await main();

async function main() {
  const version = parseVersionArg(process.argv.slice(2)) ?? "0.0.0";
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(buildDir, { recursive: true });
  for (const config of actionConfigs) {
    await packageAction(config, version);
  }
}

function parseVersionArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--version") {
      return args[i + 1];
    }
  }
  return undefined;
}

async function packageAction(
  config: (typeof actionConfigs)[number],
  version: string,
) {
  const outDir = path.join(buildDir, config.id);
  const libDir = path.join(outDir, "lib");
  await mkdir(libDir, { recursive: true });

  await build({
    absWorkingDir: rootDir,
    bundle: true,
    entryPoints: [config.entryPoint],
    format: "esm",
    outfile: path.join(libDir, "index.js"),
    platform: "node",
    sourcemap: true,
    target: "node24",
  });

  await copyFile(config.actionPath, path.join(outDir, "action.yml"));
  await copyFile(path.join(rootDir, "LICENSE"), path.join(outDir, "LICENSE"));

  const manifest = await createPublishManifest(config.manifestPath, version);
  await writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}

async function createPublishManifest(manifestPath: string, version: string) {
  const source = JSON.parse(await readFile(manifestPath, "utf-8")) as {
    name: string;
    version: string;
    license?: string;
    author?: string;
    bugs?: unknown;
    homepage?: string;
    publishConfig?: Record<string, unknown>;
    repository?: unknown;
  };
  return {
    name: source.name,
    version,
    license: source.license,
    author: source.author,
    bugs: source.bugs,
    files: ["lib", "action.yml", "LICENSE"],
    homepage: source.homepage,
    main: "./lib/index.js",
    publishConfig: source.publishConfig,
    repository: source.repository,
    type: "module" as const,
  };
}
