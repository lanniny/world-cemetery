/**
 * 让一个"人"站在某块碑前不动，用来验证两个人的沉默。
 * 用法：node scripts/together.mjs "http://127.0.0.1:8899" 碑名 秒数
 */
import { WebSocket } from "ws";

const base = process.argv[2] || "http://127.0.0.1:8899";
const wantName = process.argv[3] || "";
const seconds = Number(process.argv[4] || 24);

const res = await fetch(new URL("/api/graves", base));
const data = await res.json();
const list = data.graves || [];
const target = wantName ? list.find((g) => g.name.includes(wantName)) : list[0];
if (!target) {
  console.error("没有找到这块碑");
  process.exit(1);
}

// 站在碑的正面两米处，不动
const x = target.x;
const z = target.z + 2.0;
console.log(`站在「${target.name}」前 (${x.toFixed(1)}, ${z.toFixed(1)})，${seconds} 秒`);

const ws = new WebSocket(base.replace(/^http/, "ws") + "/live");
ws.on("open", () => {
  ws.send(JSON.stringify({ t: "join", uid: "peer-silent", name: "也在的人", x, y: 0, z, yaw: Math.PI }));
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, seconds * 1000);
});
ws.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
