import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertInput,
  boolify,
  parseListInput,
  prularize,
  sprintf,
} from "./index";

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

describe("sprintf", () => {
  it("should replace %s with string arguments", () => {
    const result = sprintf("Hello %s", "world");
    expect(result).toBe("Hello world");
  });

  it("should replace multiple %s placeholders", () => {
    const result = sprintf("%s %s %s", "foo", "bar", "baz");
    expect(result).toBe("foo bar baz");
  });

  it("should replace %s with number arguments", () => {
    const result = sprintf("Count: %s", 42);
    expect(result).toBe("Count: 42");
  });

  it("should handle mixed string and number arguments", () => {
    const result = sprintf("%s has %s items", "Alice", 5);
    expect(result).toBe("Alice has 5 items");
  });

  it("should return template unchanged when no %s placeholders", () => {
    const result = sprintf("no placeholders here");
    expect(result).toBe("no placeholders here");
  });

  it("should handle empty string arguments", () => {
    const result = sprintf("Value: %s", "");
    expect(result).toBe("Value: ");
  });

  it("should ignore extra arguments", () => {
    const result = sprintf("Only %s", "this", "ignored", "too");
    expect(result).toBe("Only this");
  });

  it("should leave unreplaced %s when no arguments provided", () => {
    const result = sprintf("Missing %s and %s");
    expect(result).toBe("Missing  and ");
  });
});

describe("prularize", () => {
  it("should return singular form when count is 1", () => {
    const result = prularize(1, "item");
    expect(result).toBe("1 item");
  });

  it("should return plural form when count is 0", () => {
    const result = prularize(0, "item");
    expect(result).toBe("0 items");
  });

  it("should return plural form when count is greater than 1", () => {
    const result = prularize(5, "item");
    expect(result).toBe("5 items");
  });

  it("should use custom plural form when provided", () => {
    const result = prularize(2, "person", "people");
    expect(result).toBe("2 people");
  });

  it("should use custom plural form with singular count", () => {
    const result = prularize(1, "person", "people");
    expect(result).toBe("1 person");
  });

  it("should handle large numbers", () => {
    const result = prularize(1000, "file");
    expect(result).toBe("1000 files");
  });

  it("should handle negative numbers as plural", () => {
    const result = prularize(-5, "error");
    expect(result).toBe("-5 errors");
  });
});
