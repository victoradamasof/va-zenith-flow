import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const chromeStorageDir = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Google",
  "Chrome",
  "User Data",
  "Default",
  "Local Storage",
  "leveldb",
);
const profileDir = path.join(projectRoot, ".local", "chrome-localstorage-copy");
const targetLevelDbDir = path.join(profileDir, "Default", "Local Storage", "leveldb");
const outputPath = path.join(projectRoot, ".local", "local-data-backup.json");

fs.rmSync(profileDir, { recursive: true, force: true });
fs.mkdirSync(targetLevelDbDir, { recursive: true });

for (const fileName of fs.readdirSync(chromeStorageDir)) {
  const from = path.join(chromeStorageDir, fileName);
  const to = path.join(targetLevelDbDir, fileName);
  try {
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, to);
    }
  } catch {
    // Chrome can lock the active log file. The .ldb tables hold the persisted state we need.
  }
}

const context = await chromium.launchPersistentContext(profileDir, {
  channel: "chrome",
  headless: true,
});

try {
  const page = await context.newPage();
  await page.goto("http://localhost:4175/dashboard", { waitUntil: "domcontentloaded" });

  const data = await page.evaluate(() => {
    const ignored = new Set(["va-manager:auth-session"]);
    const snapshot = {};

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith("va-manager:") || ignored.has(key)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        snapshot[key] = JSON.parse(raw);
      } catch {
        snapshot[key] = raw;
      }
    }

    return snapshot;
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    app: "VA Consultoria Manager",
    source: "http://localhost:4175",
    data,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(outputPath);
  console.log(JSON.stringify(Object.keys(data).sort(), null, 2));
} finally {
  await context.close();
}
