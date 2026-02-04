import { describe, expect, it, vi } from "vitest";
import { setup } from "./index";
import * as setupRunner from "./setup/runner";

vi.mock("./deploy/runner");
vi.mock("./setup/runner");

describe("index", () => {
  it("should call setup runner", async () => {
    const mockRun = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(setupRunner, "run").mockImplementation(mockRun);

    await setup();

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("should handle errors from setup runner", async () => {
    const mockError = new Error("setup error");
    vi.spyOn(setupRunner, "run").mockRejectedValue(mockError);
    const mockCore = await import("@actions/core");
    vi.spyOn(mockCore, "error").mockImplementation(() => {});
    vi.spyOn(mockCore, "setFailed").mockImplementation(() => {});

    await setup();

    expect(mockCore.error).toHaveBeenCalledWith(mockError);
    expect(mockCore.setFailed).toHaveBeenCalledWith("see error above");
  });
});
