import semver from "semver";
import type { CageInfo, Platform, Release } from "./type";

export function isValidRelease({
  platform,
  release,
  usePreRelease,
}: {
  release: Release;
  usePreRelease: boolean;
  platform: Platform;
}): boolean {
  const version = release.tag_name;
  if (!semver.valid(version)) {
    return false;
  }
  if (!usePreRelease && semver.prerelease(version)) {
    return false;
  }
  const checksumPattern = /^canarycage_.+_checksums\.txt$/;
  const checksumsAsset = release.assets.find((asset) => {
    return checksumPattern.test(asset.name);
  });
  const zipAsset = release.assets.find(
    (asset) => asset.name === `canarycage_${platform}.zip`,
  );
  return !!(checksumsAsset && zipAsset);
}

export function getValidCandidate({
  releases,
  platform,
  requiredVersion,
  usePreRelease = false,
}: {
  releases: Release[];
  platform: Platform;
  requiredVersion?: string;
  usePreRelease?: boolean;
}): CageInfo | undefined {
  const list = releases
    .filter((release) => isValidRelease({ release, usePreRelease, platform }))
    .sort((a, b) => semver.rcompare(a.tag_name, b.tag_name));
  const latest = list.at(0);
  if (!latest) return;
  if (requiredVersion) {
    const exact = list.find((v) => v.tag_name === requiredVersion);
    if (!exact) return;
    return releaseToCageInfo(exact, platform);
  }
  return releaseToCageInfo(latest, platform);
}

export function releaseToCageInfo(
  release: Release,
  platform: Platform,
): CageInfo {
  const checksumAsset = release.assets.find((asset) =>
    /^canarycage_.+_checksums\.txt$/.test(asset.name),
  );
  const zipAsset = release.assets.find(
    (asset) => asset.name === `canarycage_${platform}.zip`,
  );
  if (!checksumAsset || !zipAsset) {
    throw new Error(`Invalid release: ${release.tag_name}`);
  }
  return {
    version: release.tag_name,
    checksumsUrl: checksumAsset.browser_download_url,
    assetUrl: zipAsset.browser_download_url,
    assetName: zipAsset.name,
  };
}
