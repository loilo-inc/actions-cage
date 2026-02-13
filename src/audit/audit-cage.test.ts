import * as exec from "@actions/exec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCageAudit } from "./audit-cage";
import { makeAuditResult } from "./testdata/testing";

vi.mock("@actions/github");
vi.mock("@actions/exec");
vi.mock("@actions/core");

describe("executeCageAudit", () => {
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

    await executeCageAudit(["--severity", "high"]);

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

    const result = await executeCageAudit([]);

    expect(result).toEqual(mockResult);
  });

  it("should handle empty args", async () => {
    const mockResult = makeAuditResult();
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      stdout: JSON.stringify(mockResult),
      stderr: "",
      exitCode: 0,
    });

    await executeCageAudit([]);

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

    await expect(executeCageAudit([])).rejects.toThrow(SyntaxError);
  });
});
