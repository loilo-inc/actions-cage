import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertInput, boolify } from "./gha";

vi.mock("@actions/core");

describe("gha", () => {
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
  });

  describe("boolify", () => {
    it("should return true for truthy strings and false for falsy values", () => {
      expect(boolify("true")).toBe(true);
      expect(boolify("yes")).toBe(true);
      expect(boolify("")).toBe(false);
      expect(boolify("false")).toBe(false);
      expect(boolify("0")).toBe(false);
      expect(boolify("undefined")).toBe(false);
      expect(boolify("null")).toBe(false);
    });
  });
});
