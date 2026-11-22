import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * 公墓的档案库。
 * 一座墓碑落成之后只有它的作者能处置：让它沉睡，或者把它删掉。别人不行。
 * 写入采用整体快照 + 临时文件替换，避免断电或并发时出现半截 JSON。
 */
export class Cemetery {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = { version: 1, graves: [], counters: {} };
    this.dirty = false;
    this.writing = null;
    this.timer = null;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.graves)) {
        this.state = parsed;
      }
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      await this.flush();
    }
    return this.state;
  }

  get graves() {
    return this.state.graves;
  }

  find(id) {
    return this.state.graves.find((g) => g.id === id) || null;
  }

  add(grave) {
    this.state.graves.push(grave);
    this.touch();
    return grave;
  }

  patch(id, fn) {
    const g = this.find(id);
    if (!g) return null;
    fn(g);
    g.updatedAt = new Date().toISOString();
    this.touch();
    return g;
  }

  /** 只有作者能走到这里（调用方已经校验过）。删掉的碑不会留下任何记录。 */
  remove(id) {
    const i = this.state.graves.findIndex((g) => g.id === id);
    if (i < 0) return null;
    const [grave] = this.state.graves.splice(i, 1);
    this.touch();
    return grave;
  }

  touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((err) => console.error("[store] flush failed", err));
    }, 400);
  }

  async flush() {
    if (this.writing) await this.writing;
    const snapshot = JSON.stringify(this.state, null, 2);
    const tmp = `${this.filePath}.tmp`;
    this.writing = (async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(tmp, snapshot, "utf8");
      await fs.rename(tmp, this.filePath);
    })();
    try {
      await this.writing;
      this.dirty = false;
    } finally {
      this.writing = null;
    }
  }
}
