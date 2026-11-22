export const RULESET_ID = "cyber-cemetery.p0.v1";

/**
 * 纪念的对象。旧碑没有这个字段时仍然是一座碑，不补写成"人"。
 * 新立的纪念要选一个；选「任何事物」也是一种正经的选择。
 */
export const SUBJECTS = [
  {
    id: "other",
    label: "任何事物",
    short: "纪念",
    name: "它叫什么",
    namePh: "一个人、一件事，或任何你想记住的",
    life: "年份（可留空）",
    bornPh: "从，如 1954",
    diedPh: "到，如 2021",
    lifeNote: "用得到就写年份，用不到就空着",
    voice: "留下的口气（可留空）",
    voicePh: "它说话、响，或还在时的样子",
    voiceNote: "填了，站在前面就可以对它说一句话",
    photo: "放一张照片（可留空）",
    audio: "留一段声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["我失去它的时候……", "现在还留在我身上的是……", "如果还能见一次，我想……"],
    echo: "这不是它本身。是留在这里的一点回声——知道的不多，也会记错。",
  },
  {
    id: "person",
    label: "一个人",
    short: "人",
    name: "这个人的名字",
    namePh: "一个名字，或一个称呼",
    life: "生卒（可留空）",
    bornPh: "生于，如 1954",
    diedPh: "卒于，如 2021",
    lifeNote: "只写年份。写不出来就空着，上面留白",
    voice: "他说话的样子（可留空）",
    voicePh: "句子很短，总先叹一口气，爱说“算了”",
    voiceNote: "填了，才能站在前面跟他说一句话",
    photo: "给他放一张照片（可留空）",
    audio: "留一段他的声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["他最后教会我的一件事是……", "我们最后一次说话是在……", "如果有下辈子，我想……"],
    echo: "这不是他。是他留在这里的一点回声——知道的不多，也会记错。",
  },
  {
    id: "pet",
    label: "一只生灵",
    short: "生灵",
    name: "它的名字",
    namePh: "一只猫，一条狗，或你这样叫它",
    life: "来去的年份（可留空）",
    bornPh: "来到，如 2011",
    diedPh: "离开，如 2024",
    lifeNote: "写年份就好。不知道就空着",
    voice: "它在的时候（可留空）",
    voicePh: "比如：总先在门口等，叫一声就过来",
    voiceNote: "填了，站在前面可以跟它说一句话",
    photo: "放一张它的照片（可留空）",
    audio: "留一段它的声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["它最常做的一件事是……", "最后一次见到它是在……", "家里现在还留着……"],
    echo: "这不是它。是你留在这里的一点回声。",
  },
  {
    id: "place",
    label: "一个地方",
    short: "地方",
    name: "那个地方",
    namePh: "一条街，一间房，一座城",
    life: "它在的年份（可留空）",
    bornPh: "从，如 1998",
    diedPh: "到，如 2016",
    lifeNote: "记它还在的那些年。记不清就空着",
    voice: "那里的口气（可留空）",
    voicePh: "比如：很吵，灯是暖的，有人喊名字",
    voiceNote: "填了，站在前面可以跟那个地方说一句话",
    photo: "放一张那里的照片（可留空）",
    audio: "留一段那里的声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["我最后一次去是因为……", "现在那里变成了……", "我还记得门口的……"],
    echo: "这不是那个地方。是你留在这里的一点回声。",
  },
  {
    id: "thing",
    label: "一件东西",
    short: "物件",
    name: "那样东西",
    namePh: "一台机器，一个旧账号，一把钥匙",
    life: "它在的年份（可留空）",
    bornPh: "从，如 2004",
    diedPh: "到，如 2019",
    lifeNote: "它存在过的年份。不知道就空着",
    voice: "它响起来的样子（可留空）",
    voicePh: "比如：踩下去还有一点声音",
    voiceNote: "填了，站在前面可以跟它说一句话",
    photo: "放一张它的照片（可留空）",
    audio: "留一段它的声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["它最后一次被用到是在……", "现在还留着的部分是……", "我没能留下它，是因为……"],
    echo: "这不是那样东西。是你留在这里的一点回声。",
  },
  {
    id: "bond",
    label: "一段关系",
    short: "关系",
    name: "这段关系",
    namePh: "一段没有名字的关系，或你们怎么称呼它",
    life: "起止年份（可留空）",
    bornPh: "从，如 2014",
    diedPh: "到，如 2018",
    lifeNote: "它开始和结束的年份。说不清就空着",
    voice: "你们说话的样子（可留空）",
    voicePh: "比如：谁都不先挂电话",
    voiceNote: "填了，站在前面可以跟这段关系说一句话",
    photo: "放一张照片（可留空）",
    audio: "留一段声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["它结束的那天没有人说……", "我们最后一次在一起是……", "我还留着的习惯是……"],
    echo: "这不是那段关系本身。是留在这里的一点回声。",
  },
  {
    id: "idea",
    label: "一个念头",
    short: "念头",
    name: "那个念头",
    namePh: "一个没写完的想法，一种再也不信的事",
    life: "它亮着的年份（可留空）",
    bornPh: "从，如 2012",
    diedPh: "到，如 2020",
    lifeNote: "你还信着它的那些年",
    voice: "它在你心里的口气（可留空）",
    voicePh: "比如：总是说“以后吧”",
    voiceNote: "填了，站在前面可以跟它说一句话",
    photo: "放一张照片（可留空）",
    audio: "留一段声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["我曾经以为……", "它消失是因为……", "现在我想对那时候的自己说……"],
    echo: "这不是那个念头。是你留在这里的一点回声。",
  },
  {
    id: "era",
    label: "一个时代",
    short: "时代",
    name: "那个时代",
    namePh: "一段再也不会回来的日子",
    life: "起止年份（可留空）",
    bornPh: "从，如 1996",
    diedPh: "到，如 2008",
    lifeNote: "那段日子的年份。模糊就空着",
    voice: "那些日子的口气（可留空）",
    voicePh: "比如：夏天很长，谁都还没走",
    voiceNote: "填了，站在前面可以跟那个时代说一句话",
    photo: "放一张那时候的照片（可留空）",
    audio: "留一段那时候的声音（可留空）",
    epitaph: "上面只刻一行字",
    story: "想记住的事（可留空）",
    hints: ["那时候每天都在……", "它结束的标志是……", "我现在还带着的是……"],
    echo: "这不是那个时代。是你留在这里的一点回声。",
  },
];

