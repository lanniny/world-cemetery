export const RULESET_ID = "cyber-cemetery.p0.v1";

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
