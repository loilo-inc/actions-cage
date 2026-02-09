import * as exec from "@actions/exec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAudit } from "./audit-cage";
import { makeAuditResult } from "./testdata/testing";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

describe("executeAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call exec.getExecOutput with correct arguments", async () => {
    const mockResult = makeAuditResult();
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: JSON.stringify(mockResult),
      stderr: "",
      exitCode: 0,
    });

    await executeAudit(["--severity", "high"]);

    expect(exec.getExecOutput).toHaveBeenCalledWith("cage", [
      "audit",
      "--json",
      "--severity",
      "high",
    ]);
  });

  it("should parse and return the JSON output", async () => {
    const mockResult = makeAuditResult();
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: JSON.stringify(mockResult),
      stderr: "",
      exitCode: 0,
    });

    const result = await executeAudit([]);

    expect(result).toEqual(mockResult);
  });

  it("should handle empty args", async () => {
    const mockResult = makeAuditResult();
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: JSON.stringify(mockResult),
      stderr: "",
      exitCode: 0,
    });

    await executeAudit([]);

    expect(exec.getExecOutput).toHaveBeenCalledWith("cage", [
      "audit",
      "--json",
    ]);
  });

  it("should throw on invalid JSON", async () => {
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: "invalid json",
      stderr: "",
      exitCode: 0,
    });

    await expect(executeAudit([])).rejects.toThrow(SyntaxError);
  });
});