export const subjectMeta = (id) => SUBJECTS.find((s) => s.id === id) || null;

/** 来客的样子。只记两样：衣服、头发。旧连接没带时用墨衣短发。 */
export const LOOKS = {
  coats: ["ink", "ash", "pine", "frost", "clay"],
  hairs: ["short", "tied", "hood"],
  coatLabel: { ink: "墨衣", ash: "灰袍", pine: "松绿", frost: "霜白", clay: "赭衣" },
  hairLabel: { short: "短发", tied: "束发", hood: "兜帽" },
  palette: {
    ink: { coat: 0x243034, trim: 0xb7a98a, hair: 0x14110e, skin: 0xc9a892, shoe: 0x141816 },
    ash: { coat: 0x59615c, trim: 0xd5d0c4, hair: 0x2a2622, skin: 0xd2b49a, shoe: 0x1c1e1c },
    pine: { coat: 0x234033, trim: 0xcbb98a, hair: 0x1a1612, skin: 0xc4a088, shoe: 0x142018 },
    frost: { coat: 0xd9d4cb, trim: 0x8e9aa0, hair: 0x3a3530, skin: 0xe0c4ae, shoe: 0x2a3034 },
    clay: { coat: 0x734636, trim: 0xe6c9a2, hair: 0x1c1410, skin: 0xb88870, shoe: 0x241814 },
  },
};

export function normalizeLook(raw) {
  const coat = LOOKS.coats.includes(raw?.coat) ? raw.coat : "ink";
  const hair = LOOKS.hairs.includes(raw?.hair) ? raw.hair : "short";
  return { coat, hair };
}

/** 同步包里用一个数字带上衣服和头发，避免每秒再发一串字段。 */
export function packLook(look) {
  const n = normalizeLook(look);
  return LOOKS.coats.indexOf(n.coat) + LOOKS.hairs.indexOf(n.hair) * 8;
}

export function unpackLook(code) {
  const v = Number(code);
  if (!Number.isFinite(v) || v < 0) return normalizeLook(null);
  return {
    coat: LOOKS.coats[v % 8] || "ink",
    hair: LOOKS.hairs[Math.floor(v / 8)] || "short",
  };
}

