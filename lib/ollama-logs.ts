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

// Each connection owns a byte cursor. Identical consecutive lines are distinct.
export function createLogReader(path: string) {
  let offset = 0;
  let inode: number | undefined;
  return async (): Promise<string[]> => {
    const file = await open(path, "r");
    try {
      const stat = await file.stat();
      const initial = inode === undefined || inode !== stat.ino || stat.size < offset;
      if (initial) offset = Math.max(0, stat.size - 16_384);
      inode = stat.ino;
      const skipPartial = initial && offset > 0;
      const buffer = Buffer.alloc(Math.min(stat.size - offset, 65_536));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
      const end = buffer.subarray(0, bytesRead).lastIndexOf(10);
      if (end < 0) return [];
      offset += end + 1;
      const lines = buffer.subarray(0, end).toString("utf8").split("\n").map((line) => line.replace(/\r$/, ""));
      if (skipPartial) lines.shift();
      return initial ? lines.slice(-3) : lines;
    } finally {
      await file.close();
    }
  };
}
