import { describe, expect, it, vi } from "vitest";
import * as deployRunner from "./deploy/runner";
import { deploy, setup } from "./index";
import * as setupRunner from "./setup/runner";

vi.mock("./deploy/runner");
vi.mock("./setup/runner");

describe("index", () => {
  it("should export deploy function from deploy/runner", () => {
    expect(deploy).toBe(deployRunner.run);
  });

  it("should export setup function from setup/runner", () => {
    expect(setup).toBe(setupRunner.run);
  });
});
