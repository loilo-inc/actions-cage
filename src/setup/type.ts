import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import os from "node:os";
export type Platform = `${string}_${string}`;
export type CageInfo = {
  version: string;
  checksumsUrl: string;
  assetUrl: string;
  assetName: string;
};
type _Release =
  RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][0];
type _Asset =
  RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][0]["assets"][0];

export type Release = Pick<_Release, "tag_name"> & { assets: Asset[] };
type Asset = Pick<_Asset, "name" | "browser_download_url">;

export function getPlatform(): Platform {
  const platform = os.platform();
  let arch: string = os.arch();
  if (arch === "x64") {
    arch = "amd64";
  }
  return `${platform}_${arch}`;
}
