import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const serverIndex = resolve("dist/server/index.js");
const previewEntry = resolve("dist/server/server.js");

try {
  await stat(serverIndex);
  await mkdir(dirname(previewEntry), { recursive: true });
  await copyFile(serverIndex, previewEntry);
} catch (error) {
  console.warn("Preview entry was not created:", error instanceof Error ? error.message : error);
}
