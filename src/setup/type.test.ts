import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatform } from "./type";

describe("getPlatform", () => {
  beforeEach(() => {
    vi.spyOn(os, "platform");
    vi.spyOn(os, "arch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should convert x64 to amd64", () => {
    vi.mocked(os.platform).mockReturnValue("linux");
    vi.mocked(os.arch).mockReturnValue("x64");

    expect(getPlatform()).toBe("linux_amd64");
  });

  it("should keep arm64 as is", () => {
    vi.mocked(os.platform).mockReturnValue("darwin");
    vi.mocked(os.arch).mockReturnValue("arm64");

    expect(getPlatform()).toBe("darwin_arm64");
  });
});
