/**
 * 立一座带"说话样子"的碑，然后直接打一次回声接口，看看服务端怎么回答。
 * 用法：node scripts/echo-probe.mjs
 */
import { WebSocket } from "ws";

const base = process.argv[2] || "http://127.0.0.1:8899";
const ws = new WebSocket(base.replace(/^http/, "ws") + "/live");

ws.on("open", () => {
  ws.send(JSON.stringify({ t: "join", uid: "peer-echo", name: "写碑的人", x: 0, y: 0, z: 46, yaw: 0 }));
  ws.send(
    JSON.stringify({
      t: "raise",
      grave: {
        name: "回声试验",
        epitaph: "看看还能不能听见",
        story: "一座自己立给自己的碑，用来试回声。",
        voice: "说话很慢，句子短，总先叹一口气，爱说“算了”。",
        form: "slab",
        relic: "candle",
        sound: "none",
        tone: 2,
        x: -6,
        z: 44,
        ry: 0,
      },
    })
  );
});

let raisedId = null;
ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.t === "raised" && msg.grave) {
    raisedId = msg.grave.id;
    console.log("立碑:", msg.grave.name, raisedId, "voice=", JSON.stringify(msg.grave.voice));
  }
});

setTimeout(async () => {
  ws.close();
  if (!raisedId) {
    console.error("没有收到 raised，可能位置冲突或校验失败");
    process.exit(1);
  }
  const res = await fetch(base + "/api/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: raisedId, text: "你还记得那年夏天吗" }),
  });
  console.log("echo status:", res.status, await res.text());
  process.exit(0);
}, 1400);
