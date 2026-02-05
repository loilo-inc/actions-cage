import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as modAudit from "./audit/runner";
import * as modDeploy from "./deploy/runner";
import { audit, deploy, setup } from "./index";
import * as modSetup from "./setup/runner";

vi.mock("@actions/core");
vi.mock("./audit/runner");
vi.mock("./deploy/runner");
vi.mock("./setup/runner");

describe("index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deploy", () => {
    it("should call modDeploy.run successfully", async () => {
      vi.mocked(modDeploy.run).mockResolvedValue(undefined);
      await deploy();
      expect(modDeploy.run).toHaveBeenCalled();
    });

    it("should handle errors from modDeploy.run", async () => {
      const error = new Error("Deploy failed");
      vi.mocked(modDeploy.run).mockRejectedValue(error);
      await deploy();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });

  describe("audit", () => {
    it("should call modAudit.run successfully", async () => {
      vi.mocked(modAudit.run).mockResolvedValue(undefined);
      await audit();
      expect(modAudit.run).toHaveBeenCalled();
    });

    it("should handle errors from modAudit.run", async () => {
      const error = new Error("Audit failed");
      vi.mocked(modAudit.run).mockRejectedValue(error);
      await audit();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });

  describe("setup", () => {
    it("should call modSetup.run successfully", async () => {
      vi.mocked(modSetup.run).mockResolvedValue(undefined);
      await setup();
      expect(modSetup.run).toHaveBeenCalled();
    });

    it("should handle errors from modSetup.run", async () => {
      const error = new Error("Setup failed");
      vi.mocked(modSetup.run).mockRejectedValue(error);
      await setup();
      expect(core.error).toHaveBeenCalledWith(error);
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });

    it("should call setFailed for non-Error rejections", async () => {
      vi.mocked(modSetup.run).mockRejectedValue("string error");
      await setup();
      expect(core.error).not.toHaveBeenCalled();
      expect(core.setFailed).toHaveBeenCalledWith("see error above");
    });
  });
});
