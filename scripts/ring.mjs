/**
 * 模拟"另一个人在远处献了一簇光"，用来验证别人能听见那口钟。
 * 用法：node scripts/ring.mjs "http://127.0.0.1:8899" 碑名
 */
import { WebSocket } from "ws";

const base = process.argv[2] || "http://127.0.0.1:8899";
const wantName = process.argv[3] || "";

const res = await fetch(new URL("/api/graves", base));
const data = await res.json();
const list = data.graves || [];
const target = wantName ? list.find((g) => g.name.includes(wantName)) : list[0];
if (!target) {
  console.error("没有找到这块碑");
  process.exit(1);
}
console.log(`献光的碑：${target.name}（${target.id}）`);

const wsUrl = base.replace(/^http/, "ws") + "/live";
const ws = new WebSocket(wsUrl);

ws.on("open", () => {
  ws.send(JSON.stringify({ t: "join", uid: "peer-ring", name: "远处的人", x: target.x, y: 0, z: target.z + 6, yaw: 0 }));
  setTimeout(() => {
    ws.send(JSON.stringify({ t: "light", id: target.id }));
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 900);
  }, 600);
});

ws.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
