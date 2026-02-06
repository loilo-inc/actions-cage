import * as core from "@actions/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as modAudit from "./audit/audit-runner";
import * as modDeploy from "./deploy/deploy-runner";
import { audit, deploy, setup } from "./index";
import * as modSetup from "./setup/setup-runner";

vi.mock("@actions/core");
vi.mock("./audit/audit-runner");
vi.mock("./deploy/deploy-runner");
vi.mock("./setup/setup-runner");

describe("index", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("deploy", () => {
    it("should call run with modDeploy.run", async () => {
      vi.mocked(modDeploy.run).mockResolvedValue(undefined);
      await deploy();
      expect(modDeploy.run).toHaveBeenCalled();
    });

    it("should handle errors and call core.error and core.setFailed", async () => {
      const error = new Error("Deploy failed");
      vi.mocked(modDeploy.run).mockRejectedValue(error);
      await deploy();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });

  describe("audit", () => {
    it("should call run with modAudit.run", async () => {
      vi.mocked(modAudit.run).mockResolvedValue(undefined);
      await audit();
      expect(modAudit.run).toHaveBeenCalled();
    });

    it("should handle errors and call core.error and core.setFailed", async () => {
      const error = new Error("Audit failed");
      vi.mocked(modAudit.run).mockRejectedValue(error);
      await audit();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });

  describe("setup", () => {
    it("should call run with modSetup.run", async () => {
      vi.mocked(modSetup.run).mockResolvedValue(undefined);
      await setup();
      expect(modSetup.run).toHaveBeenCalled();
    });

    it("should handle errors and call core.error and core.setFailed", async () => {
      const error = new Error("Setup failed");
      vi.mocked(modSetup.run).mockRejectedValue(error);
      await setup();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });
});
