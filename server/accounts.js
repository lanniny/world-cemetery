import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * 账号。
 * 这里没有找回密码，也没有邮箱：一个名字 + 一句只有你知道的话，就是全部。
 * 名字是公开的（别人会这么称呼你的影子），那句话只用来证明这个账号还是你的。
 *
 * token = uid + "." + HMAC(uid, secret)。secret 第一次启动时随机生成，落在 data/secret.txt，
 * 重启之后已经发出去的 token 仍然有效。
 */
export class Accounts {
  constructor(dir) {
    this.dir = dir;
    this.filePath = path.join(dir, "accounts.json");
    this.secretPath = path.join(dir, "secret.txt");
    this.state = { version: 1, users: [], claimed: {} };
    this.secret = null;
    this.dirty = false;
    this.timer = null;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) this.state = parsed;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      await this.flush();
    }
    try {
      this.secret = (await fs.readFile(this.secretPath, "utf8")).trim();
    } catch {
      this.secret = crypto.randomBytes(32).toString("hex");
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(this.secretPath, this.secret, "utf8");
    }
    return this.state;
  }

  get users() {
    return this.state.users;
  }

  /** 名字按去空白、转小写比较，避免“守墓人”和“守墓人 ”成为两个账号。 */
  keyOf(name) {
    return String(name || "").trim().toLowerCase();
  }

  find(name) {
    const key = this.keyOf(name);
    return this.state.users.find((u) => u.key === key) || null;
  }

  findById(uid) {
    return this.state.users.find((u) => u.id === uid) || null;
  }

  /** 只有注册过的人才有 uid；游客的随机 uid 不在这里。 */
  isMember(uid) {
    return !!this.findById(uid);
  }

  hash(secret) {
    return crypto.scryptSync(String(secret), "world-cemetery", 32).toString("hex");
  }

  /**
   * 同名就是同一个账号：如果名字已经存在，必须用同一句话才进得去。
   * 名字被别人先占了，那是真的被占了——这里不提供改名，只提供再取一个名字。
   */
  async enter(name, secret) {
    const cleanName = String(name || "").replace(/\s+/g, " ").trim().slice(0, 20);
    const cleanSecret = String(secret || "").trim().slice(0, 64);
    if (cleanName.length < 1) return { error: "名字不能是空的。" };
    if (cleanSecret.length < 4) return { error: "那句话太短了，至少四个字。" };

    const existing = this.find(cleanName);
    if (existing) {
      if (existing.hash !== this.hash(cleanSecret)) {
        return { error: "这个名字已经有人用过。如果那是你，把当时那句话写对。" };
      }
      existing.lastSeen = new Date().toISOString();
      this.touch();
      return { user: existing, created: false };
    }

    const user = {
      id: crypto.randomUUID(),
      key: this.keyOf(cleanName),
      name: cleanName,
      hash: this.hash(cleanSecret),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    this.state.users.push(user);
    this.touch();
    return { user, created: true };
  }

  token(uid) {
    const sig = crypto.createHmac("sha256", this.secret).update(uid).digest("hex").slice(0, 32);
    return `${uid}.${sig}`;
  }

  /** 返回 uid，或者 null。客户端伪造 uid 是没用的，作者身份只认这个。 */
  verify(token) {
    const text = String(token || "");
    const at = text.lastIndexOf(".");
    if (at < 1) return null;
    const uid = text.slice(0, at);
    const sig = text.slice(at + 1);
    const expect = crypto.createHmac("sha256", this.secret).update(uid).digest("hex").slice(0, 32);
    if (sig.length !== expect.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    return this.isMember(uid) ? uid : null;
  }

  /** 认领：这个浏览器以前用随机 uid 立的碑，登录之后可以划到自己名下。每个 uid 只能认一次。 */
  claimable(legacyUid) {
    if (!legacyUid) return false;
    if (this.isMember(legacyUid)) return false;
    const rec = this.state.claimed[legacyUid];
    return !rec;
  }

  markClaimed(legacyUid, uid) {
    this.state.claimed[legacyUid] = { by: uid, at: new Date().toISOString() };
    this.touch();
  }

  touch() {
    this.dirty = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((err) => console.error("[accounts] flush failed", err));
    }, 400);
  }

  async flush() {
    const snapshot = JSON.stringify(this.state, null, 2);
    const tmp = `${this.filePath}.tmp`;
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(tmp, snapshot, "utf8");
    await fs.rename(tmp, this.filePath);
    this.dirty = false;
  }
}
