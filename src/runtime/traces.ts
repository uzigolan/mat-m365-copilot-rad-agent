import fs from "node:fs/promises";
import path from "node:path";

const traceDir = path.resolve("traces");

export async function appendTrace(event: string, data: unknown): Promise<void> {
  await fs.mkdir(traceDir, { recursive: true });
  const filename = path.join(traceDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  await fs.appendFile(
    filename,
    JSON.stringify({ at: new Date().toISOString(), event, data }) + "\n",
    "utf8"
  );
}
