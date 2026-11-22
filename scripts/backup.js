import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const BACKUPS = path.join(ROOT, "backups");
const KEEP = 7;
let running = null;

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * 一份能直接放回去的完整快照：碑、账号、token 密钥、照片和录音缺一不可。
 * 先复制到临时目录，再改名；只保留最新七份。失败不会留下半份正式快照。
 */
export function backupNow() {
  if (running) return running;
  running = (async () => {
    await fs.mkdir(BACKUPS, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const finalDir = path.join(BACKUPS, `snapshot-${stamp}`);
    const tempDir = path.join(BACKUPS, `.tmp-${process.pid}-${stamp}`);
    await fs.mkdir(tempDir, { recursive: true });
    try {
      for (const name of ["graves.json", "accounts.json", "secret.txt"]) {
        const source = path.join(DATA, name);
        if (await exists(source)) await fs.copyFile(source, path.join(tempDir, name));
      }
      const uploads = path.join(DATA, "uploads");
      if (await exists(uploads)) await fs.cp(uploads, path.join(tempDir, "uploads"), { recursive: true });
      await fs.writeFile(path.join(tempDir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString() }, null, 2), "utf8");
      await fs.rename(tempDir, finalDir);

      const entries = await fs.readdir(BACKUPS, { withFileTypes: true });
      const old = entries
        .filter((e) => e.isDirectory() && e.name.startsWith("snapshot-"))
        .map((e) => e.name)
        .sort((a, b) => b.localeCompare(a))
        .slice(KEEP);
      for (const name of old) await fs.rm(path.join(BACKUPS, name), { recursive: true, force: true });
      return finalDir;
    } catch (err) {
      await fs.rm(tempDir, { recursive: true, force: true });
      throw err;
    }
  })();
  return running.finally(() => {
    running = null;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  backupNow()
    .then((dir) => console.log(`[backup] ${dir}`))
    .catch((err) => {
      console.error("[backup] failed", err);
      process.exitCode = 1;
    });
}
