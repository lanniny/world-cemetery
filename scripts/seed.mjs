/**
 * 往公墓里放一批评不同样式的碑，用来观察碑型、遗物和密度。
 * 这些碑的作者是一个固定的"守墓人"身份，重复运行不会重复生成。
 *
 *   node scripts/seed.mjs [地址]
 */
const BASE = process.argv[2] || "http://127.0.0.1:8899";
const UA = "seed-keeper";
const PLACES = [
  { name: "一张永远没发出去的照片", epitaph: "拍的时候还不知道那是最后一次", story: "后来手机丢了，云端也过期了。只剩下那一下按快门的声音。", form: "slab", relic: "flower", tone: 1, subject: "thing", x: -4.0, z: 64.0 },
  { name: "旧账号 @3:47", epitaph: "最后一次登录是凌晨三点四十七", story: "密码还在，只是不知道自己为什么还要进去。", form: "screen", relic: "phone", tone: 2, subject: "thing", x: 3.5, z: 63.2 },
  { name: "我的猫，2011 — 2024", epitaph: "它在门口等了十三年", story: "回家开门的时候总要先低头看一眼，这个习惯改不掉。", form: "pillar", relic: "candle", tone: 5, subject: "pet", x: -10.5, z: 61.0 },
  { name: "我们那间网吧", epitaph: "通宵五块钱一晚", story: "机器还在升 Windows，门口的那条街已经拆了。", form: "gate", relic: "chair", tone: 4, subject: "place", x: 10.0, z: 60.5 },
  { name: "一段没有名字的关系", epitaph: "它结束得太安静了", story: "没有人提出分手，只是某一天起谁都没有再发消息。", form: "slab", relic: "none", tone: 0, subject: "bond", x: -16.0, z: 56.0 },
  { name: "一个只在网上见过的人", epitaph: "头像永远不会再亮", story: "我们约过要在某一个城市见面，后来就没有后来了。", form: "screen", relic: "bird", tone: 1, subject: "person", x: 16.5, z: 55.4 },
  { name: "那台修不好的缝纫机", epitaph: "踩下去还有一点声音", story: "外婆走后没人会用了，但她踩踏板的样子我还记得。", form: "pillar", relic: "flower", tone: 3, subject: "thing", x: -2.5, z: 54.0 },
  { name: "已经删掉的那条长文", epitaph: "写了四个小时，没有人读到", story: "按删除的那一刻手是抖的。现在连自己都想不起写了什么。", form: "gate", relic: "none", tone: 2, subject: "idea", x: 6.0, z: 52.5 },
  { name: "一场没打完的比赛", epitaph: "比分停在 2:1", story: "球场第二年就改成了停车场。", form: "slab", relic: "chair", tone: 4, subject: "era", x: -22.0, z: 50.0 },
  { name: "外婆", epitaph: "她总说再吃一口", story: "碗还在柜子里，是那只有缺口的。", form: "slab", relic: "candle", tone: 5, subject: "person", x: 22.0, z: 48.5 },
];

async function main() {
  const existing = await fetch(`${BASE}/api/graves`).then((r) => r.json());
  const mine = new Set(existing.graves.filter((g) => g.authorId === UA).map((g) => g.name));
  const todo = PLACES.filter((p) => !mine.has(p.name));
  if (!todo.length) {
    console.log(`已经放好了（${existing.graves.length} 座碑在场）。`);
    return;
  }

  const { WebSocket } = await import("ws");
  const ws = new WebSocket(`${BASE.replace("http", "ws")}/live`);
  let placed = 0;

  await new Promise((resolve, reject) => {
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "join", uid: UA, name: "守墓人", x: 0, y: 0, z: 60, yaw: 0 }));
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.t === "welcome") {
        const next = todo.shift();
        if (!next) {
          ws.close();
          resolve();
          return;
        }
        setTimeout(() => {
          ws.send(JSON.stringify({ t: "raise", grave: { ...next, ry: Math.PI * 0.03 } }));
        }, 250);
      }
      if (msg.t === "raised") {
        placed++;
        console.log(`  立起：${msg.grave.name}`);
        const next = todo.shift();
        if (next) {
          setTimeout(() => ws.send(JSON.stringify({ t: "raise", grave: { ...next, ry: Math.random() * 0.4 - 0.2 } })), 260);
        } else {
          setTimeout(() => {
            ws.close();
            resolve();
          }, 400);
        }
      }
      if (msg.t === "reject") {
        console.log(`  被拒绝：${msg.reason}`);
        const next = todo.shift();
        if (next) {
          setTimeout(() => ws.send(JSON.stringify({ t: "raise", grave: next })), 200);
        } else {
          ws.close();
          resolve();
        }
      }
    });

    ws.on("error", reject);
    setTimeout(() => reject(new Error("timeout")), 20000);
  });

  console.log(`完成，本次立了 ${placed} 座碑。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
