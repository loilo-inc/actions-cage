import * as core from "@actions/core";
import * as io from "@actions/io";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCage } from "./download";
import { fetchReleases } from "./github";
import { run } from "./runner";
import { makeTestCageInfo } from "./testdata/testing";
import { getPlatform } from "./type";
import { getValidCandidate } from "./validator";

vi.mock("./download");
vi.mock("./validator");
vi.mock("./type");
vi.mock("./github");
vi.mock("@actions/core");
vi.mock("@actions/io");

const mockCore = vi.mocked(core);
const mockIO = vi.mocked(io);

describe("setup/runner/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when github-token is missing", async () => {
    mockCore.getInput.mockReturnValue("");

    await expect(run()).rejects.toThrow("github-token is required");
  });

  it("should download cage when not installed", async () => {
    const mockCage = makeTestCageInfo({ version: "1.0.0" });
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "github-token") return "token";
      if (name === "cage-version") return "1.0.0";
      return "";
    });
    vi.mocked(fetchReleases).mockResolvedValue([]);
    vi.mocked(getPlatform).mockReturnValue("linux_amd64");
    vi.mocked(getValidCandidate).mockReturnValue(mockCage);
    mockIO.which.mockResolvedValue("");

    await run();

    expect(downloadCage).toHaveBeenCalledWith(mockCage);
  });

  it("should not download cage when already installed", async () => {
    const mockCage = makeTestCageInfo({ version: "1.0.0" });
    mockCore.getInput.mockImplementation((name) => {
      if (name === "github-token") return "token";
      if (name === "cage-version") return "1.0.0";
      return "";
    });
    vi.mocked(fetchReleases).mockResolvedValue([]);
    vi.mocked(getPlatform).mockReturnValue("linux_amd64");
    vi.mocked(getValidCandidate).mockReturnValue(mockCage);
    mockIO.which.mockResolvedValue("/usr/bin/cage");

    await run();

    expect(downloadCage).not.toHaveBeenCalled();
  });

  it("should throw error when no valid release found", async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "github-token") return "token";
      return "";
    });
    vi.mocked(fetchReleases).mockResolvedValue([]);
    vi.mocked(getPlatform).mockReturnValue("linux_amd64");
    vi.mocked(getValidCandidate).mockReturnValue(undefined);

    await expect(run()).rejects.toThrow("Could not find any valid release");
  });

  it("should log info when no version specified", async () => {
    const mockCage = makeTestCageInfo({ version: "1.0.0" });
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "github-token") return "token";
      return "";
    });
    vi.mocked(fetchReleases).mockResolvedValue([]);
    vi.mocked(getPlatform).mockReturnValue("linux_amd64");
    vi.mocked(getValidCandidate).mockReturnValue(mockCage);
    mockIO.which.mockResolvedValue("/usr/bin/cage");

    await run();

    expect(mockCore.info).toHaveBeenCalledWith(
      "No version specified. Using latest version: 1.0.0",
    );
  });

  it("should pass use-pre-release flag correctly", async () => {
    const mockCage = makeTestCageInfo({ version: "1.0.0" });
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === "github-token") return "token";
      if (name === "use-pre") return "true";
      if (name === "cage-version") return "1.0.0";
      return "";
    });
    vi.mocked(fetchReleases).mockResolvedValue([]);
    vi.mocked(getPlatform).mockReturnValue("linux_amd64");
    vi.mocked(getValidCandidate).mockReturnValue(mockCage);
    mockIO.which.mockResolvedValue("/usr/bin/cage");

    await run();

    expect(getValidCandidate).toHaveBeenCalledWith({
      releases: [],
      platform: "linux_amd64",
      usePreRelease: true,
      requiredVersion: "1.0.0",
    });
  });
});
