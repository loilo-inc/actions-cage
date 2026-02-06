import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertInput, boolify, parseRef } from "./gha";

vi.mock("@actions/core");

describe("gha", () => {
  describe("parseRef", () => {
    it("should parse refs/heads/master to master", () => {
      expect(parseRef("refs/heads/master")).toBe("master");
    });

    it("should parse refs/tags/v0.1.0 to v0.1.0", () => {
      expect(parseRef("refs/tags/v0.1.0")).toBe("v0.1.0");
    });

    it("should return ref unchanged if it doesn't match pattern", () => {
      expect(parseRef("master")).toBe("master");
    });

    it("should handle refs with slashes in the name", () => {
      expect(parseRef("refs/heads/feature/my-feature")).toBe(
        "feature/my-feature",
      );
    });
  });

  describe("assertInput", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return input value when provided", () => {
      vi.mocked(core.getInput).mockReturnValue("test-value");
      expect(assertInput("myInput")).toBe("test-value");
    });

    it("should throw error when input is empty", () => {
      vi.mocked(core.getInput).mockReturnValue("");
      expect(() => assertInput("myInput")).toThrow("myInput is required");
    });

    it("should throw error when input is not provided", () => {
      vi.mocked(core.getInput).mockReturnValue("");
      expect(() => assertInput("requiredField")).toThrow(
        "requiredField is required",
      );
    });

    describe("boolify", () => {
      it("should return true for truthy strings and false for falsy values", () => {
        expect(boolify("true")).toBe(true);
        expect(boolify("yes")).toBe(true);
        expect(boolify("")).toBe(false);
        expect(boolify("false")).toBe(false);
        expect(boolify("0")).toBe(false);
      });
    });
  });
});
