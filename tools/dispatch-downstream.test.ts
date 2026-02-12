import * as core from "@actions/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./dispatch-downstream";

vi.mock("@actions/core");
vi.mock("node:process", () => ({
  default: {
    env: {},
    exit: vi.fn(),
    argv: [],
  },
}));

describe("main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 1 when github-token is not set", async () => {
    vi.mocked(core.getInput).mockReturnValue("");
    const result = await main({ env: { GITHUB_TOKEN: "" } });
    expect(result).toBe(1);
    expect(vi.mocked(core.setFailed)).toHaveBeenCalledWith(
      "github-token is not set.",
    );
  });

  it("returns 1 when published-packages is not set", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "github-token") return "token123";
      return "";
    });
    const result = await main({ env: { GITHUB_TOKEN: "" } });
    expect(result).toBe(1);
    expect(vi.mocked(core.setFailed)).toHaveBeenCalledWith(
      "published-packages is not set.",
    );
  });

  it("returns 0 on successful dispatch", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "github-token") return "token123";
      if (name === "published-packages")
        return JSON.stringify([
          { name: "@loilo-inc/actions-setup-cage", version: "1.0.0" },
        ]);
      return "";
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const result = await main();
    expect(result).toBe(0);
  });

  it("returns 1 when dispatch fails", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "github-token") return "token123";
      if (name === "published-packages")
        return JSON.stringify([
          { name: "@loilo-inc/actions-setup-cage", version: "1.0.0" },
        ]);
      return "";
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve("Invalid token"),
    });

    const result = await main();
    expect(result).toBe(1);
    expect(vi.mocked(core.setFailed)).toHaveBeenCalled();
  });

  it("throws error for unknown package name", async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === "github-token") return "token123";
      if (name === "published-packages")
        return JSON.stringify([{ name: "@unknown/package", version: "1.0.0" }]);
      return "";
    });

    await expect(main()).rejects.toThrow("Unknown package name");
  });
});
