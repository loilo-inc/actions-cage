import { describe, expect, test, vi } from "vitest";
import * as mod from "./build";
import { main } from "./main";
vi.mock("./build");

describe("main", () => {
  test("should call build when command is 'build'", async () => {
    await main(["build"]);
    expect(mod.build).toHaveBeenCalledWith({ version: "0.0.0" });
  });

  test("should call build with custom version", async () => {
    await main(["--version", "1.2.3", "build"]);
    expect(mod.build).toHaveBeenCalledWith({ version: "1.2.3" });
  });

  test("should exit with error for unknown command", async () => {
    await expect(main(["unknown"])).rejects.toThrow("Unknown command: unknown");
  });
});
