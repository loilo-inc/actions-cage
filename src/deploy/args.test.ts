import { describe, expect, test } from "vitest";
import { parseStringToArgs } from "./args";
describe("args", () => {
  test.each([
    ["--opt1 10 --opt2", ["--opt1", "10", "--opt2"]],
    [
      "--opt1 10 --opt2 --opt3 \"--foo bar\" --opt4 'o'",
      ["--opt1", "10", "--opt2", "--opt3", "--foo bar", "--opt4", "o"],
    ],
  ])("basic", (v, exp) => {
    expect(parseStringToArgs(v)).toEqual(exp);
  });
});
