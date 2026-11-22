/**
 * 给早先立的碑补上"声音"。可以重复运行，已经配过的不动。
 * 用法：停掉服务后运行 node scripts/retune.mjs，再启动服务，否则内存里的旧快照会把它覆盖回去。
 */
import { readFile, writeFile } from "node:fs/promises";

const PATH = new URL("../data/graves.json", import.meta.url);

const byName = [
  [/缝纫机/, "sewing"],
  [/网吧/, "fan"],
  [/猫/, "cat"],
  [/比赛|球/, "ball"],
  [/账号|网上|电视/, "tv"],
];

const raw = await readFile(PATH, "utf8");
const data = JSON.parse(raw);
const graves = data.graves || [];

let changed = 0;
for (const g of graves) {
  if (g.sound && g.sound !== "none") continue;
  const hit = byName.find(([re]) => re.test(g.name));
  const next = hit ? hit[1] : g.sound || "none";
  if (next !== g.sound) {
    g.sound = next;
    changed += 1;
    console.log(`  ${g.name} -> ${next}`);
  }
}

await writeFile(PATH, JSON.stringify(data, null, 2), "utf8");
console.log(`补上声音的碑：${changed} 座，共 ${graves.length} 座`);
