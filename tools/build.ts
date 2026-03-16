import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const rootDir = path.resolve(import.meta.dirname, "..");

type ActionConfig = {
  name: string;
  entryPoint: string;
  actionPath: string;
};

const actionConfigs: ActionConfig[] = [
  {
    name: "@loilo-inc/actions-setup-cage",
    entryPoint: path.join(rootDir, "lib/setup/index.ts"),
    actionPath: path.join(rootDir, "lib/setup/action.yml"),
  },
  {
    name: "@loilo-inc/actions-deploy-cage",
    entryPoint: path.join(rootDir, "lib/deploy/index.ts"),
    actionPath: path.join(rootDir, "lib/deploy/action.yml"),
  },
  {
    name: "@loilo-inc/actions-audit-cage",
    entryPoint: path.join(rootDir, "lib/audit/index.ts"),
    actionPath: path.join(rootDir, "lib/audit/action.yml"),
  },
] as const;

async function packageAction({
  buildDir,
  config,
  version,
}: {
  buildDir: string;
  config: ActionConfig;
  version: string;
}) {
  const outDir = path.join(buildDir, config.name);
  const libDir = path.join(outDir, "lib");
  await mkdir(libDir, { recursive: true });
  await Promise.all([
    build({
      absWorkingDir: rootDir,
      bundle: true,
      entryPoints: [config.entryPoint],
      format: "esm",
      outfile: path.join(libDir, "index.js"),
      platform: "node",
      sourcemap: true,
      target: "node24",
    }),
    copyFile(config.actionPath, path.join(outDir, "action.yml")),
    copyFile(path.join(rootDir, "LICENSE"), path.join(outDir, "LICENSE")),
    createPublishManifest({ outDir, packageName: config.name, version }),
  ]);
}

async function createPublishManifest({
  outDir,
  packageName,
  version,
}: {
  outDir: string;
  packageName: string;
  version: string;
}) {
  const template = await readFile(
    path.join(rootDir, "lib/package.tmpl.json"),
    "utf-8",
  );
  const source = JSON.parse(template) as {
    name: string;
    version: string;
  };
  source.name = packageName;
  source.version = version;
  await writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify(source, null, 2) + "\n",
  );
}

export async function main({
  buildDir = path.join(rootDir, "build"),
  version,
}: {
  buildDir?: string;
  version: string;
}) {
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(buildDir, { recursive: true });
  await Promise.all(
    actionConfigs.map((config) => packageAction({ buildDir, config, version })),
  );
}

if (import.meta.main) {
  const version = parseArgs({
    options: { version: { type: "string", default: "0.0.0" } },
  }).values.version;
  await main({ version });
}