export const RULES = {
  world: {
    radius: 168,          // 可行走的墓园半径（米）
    fogDensity: 0.0155,
    groundSize: 420,
    hillAmp: 0.85,
    moonAzimuth: -0.55,
    // 湖：水面比湖底高一点，船就浮在这条线上。走出岸边就进不去了。
    lake: { x: -44, z: 30, r: 26 },
    waterLevel: -1.15,
    wadeDepth: 0.45,      // 再往深处走就站不住了
    // 三片林子：走进去会暗下来，每一棵树都能当作一个纪念
    groves: [
      { x: 30, z: 74, r: 13, n: 18 },
      { x: -40, z: 92, r: 16, n: 20 },
      { x: 70, z: 28, r: 18, n: 24 },
    ],
    scatterTrees: 26,
  },
  player: {
    eyeHeight: 1.66,
    crouchHeight: 1.02,
    kneelHeight: 0.78,
    walkSpeed: 3.0,
    runSpeed: 6.4,
    ghostSpeed: 9.5,
    jumpSpeed: 4.9,
    gravity: 12.5,
    accel: 12,
    lookSensitivity: 0.0021,
    seatHeight: 0.55,
  },
  interact: {
    stoneRadius: 4.4,       // 铭文浮现半径
    readRadius: 3.2,        // 可献物/留言半径
    raiseRadius: 6.0,       // 可立碑时的空地探测半径
  },
  grave: {
    minSpacing: 2.6,        // 与最近墓碑的最小间距
    previewDistance: 2.4,   // 立碑时碑面出现的距离
    nameMax: 24,
    epitaphMax: 60,
    storyMax: 500,
    noteMax: 80,
    maxPerOwner: 12,
    formIds: ["slab", "pillar", "gate", "screen"],
    subjectIds: SUBJECTS.map((s) => s.id),
    /**
     * 葬法。立碑不是只有一种放法：
     * stone 石碑；tree 埋在树根下，木牌挂在树干上；water 放在湖面，让船漂着；
     * sky 放上天空，像一盏孔明灯。位置决定哪种能用，人不能把船放到山上。
     */
    burialIds: ["stone", "tree", "water", "sky"],
    treeAnchorMax: 5.0,     // 树葬：碑坐标离树干不超过这么远
    treeUniqueRadius: 0.8,  // 一棵树只认一座纪念；同一树位这么近就算被占了
    waterEdgeMax: 10.0,     // 水葬：允许站在岸上立，碑落在水里，离岸不超过这么远
    skyHover: [4.2, 7.0],   // 天葬：灯悬在这个高度之间漂着（再高，碑上的字就没人读得见）
    skyDrift: 0.9,          // 灯左右的漂移幅度（米）
    relicIds: ["none", "candle", "flower", "phone", "chair", "bird"],
    soundIds: ["none", "sewing", "fan", "ball", "cat", "tv"],
    soundRadius: 3.2,       // 走近多少米能听见碑的声音
    bellRadius: 34,         // 别人献光时，多远之内能听见那口钟
  },
  net: {
    moveHz: 12,
    peersHz: 8,
    peerRange: 72,           // 只同步这个范围内的人：更远的影子本来就在雾里看不见
    heartbeatMs: 15000,
    timeoutMs: 40000,
    silenceDwellMs: 10000,   // 在同一座碑前三米内站着不动多久，算"沉默"
    silenceMoveTolerance: 0.8, // 位置漂移超过这个距离就重新计时
    silenceCooldownMs: 90000,  // 同一座碑多久内只触发一次
  },

  /**
   * 回声：一座碑如果留下了"他说话的样子"，站在碑前可以说一句话，碑会用他的口吻回一句。
   * 这不是他，是他留下的一点回声。规则比对话更短。
   */
  echo: {
    voiceMax: 100,      // 立碑时填的"他说话的样子"，最多多少字
    inputMax: 60,       // 你说的一句话
    replyMax: 120,      // 碑回的字数上限
    maxTurns: 4,        // 一次停留最多往来几句
    historyMax: 4,      // 带给模型的上下文条数
    perMinute: 8,       // 同一个人每分钟最多问几次
  },

  /**
   * 碑上可以放一张照片、留一段声音。
   * 照片在浏览器里先压到 900 像素再传，声音限八秒——都是为了让一个碑不至于变成相册。
   */
  media: {
    photoEdge: 900,        // 上传前把照片缩到最长边 900
    photoQuality: 0.82,
    photoBytes: 500000,    // 服务端接受的解码后大小
    audioBytes: 1200000,
    audioSec: 8,           // 录音最长八秒
    voiceRadius: 3.2,      // 走到多近能听见碑上留的那段声音
    perMinute: 4,          // 同一个地址每分钟最多上传几次
  },
};
