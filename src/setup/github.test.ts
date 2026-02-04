import { getOctokit } from "@actions/github";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchReleases } from "./github";
import type { Release } from "./type";

vi.mock("@actions/github");

describe("fetchReleases", () => {
  const mockToken = "test-token";
  const mockReleases: Release[] = [
    { tag_name: "v1.0.0" } as Release,
    { tag_name: "v1.1.0" } as Release,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch releases successfully when status is 200", async () => {
    const mockListReleases = vi.fn().mockResolvedValue({
      status: 200,
      data: mockReleases,
    });

    vi.mocked(getOctokit).mockReturnValue({
      rest: {
        repos: {
          listReleases: mockListReleases,
        },
      },
    } as any);

    const result = await fetchReleases(mockToken);

    expect(getOctokit).toHaveBeenCalledWith(mockToken);
    expect(mockListReleases).toHaveBeenCalledWith({
      owner: "loilo-inc",
      repo: "canarycage",
    });
    expect(result).toEqual(mockReleases);
  });

  it("should throw error when status is not 200", async () => {
    const mockListReleases = vi.fn().mockResolvedValue({
      status: 404,
      data: [],
    });

    vi.mocked(getOctokit).mockReturnValue({
      rest: {
        repos: {
          listReleases: mockListReleases,
        },
      },
    } as any);

    await expect(fetchReleases(mockToken)).rejects.toThrow(
      "Could not fetch versions: status=404",
    );
  });
});
