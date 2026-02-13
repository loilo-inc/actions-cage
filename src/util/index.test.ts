import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertInput, boolify, parseListInput } from "./index";

vi.mock("@actions/core");

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

describe("parseListInput", () => {
  it("should parse single line input", () => {
    const result = parseListInput("item1");
    expect(result).toEqual(["item1"]);
  });

  it("should parse multiple lines separated by newline", () => {
    const result = parseListInput("item1\nitem2\nitem3");
    expect(result).toEqual(["item1", "item2", "item3"]);
  });

  it("should trim whitespace from each line", () => {
    const result = parseListInput("  item1  \n  item2  \n  item3  ");
    expect(result).toEqual(["item1", "item2", "item3"]);
  });

  it("should filter out empty lines", () => {
    const result = parseListInput("item1\n\nitem2\n\n\nitem3");
    expect(result).toEqual(["item1", "item2", "item3"]);
  });

  it("should return empty array for empty input", () => {
    const result = parseListInput("");
    expect(result).toEqual([]);
  });

  it("should handle mixed line separators", () => {
    const result = parseListInput("item1\nitem2\r\nitem3\r\nitem4");
    expect(result).toEqual(["item1", "item2", "item3", "item4"]);
  });
});
