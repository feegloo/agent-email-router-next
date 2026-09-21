import { describe, expect, it } from "vitest";
import { lastLogLines } from "./ollama-logs";

describe("raw container log tail", () => {
  it("keeps only the latest two complete lines", () => {
    expect(lastLogLines("old\nloading\ngenerating\npartial")).toEqual(["loading", "generating"]);
  });
  it("discards a partial first line from a bounded read", () => {
    expect(lastLogLines("truncated\ncomplete\n", true)).toEqual(["complete"]);
  });
  it("handles empty and CRLF output", () => {
    expect(lastLogLines("")).toEqual([]);
    expect(lastLogLines("first\r\n\nsecond\r\n")).toEqual(["first", "second"]);
  });
});
