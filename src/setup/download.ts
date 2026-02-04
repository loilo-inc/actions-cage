import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { CageInfo } from "./type";

export async function downloadCage({
  assetUrl,
  checksumsUrl,
  assetName,
  version,
}: CageInfo) {
  console.log("🥚 Installing cage...");
  if (!assetUrl.startsWith("https://")) {
    throw new Error(`asset.url is not secure: ${assetUrl}`);
  }
  if (!checksumsUrl.startsWith("https://")) {
    throw new Error(`checksumsUrl is not secure: ${checksumsUrl}`);
  }
  const checksumsContent = await tc.downloadTool(checksumsUrl);
  const checksumEntries = await parseChecksum(checksumsContent);
  const hash = checksumEntries.get(assetName);
  if (!hash) throw new Error(`Checksum not found for ${assetName}`);
  const zip = await tc.downloadTool(assetUrl);
  const zipFile = await fs.open(zip, "r");
  let zipHash: string;
  try {
    zipHash = await sha256hashAsync(zipFile.createReadStream());
  } finally {
    await zipFile.close();
  }
  if (zipHash !== hash) {
    throw new Error(`Checksum mismatch: expected=${hash}, actual=${zipHash}`);
  }
  const extracted = await tc.extractZip(zip);
  const installed = await tc.cacheDir(extracted, "cage", version);
  core.addPath(installed);
  console.log(`🐣 cage has been installed at '${installed}/cage'`);
}

export async function parseChecksum(
  file: string,
): Promise<Map<string, string>> {
  const buf = await fs.readFile(file, "utf-8");
  const entries: [string, string][] = buf
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s{2,}(.+)$/);
      if (!match) {
        throw new Error(`Malformed checksum line: "${line}"`);
      }
      const hash = match[1];
      const filename = match[2];
      return [filename, hash];
    });
  return new Map(entries);
}

async function sha256hashAsync(stream: NodeJS.ReadableStream): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    hash.on("finish", () => resolve(hash.digest("hex")));
    hash.on("error", reject);
    stream.pipe(hash);
  });
}
