import { describe, expect, it } from "vitest";
import { lastLogLines, createLogReader } from "./ollama-logs";
import { mkdtemp, writeFile, appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("raw container log tail", () => {
  it("reads every new line once, including duplicates and split records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ollama-log-test-"));
    const path = join(directory, "server.log");
    try {
      await writeFile(path, "initial\n");
      const read = createLogReader(path);
      expect(await read()).toEqual(["initial"]);
      await appendFile(path, "same\nsame\nthird\nfourth\npart");
      expect(await read()).toEqual(["same", "same", "third", "fourth"]);
      expect(await read()).toEqual([]);
      await appendFile(path, "ial\n");
      expect(await read()).toEqual(["partial"]);
      await writeFile(path, "reset\n");
      expect(await read()).toEqual(["reset"]);
    } finally {
      await rm(directory, { recursive: true });
    }
  });
  it("keeps only the latest three complete lines", () => {
    expect(lastLogLines("old\nstarting\nloading\ngenerating\npartial")).toEqual(["starting", "loading", "generating"]);
  });
  it("discards a partial first line from a bounded read", () => {
    expect(lastLogLines("truncated\ncomplete\n", true)).toEqual(["complete"]);
  });
  it("handles empty and CRLF output", () => {
    expect(lastLogLines("")).toEqual([]);
    expect(lastLogLines("first\r\n\nsecond\r\n")).toEqual(["first", "second"]);
  });
});
