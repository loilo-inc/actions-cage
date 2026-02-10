import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectChangedRepos } from "./dispatch-downstream.mjs";

const makeTempDir = async () =>
  await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-downstream-"));

const writeChangeset = async (dir: string, name: string, content: string) => {
  const changesetDir = path.join(dir, ".changeset");
  await fs.mkdir(changesetDir, { recursive: true });
  await fs.writeFile(path.join(changesetDir, name), content, "utf8");
};

describe("collectChangedRepos", () => {
  let tempDir: string | null = null;

  beforeEach(async () => {
    tempDir = await makeTempDir();
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("maps changed packages to downstream repos", async () => {
    await writeChangeset(
      tempDir!,
      "one.md",
      `---\n"@loilo-inc/actions-setup-cage": patch\n"@loilo-inc/actions-deploy-cage": minor\n---\n\n- change\n`
    );

    const result = await collectChangedRepos({
      repoRoot: tempDir!,
      logMissingDir: false,
    });

    expect(result.missingChangesetDir).toBe(false);
    expect(result.repos.sort()).toEqual([
      "loilo-inc/actions-deploy-cage",
      "loilo-inc/actions-setup-cage",
    ]);
  });

  it("deduplicates repos and ignores unknown packages", async () => {
    await writeChangeset(
      tempDir!,
      "one.md",
      `---\n"@loilo-inc/actions-setup-cage": patch\n"@loilo-inc/actions-setup-cage": minor\n"@loilo-inc/unknown": patch\n---\n`
    );
    await writeChangeset(
      tempDir!,
      "two.md",
      `---\n"@loilo-inc/actions-setup-cage": patch\n---\n`
    );

    const result = await collectChangedRepos({
      repoRoot: tempDir!,
      logMissingDir: false,
    });

    expect(result.repos).toEqual(["loilo-inc/actions-setup-cage"]);
  });

  it("returns missingChangesetDir when .changeset is absent", async () => {
    const result = await collectChangedRepos({
      repoRoot: tempDir!,
      logMissingDir: false,
    });

    expect(result.missingChangesetDir).toBe(true);
    expect(result.repos).toEqual([]);
  });
});
