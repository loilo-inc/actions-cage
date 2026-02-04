import { describe, expect, test } from "vitest";
import { Release } from "./type";
import {
  getValidCandidate,
  isValidRelease,
  releaseToCageInfo,
} from "./validator";

describe("isValidRelease", () => {
  test("returns true for valid release with checksum and zip asset", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        { name: "canarycage_1.0.0_checksums.txt", browser_download_url: "" },
        { name: "canarycage_linux_amd64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(true);
  });

  test("returns false for invalid semver", () => {
    const release: Release = {
      tag_name: "invalid-version",
      assets: [
        { name: "canarycage_1.0.0_checksums.txt", browser_download_url: "" },
        { name: "canarycage_linux_amd64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(false);
  });

  test("returns false for prerelease when usePreRelease is false", () => {
    const release: Release = {
      tag_name: "1.0.0-beta.1",
      assets: [
        {
          name: "canarycage_1.0.0-beta.1_checksums.txt",
          browser_download_url: "",
        },
        { name: "canarycage_linux_amd64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(false);
  });

  test("returns true for prerelease when usePreRelease is true", () => {
    const release: Release = {
      tag_name: "1.0.0-beta.1",
      assets: [
        {
          name: "canarycage_1.0.0-beta.1_checksums.txt",
          browser_download_url: "",
        },
        { name: "canarycage_linux_amd64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: true,
        platform: "linux_amd64",
      }),
    ).toBe(true);
  });

  test("returns false when checksum asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        { name: "canarycage_linux_amd64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(false);
  });

  test("returns false when zip asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        { name: "canarycage_1.0.0_checksums.txt", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(false);
  });

  test("returns false when platform-specific zip asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        { name: "canarycage_1.0.0_checksums.txt", browser_download_url: "" },
        { name: "canarycage_darwin_arm64.zip", browser_download_url: "" },
      ],
    };
    expect(
      isValidRelease({
        release,
        usePreRelease: false,
        platform: "linux_amd64",
      }),
    ).toBe(false);
  });
});

describe("getValidCandidate", () => {
  test("filters out releases without required platform assets", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums.txt",
          },
          {
            name: "canarycage_darwin_arm64.zip",
            browser_download_url: "http://example.com/darwin.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0",
        assets: [
          {
            name: "canarycage_2.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({ releases, platform: "linux_amd64" });
    expect(result?.version).toBe("2.0.0");
  });

  test("returns undefined when all releases are missing checksum files", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({ releases, platform: "linux_amd64" });
    expect(result).toBeUndefined();
  });

  test("correctly sorts releases by semver", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "1.10.0",
        assets: [
          {
            name: "canarycage_1.10.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
      {
        tag_name: "1.2.0",
        assets: [
          {
            name: "canarycage_1.2.0_checksums.txt",
            browser_download_url: "http://example.com/checksums3.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux3.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({ releases, platform: "linux_amd64" });
    expect(result?.version).toBe("1.10.0");
  });

  test("returns latest release when no requiredVersion is specified", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0",
        assets: [
          {
            name: "canarycage_2.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({ releases, platform: "linux_amd64" });
    expect(result?.version).toBe("2.0.0");
  });

  test("returns specific version when requiredVersion matches", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0",
        assets: [
          {
            name: "canarycage_2.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({
      releases,
      platform: "linux_amd64",
      requiredVersion: "1.0.0",
    });
    expect(result?.version).toBe("1.0.0");
  });

  test("returns undefined when requiredVersion does not exist", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({
      releases,
      platform: "linux_amd64",
      requiredVersion: "3.0.0",
    });
    expect(result).toBeUndefined();
  });

  test("marks requiredVersion as latest when it is the latest", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0",
        assets: [
          {
            name: "canarycage_2.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({
      releases,
      platform: "linux_amd64",
      requiredVersion: "2.0.0",
    });
    expect(result?.version).toBe("2.0.0");
  });

  test("filters out prereleases when usePreRelease is false", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0-beta.1",
        assets: [
          {
            name: "canarycage_2.0.0-beta.1_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({
      releases,
      platform: "linux_amd64",
      usePreRelease: false,
    });
    expect(result?.version).toBe("1.0.0");
  });

  test("includes prereleases when usePreRelease is true", () => {
    const releases: Release[] = [
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "2.0.0-beta.1",
        assets: [
          {
            name: "canarycage_2.0.0-beta.1_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({
      releases,
      platform: "linux_amd64",
      usePreRelease: true,
    });
    expect(result?.version).toBe("2.0.0-beta.1");
  });

  test("filters out releases with invalid semver", () => {
    const releases: Release[] = [
      {
        tag_name: "invalid",
        assets: [
          {
            name: "canarycage_invalid_checksums.txt",
            browser_download_url: "http://example.com/checksums1.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux1.zip",
          },
        ],
      },
      {
        tag_name: "1.0.0",
        assets: [
          {
            name: "canarycage_1.0.0_checksums.txt",
            browser_download_url: "http://example.com/checksums2.txt",
          },
          {
            name: "canarycage_linux_amd64.zip",
            browser_download_url: "http://example.com/linux2.zip",
          },
        ],
      },
    ];
    const result = getValidCandidate({ releases, platform: "linux_amd64" });
    expect(result?.version).toBe("1.0.0");
  });

  test("returns undefined when releases array is empty", () => {
    const result = getValidCandidate({ releases: [], platform: "linux_amd64" });
    expect(result).toBeUndefined();
  });
});

describe("releaseToCageInfo", () => {
  test("returns CageInfo with correct properties", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        {
          name: "canarycage_1.0.0_checksums.txt",
          browser_download_url: "http://example.com/checksums.txt",
        },
        {
          name: "canarycage_linux_amd64.zip",
          browser_download_url: "http://example.com/linux.zip",
        },
      ],
    };
    const result = releaseToCageInfo(release, "linux_amd64");
    expect(result.version).toBe("1.0.0");
    expect(result.checksumsUrl).toBe("http://example.com/checksums.txt");
    expect(result.assetUrl).toBe("http://example.com/linux.zip");
    expect(result.assetName).toBe("canarycage_linux_amd64.zip");
  });

  test("throws error when checksum asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        {
          name: "canarycage_linux_amd64.zip",
          browser_download_url: "http://example.com/linux.zip",
        },
      ],
    };
    expect(() => releaseToCageInfo(release, "linux_amd64")).toThrow(
      "Invalid release: 1.0.0",
    );
  });

  test("throws error when zip asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        {
          name: "canarycage_1.0.0_checksums.txt",
          browser_download_url: "http://example.com/checksums.txt",
        },
      ],
    };
    expect(() => releaseToCageInfo(release, "linux_amd64")).toThrow(
      "Invalid release: 1.0.0",
    );
  });

  test("throws error when platform-specific zip asset is missing", () => {
    const release: Release = {
      tag_name: "1.0.0",
      assets: [
        {
          name: "canarycage_1.0.0_checksums.txt",
          browser_download_url: "http://example.com/checksums.txt",
        },
        {
          name: "canarycage_darwin_arm64.zip",
          browser_download_url: "http://example.com/darwin.zip",
        },
      ],
    };
    expect(() => releaseToCageInfo(release, "linux_amd64")).toThrow(
      "Invalid release: 1.0.0",
    );
  });

  test("works with different platforms", () => {
    const release: Release = {
      tag_name: "2.0.0",
      assets: [
        {
          name: "canarycage_2.0.0_checksums.txt",
          browser_download_url: "http://example.com/checksums.txt",
        },
        {
          name: "canarycage_darwin_arm64.zip",
          browser_download_url: "http://example.com/darwin.zip",
        },
      ],
    };
    const result = releaseToCageInfo(release, "darwin_arm64");
    expect(result.assetName).toBe("canarycage_darwin_arm64.zip");
    expect(result.assetUrl).toBe("http://example.com/darwin.zip");
  });
});
