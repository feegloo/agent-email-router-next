import { open } from "node:fs/promises";

export function lastLogLines(text: string, skipPartial = false): string[] {
  const lines = text.split("\n");
  if (skipPartial) lines.shift();
  // Only publish complete lines; the writer may be midway through a record.
  lines.pop();
  return lines.map((line) => line.replace(/\r$/, "")).filter(Boolean).slice(-3);
}

export async function readLogTail(path: string): Promise<string[]> {
  const file = await open(path, "r");
  try {
    const { size } = await file.stat();
    const offset = Math.max(0, size - 16_384);
    const buffer = Buffer.alloc(size - offset);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
    return lastLogLines(buffer.subarray(0, bytesRead).toString("utf8"), offset > 0);
  } finally {
    await file.close();
  }
}
