import { getOctokit } from "@actions/github";
import type { Release } from "./type";

export async function fetchReleases(token: string): Promise<Release[]> {
  const gh = getOctokit(token).rest.repos;
  const releases = await gh.listReleases({
    owner: "loilo-inc",
    repo: "canarycage",
  });
  if (releases.status === 200) {
    return releases.data;
  } else {
    throw new Error(`Could not fetch versions: status=${releases.status}`);
  }
}
