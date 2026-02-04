import { CageInfo } from "../type";

export const kMockPathPrefix = "/loilo-inc/canarycage/releases/download/";
export function makeTestCageInfo(
  p: Partial<CageInfo> & { version: string },
): CageInfo {
  return {
    checksumsUrl: `https://github.com${kMockPathPrefix}${p.version}/canarycage_${p.version}_checksums.txt`,
    assetUrl: `https://github.com${kMockPathPrefix}${p.version}/canarycage_linux_amd64.zip`,
    assetName: `canarycage_linux_amd64.zip`,
    ...p,
  };
}
