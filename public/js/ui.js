import { formLabel, relicLabel, burialLabel } from "./graves.js";
import { RULES, SUBJECTS, subjectMeta, LOOKS, normalizeLook } from "./rules.js";

const $ = (id) => document.getElementById(id);

// 名录里只说"放在哪儿"，不用"立一块碑"那种动作短语
const BURIAL_SHORT = { stone: "石碑", tree: "木牌", water: "纸船", sky: "天灯" };
const OFFER_LABEL = { flower: "一朵花", candle: "一根蜡烛", bird: "一只纸鸟" };

/** 碑上、面板上用同一套写法：1954 — 2021 / 生于 1954 / 卒于 2021。 */
function lifeSpan(g) {
  const b = /^\d{4}$/.test(g.born || "") ? g.born : "";
  const d = /^\d{4}$/.test(g.died || "") ? g.died : "";
  const dated = g.subject && g.subject !== "person" && g.subject !== "pet";
  if (b && d) return `${b} — ${d}`;
  if (b) return dated ? `自 ${b}` : `生于 ${b}`;
  if (d) return dated ? `至 ${d}` : `卒于 ${d}`;
  return "";
}

const GESTURE_TEXT = {
  sit: "你坐下了。按 F 起身。",
  kneel: "你跪在这里。按 G 起身。",
  bow: "你鞠了一躬。",
  clasp: "双手合十。按 V 放下。",
  mourn: "你低着头。按 B 抬起头。",
};

/** 旧碑没标过纪念对象时，改碑表单仍用原来那套说法。 */
const LEGACY_COPY = {
  name: "这一座，留给谁",
  namePh: "一个名字，或一个称呼",
  life: "生卒（可留空）",
  bornPh: "生于，如 1954",
  diedPh: "卒于，如 2021",
  lifeNote: "只写年份。写不出来就空着，碑上留白",
  voice: "他说话的样子（可留空）",
  voicePh: "比如：句子很短，总先叹一口气，爱说“算了”",
  voiceNote: "填了，才能站在前面跟他说一句话",
  photo: "给他放一张照片（可留空）",
  audio: "留一段他的声音（可留空）",
  epitaph: "上面只刻一行字",
  story: "想记住的事（可留空）",
  hints: ["他最后教会我的一件事是……", "我们最后一次说话是在……", "如果有下辈子，我想……"],
  echo: "这不是他。是他留在这里的一点回声——知道的不多，也会记错。",
};

/** 上一次有人在这座碑前献光，是多久以前。 */
function whenLit(at, lights) {
  const t = Date.parse(at || "") || 0;
  if (!t) return lights > 0 ? "很久以前有人来过" : "还没人献过光";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "今天有人来过";
  if (days === 1) return "昨天有人来过";
  if (days < 30) return `${days} 天前有人来过`;
  return `${Math.floor(days / 30)} 个月前有人来过`;
}

export class UI {
  constructor() {
    this.el = {
      boot: $("boot"),
      name: $("name-input"),
      secret: $("secret-input"),
      enter: $("enter"),
      hud: $("hud"),
      crosshair: $("crosshair"),
      prompt: $("prompt"),
      peers: $("peer-count"),
      graves: $("grave-count"),
      toast: $("toast"),
      raisePanel: $("raise-panel"),
      raiseSubjects: $("raise-subjects"),
      raiseNameLabel: $("raise-name-label"),
      raiseLifeLabel: $("raise-life-label"),
      raiseLifeNote: $("raise-life-note"),
      raiseEpitaphLabel: $("raise-epitaph-label"),
      raiseStoryLabel: $("raise-story-label"),
      raiseVoiceLabel: $("raise-voice-label"),
      raiseVoiceNote: $("raise-voice-note"),
      raisePhotoLabel: $("raise-photo-label"),
      raiseAudioLabel: $("raise-audio-label"),
      raiseName: $("raise-name"),
      raiseBorn: $("raise-born"),
      raiseDied: $("raise-died"),
      raiseEpitaph: $("raise-epitaph"),
      raiseStory: $("raise-story"),
      storyHints: $("story-hints"),
      raiseAnniv: $("raise-anniv"),
      raiseVoice: $("raise-voice"),
      raiseEchoBase: $("raise-echo-base"),
      raiseEchoKey: $("raise-echo-key"),
      raiseEchoModel: $("raise-echo-model"),
      raiseForms: $("raise-forms"),
      raiseFormField: $("raise-form-field"),
      raiseBurials: $("raise-burials"),
      raiseBurialHint: $("raise-burial-hint"),
      raiseRelics: $("raise-relics"),
      raiseSounds: $("raise-sounds"),
      raiseTone: $("raise-tone"),
      raisePhotoWhere: $("raise-photo-where"),
      raisePhoto: $("raise-photo"),
      raisePhotoHint: $("raise-photo-hint"),
      raisePhotoPreview: $("raise-photo-preview"),
      raiseAudio: $("raise-audio"),
      raiseAudioHint: $("raise-audio-hint"),
      raiseAudioPreview: $("raise-audio-preview"),
      raiseRecord: $("raise-record"),
      raiseConfirm: $("raise-confirm"),
      raiseCancel: $("raise-cancel"),
      readPanel: $("read-panel"),
      readPhoto: $("read-photo"),
      readAuthor: $("read-author"),
      readSubject: $("read-subject"),
      readName: $("read-name"),
      readLife: $("read-life"),
      readEpitaph: $("read-epitaph"),
      readStory: $("read-story"),
      readLights: $("read-lights"),
      readVisits: $("read-visits"),
      readLight: $("read-light"),
      readOffers: $("read-offers"),
      offerFlower: $("offer-flower"),
      offerCandle: $("offer-candle"),
      offerBird: $("offer-bird"),
      soundToggle: $("sound-toggle"),
      intro: $("intro"),
      readNotes: $("read-notes"),
      readClose: $("read-close"),
      shareBtn: $("share-btn"),
      noteInput: $("note-input"),
      noteSend: $("note-send"),
      lightBtn: $("light-btn"),
      raiseTag: $("raise-tag"),
      sealBtn: $("seal-btn"),
      editBtn: $("edit-btn"),
      deleteBtn: $("delete-btn"),
      help: $("help"),
      helpClose: $("help-close"),
      list: $("list"),
      listBody: $("list-body"),
      listFilters: $("list-filters"),
      listClose: $("list-close"),
      guide: $("guide"),
      seatHint: $("seat-hint"),
      lookCoats: $("look-coats"),
      lookHairs: $("look-hairs"),
      echoPanel: $("echo-panel"),
      echoNote: $("echo-note"),
      echoName: $("echo-name"),
      echoLog: $("echo-log"),
      echoInput: $("echo-input"),
      echoSend: $("echo-send"),
      echoClose: $("echo-close"),
    };

    this.form = "slab";
    this.relic = "none";
    this.soundId = "none";
    this.burial = "stone";
    this.subject = "other";
    this.look = this.readLook();
    this.raiseCtx = { tree: null, treeTaken: "", lakeDist: Infinity, canWater: false, canTree: false };
    this.mode = "raise";
    this.editId = null;
    this.onSubmit = null;
    this.onSoundToggle = null;
    this.onOffer = null;
    this.onEdit = null;
    this.onEditRequest = null;
    this.onPreview = null;
    this.onClose = null;
    this.onLight = null;
    this.onNote = null;
    this.onSeal = null;
    this.openPanel = null;
    this.currentGrave = null;
    this.toastTimer = null;
    this.echoTurns = 0;
    this.echoHistory = [];
    this.pendingEcho = null;
    this.echoConfig = null;
    this.selfId = null;
    this.raisePending = false;
    this.counterEls = [];

    this.buildChips();
    this.buildLookPicker();
    this.buildStoryHints(subjectMeta("other").hints);
    this.applySubjectCopy();
    this.bindCounters();
    this.bind();
  }

  /**
   * 大多数人对着"碑后面的事"这个空格写不出东西。
   * 给三个开头，点一下填进去，剩下的仍然由他自己写。
   */
  buildStoryHints(lines) {
    this.el.storyHints.innerHTML = "";
    for (const line of lines) {
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = line;
      b.onclick = () => {
        const box = this.el.raiseStory;
        const cur = box.value.trim();
        box.value = cur ? `${cur}\n${line}` : line;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        box.focus();
      };
      this.el.storyHints.appendChild(b);
    }
  }

  /** 长文字只给必要的字数提示，不占一行新的说明。 */
  bindCounters() {
    const fields = [
      [this.el.raiseName, RULES.grave.nameMax],
      [this.el.raiseEpitaph, RULES.grave.epitaphMax],
      [this.el.raiseStory, RULES.grave.storyMax],
      [this.el.raiseVoice, RULES.echo.voiceMax],
    ];
    for (const [input, max] of fields) {
      const counter = document.createElement("span");
      counter.className = "char-count";
      counter.setAttribute("aria-hidden", "true");
      input.insertAdjacentElement("afterend", counter);
      const update = () => {
        const length = [...input.value].length;
        counter.textContent = `${length} / ${max}`;
        counter.classList.toggle("near", length >= max * 0.9);
      };
      input.addEventListener("input", update);
      this.counterEls.push(update);
    }
    this.updateCounters();
  }

  updateCounters() {
    for (const update of this.counterEls) update();
  }

  readLook() {
    try {
      return normalizeLook(JSON.parse(localStorage.getItem("cc.look") || "{}"));
    } catch {
      return normalizeLook(null);
    }
  }

  persistLook() {
    this.look = normalizeLook(this.look);
    localStorage.setItem("cc.look", JSON.stringify(this.look));
    this.onLook?.(this.look);
    return this.look;
  }

  buildLookPicker() {
    const paint = () => {
      for (const btn of this.el.lookCoats.children) btn.classList.toggle("on", btn.dataset.id === this.look.coat);
      for (const btn of this.el.lookHairs.children) btn.classList.toggle("on", btn.dataset.id === this.look.hair);
    };
    this.el.lookCoats.innerHTML = "";
    for (const id of LOOKS.coats) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "swatch";
      btn.dataset.id = id;
      btn.title = LOOKS.coatLabel[id];
      btn.setAttribute("aria-label", LOOKS.coatLabel[id]);
      btn.style.background = "#" + LOOKS.palette[id].coat.toString(16).padStart(6, "0");
      btn.onclick = () => {
        this.look = { ...this.look, coat: id };
        paint();
        this.persistLook();
      };
      this.el.lookCoats.appendChild(btn);
    }
    this.el.lookHairs.innerHTML = "";
    for (const id of LOOKS.hairs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.dataset.id = id;
      btn.textContent = LOOKS.hairLabel[id];
      btn.onclick = () => {
        this.look = { ...this.look, hair: id };
        paint();
        this.persistLook();
      };
      this.el.lookHairs.appendChild(btn);
    }
    paint();
  }

  copyForSubject() {
    return subjectMeta(this.subject) || LEGACY_COPY;
  }

  applySubjectCopy() {
    const meta = this.copyForSubject();
    const set = (el, text) => {
      if (el) el.textContent = text;
    };
    set(this.el.raiseNameLabel, meta.name);
    set(this.el.raiseLifeLabel, meta.life);
    set(this.el.raiseEpitaphLabel, meta.epitaph);
    set(this.el.raiseStoryLabel, meta.story);
    set(this.el.raiseVoiceLabel, meta.voice);
    set(this.el.raisePhotoLabel, meta.photo);
    set(this.el.raiseAudioLabel, meta.audio);
    if (this.el.raiseName) this.el.raiseName.placeholder = meta.namePh;
    if (this.el.raiseBorn) this.el.raiseBorn.placeholder = meta.bornPh;
    if (this.el.raiseDied) this.el.raiseDied.placeholder = meta.diedPh;
    if (this.el.raiseVoice) this.el.raiseVoice.placeholder = meta.voicePh;
    if (this.el.raiseLifeNote) this.el.raiseLifeNote.innerHTML = `<span>${meta.lifeNote}</span>`;
    if (this.el.raiseVoiceNote) this.el.raiseVoiceNote.innerHTML = `<span>${meta.voiceNote}</span>`;
    this.buildStoryHints(meta.hints || LEGACY_COPY.hints);
  }

  buildChips() {
    this.el.raiseSubjects.innerHTML = "";
    for (const subject of SUBJECTS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = subject.id;
      b.textContent = subject.label;
      b.onclick = () => {
        this.subject = subject.id;
        this.refreshChips();
        this.applySubjectCopy();
        this.preview();
      };
      this.el.raiseSubjects.appendChild(b);
    }

    const forms = [
      ["slab", "石板"],
      ["pillar", "方柱"],
      ["gate", "门形"],
      ["screen", "屏幕"],
    ];
    this.el.raiseForms.innerHTML = "";
    for (const [id, label] of forms) {
      const b = document.createElement("button");
      b.className = "chip" + (id === this.form ? " on" : "");
      b.dataset.id = id;
      b.textContent = label;
      b.type = "button";
      b.onclick = () => {
        this.form = id;
        this.refreshChips();
        this.preview();
      };
      this.el.raiseForms.appendChild(b);
    }

    const where = [
      ["ground", "立在碑前"],
      ["face", "嵌在碑上"],
    ];
    this.el.raisePhotoWhere.innerHTML = "";
    for (const [id, label] of where) {
      const b = document.createElement("button");
      b.className = "chip" + (id === this.photoOn ? " on" : "");
      b.dataset.id = id;
      b.textContent = label;
      b.type = "button";
      b.onclick = () => {
        this.photoOn = id;
        this.refreshChips();
        this.preview();
      };
      this.el.raisePhotoWhere.appendChild(b);
    }

    const relics = [
      ["none", "不放"],
      ["candle", "一支烛"],
      ["flower", "一束花"],
      ["phone", "旧手机"],
      ["chair", "空椅子"],
      ["bird", "纸鸟"],
    ];
    this.el.raiseRelics.innerHTML = "";
    for (const [id, label] of relics) {
      const b = document.createElement("button");
      b.className = "chip" + (id === this.relic ? " on" : "");
      b.dataset.id = id;
      b.textContent = label;
      b.type = "button";
      b.onclick = () => {
        this.relic = id;
        this.refreshChips();
        this.preview();
      };
      this.el.raiseRelics.appendChild(b);
    }

    const burials = [
      ["stone", "立一块碑"],
      ["tree", "埋在树根下"],
      ["water", "放在水面上"],
      ["sky", "放上天空"],
    ];
    this.el.raiseBurials.innerHTML = "";
    for (const [id, label] of burials) {
      const b = document.createElement("button");
      b.className = "chip" + (id === this.burial ? " on" : "");
      b.dataset.id = id;
      b.textContent = label;
      b.type = "button";
      b.onclick = () => {
        if (this.mode === "edit") {
          this.toast("葬法不能改。它已经在那儿了。");
          return;
        }
        if (id === "tree" && !this.raiseCtx.canTree) {
          this.toast(
            this.raiseCtx.treeTaken
              ? `这棵树已经有人靠着。换一棵吧。`
              : "树葬要走到树底下。先找一棵树。",
            3200
          );
          return;
        }
        if (id === "water" && !this.raiseCtx.canWater) {
          this.toast("水葬要走到湖边。这里没有水。", 3200);
          return;
        }
        this.burial = id;
        this.refreshChips();
        this.preview();
      };
      this.el.raiseBurials.appendChild(b);
    }

    const sounds = [      ["none", "什么都不响"],
      ["sewing", "缝纫机"],
      ["fan", "风扇"],
      ["ball", "拍球"],
      ["cat", "猫的呼噜"],
      ["tv", "电视雪花"],
    ];
    this.el.raiseSounds.innerHTML = "";
    for (const [id, label] of sounds) {
      const b = document.createElement("button");
      b.className = "chip" + (id === this.soundId ? " on" : "");
      b.dataset.id = id;
      b.textContent = label;
      b.type = "button";
      b.onclick = () => {
        this.soundId = id;
        this.refreshChips();
        this.preview();
      };
      this.el.raiseSounds.appendChild(b);
    }
  }

  refreshChips() {
    for (const b of this.el.raiseSubjects.children) b.classList.toggle("on", b.dataset.id === this.subject);
    for (const b of this.el.raiseForms.children) b.classList.toggle("on", b.dataset.id === this.form);
    for (const b of this.el.raisePhotoWhere.children) b.classList.toggle("on", b.dataset.id === this.photoOn);
    for (const b of this.el.raiseRelics.children) b.classList.toggle("on", b.dataset.id === this.relic);
    for (const b of this.el.raiseSounds.children) b.classList.toggle("on", b.dataset.id === this.soundId);

    for (const b of this.el.raiseBurials.children) {
      const id = b.dataset.id;
      const usable =
        id === "stone" ||
        id === "sky" ||
        (id === "tree" && this.raiseCtx.canTree) ||
        (id === "water" && this.raiseCtx.canWater);
      b.classList.toggle("on", id === this.burial);
      b.classList.toggle("off", !usable);
    }
    this.el.raiseFormField.classList.toggle("hidden", this.burial !== "stone");
    if (this.el.raiseBurialHint) {
      this.el.raiseBurialHint.innerHTML =
        this.burial === "tree"
          ? this.raiseCtx.treeTaken
            ? "<span>这棵树已经有人靠着。换一棵树，或者把ta留在别处。</span>"
            : "<span>木牌会挂在最近的这棵树上。它就成了这棵树的纪念。</span>"
          : this.burial === "water"
            ? "<span>船会落在你面前的湖面上，一直漂着。</span>"
            : this.burial === "sky"
              ? "<span>灯会升到天上，停在几米高的地方，慢慢漂。</span>"
              : "<span>你站在哪儿，决定了它能有几种放法。</span>";
    }
  }

  bind() {
    const live = () => this.preview();
    this.el.soundToggle.onclick = () => this.onSoundToggle?.();
    for (const [btn, kind] of [
      [this.el.offerFlower, "flower"],
      [this.el.offerCandle, "candle"],
      [this.el.offerBird, "bird"],
    ]) {
      btn.onclick = () => this.onOffer?.(kind);
    }
    for (const el of [this.el.raiseName, this.el.raiseEpitaph, this.el.raiseStory, this.el.raiseTone]) {
      el.addEventListener("input", live);
    }
    this.el.raiseTone.addEventListener("change", live);

    this.el.raiseConfirm.onclick = () => {
      if (this.raisePending) return;
      const name = this.el.raiseName.value.trim();
      if (!name) {
        this.toast("碑上总得有个名字。");
        this.el.raiseName.focus();
        return;
      }
      this.pendingEcho = this.readEchoConfig();
      this.stopRecord();
      const data = {
        name,
        born: this.el.raiseBorn.value.trim(),
        died: this.el.raiseDied.value.trim(),
        epitaph: this.el.raiseEpitaph.value.trim(),
        story: this.el.raiseStory.value.trim(),
        voice: this.el.raiseVoice.value.trim(),
        subject: this.subject,
        photo: this.photoUrl || "",
        photoOn: this.photoOn,
        audio: this.audioUrl || "",
        form: this.form,
        relic: this.relic,
        sound: this.soundId,
        burial: this.burial,
        anniversary: this.el.raiseAnniv.value.trim(),
        tone: Number(this.el.raiseTone.value),
      };
      this.setRaisePending(true);
      try {
        if (this.mode === "edit" && this.editId) this.onEdit?.(this.editId, data);
        else this.onSubmit?.(data);
      } catch {
        this.setRaisePending(false);
        this.toast("没能送出去。再试一次。");
      }
    };

    this.el.raisePhoto.onchange = () => {
      const file = this.el.raisePhoto.files?.[0];
      if (file) this.attachPhoto(file);
    };
    this.el.raiseAudio.onchange = () => {
      const file = this.el.raiseAudio.files?.[0];
      if (file) this.attachAudio(file, file.type || "audio/mpeg");
    };
    this.el.raiseRecord.onclick = () => this.startRecord();

    this.el.raiseCancel.onclick = () => this.close();
    this.el.readClose.onclick = () => this.close();
    this.el.shareBtn.onclick = () => {
      if (this.currentGrave) this.onShare?.(this.currentGrave.grave.id);
    };

    this.el.lightBtn.onclick = () => {
      if (this.currentGrave) this.onLight?.(this.currentGrave.grave.id);
    };

    const sendNote = () => {
      const text = this.el.noteInput.value.trim();
      if (!text) return;
      this.onNote?.(this.currentGrave.grave.id, text);
      this.el.noteInput.value = "";
    };
    this.el.noteSend.onclick = sendNote;
    this.el.noteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) sendNote();
    });

    this.el.sealBtn.onclick = () => {
      if (this.currentGrave) this.onSeal?.(this.currentGrave.grave.id);
    };

    this.el.editBtn.onclick = () => {
      if (this.currentGrave) this.onEditRequest?.(this.currentGrave.grave.id);
    };

    // 删碑是唯一不可挽回的动作，所以要按两次：第一次只是把按钮变成问题
    this.el.deleteBtn.onclick = () => {
      if (!this.currentGrave) return;
      const id = this.currentGrave.grave.id;
      if (this.deleteArm === id) {
        this.deleteArm = null;
        this.el.deleteBtn.textContent = "拆掉这座碑";
        this.el.deleteBtn.classList.remove("danger-on");
        this.onDelete?.(id);
        return;
      }
      this.deleteArm = id;
      this.el.deleteBtn.textContent = "真的拆掉？它不会再回来了";
      this.el.deleteBtn.classList.add("danger-on");
      clearTimeout(this.deleteTimer);
      this.deleteTimer = setTimeout(() => {
        this.deleteArm = null;
        this.el.deleteBtn.textContent = "拆掉这座碑";
        this.el.deleteBtn.classList.remove("danger-on");
      }, 4000);
    };

    this.el.helpClose.onclick = () => this.el.help.classList.add("hidden");
    this.el.listClose.onclick = () => this.el.list.classList.add("hidden");

    this.el.echoClose.onclick = () => this.close();
    this.el.echoSend.onclick = () => this.sendEcho();
    this.el.echoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        this.sendEcho();
      }
    });
  }

  /** 站在碑前说一句话。 @returns 是否发出去了 */
  sendEcho() {
    const text = this.el.echoInput.value.trim();
    if (!text || !this.currentGrave) return false;
    if (this.echoTurns >= RULES.echo.maxTurns) {
      this.toast("他今天说到这里。");
      return false;
    }
    this.echoTurns += 1;
    this.appendEcho("you", text);
    this.echoHistory.push({ role: "user", content: text });
    this.el.echoInput.value = "";
    this.el.echoSend.disabled = true;
    this.el.echoInput.disabled = true;
    this.onEcho?.(this.currentGrave.grave.id, text, this.echoHistory.slice(0, -1));
    return true;
  }

  appendEcho(role, text) {
    const p = document.createElement("p");
    p.className = `echo-line ${role}`;
    p.textContent = text;
    this.el.echoLog.appendChild(p);
    this.el.echoLog.scrollTop = this.el.echoLog.scrollHeight;
  }

  echoReply(text) {
    this.appendEcho("him", text);
    this.echoHistory.push({ role: "assistant", content: text });
    this.el.echoSend.disabled = false;
    this.el.echoInput.disabled = false;
    if (this.echoTurns >= RULES.echo.maxTurns) {
      this.el.echoSend.disabled = true;
      this.el.echoInput.disabled = true;
      this.el.echoInput.placeholder = "今天说到这里。";
      this.appendEcho("hint", "他已经走远了。改天再来。");
    } else {
      this.el.echoInput.focus();
    }
  }

  echoFail(reason) {
    this.el.echoSend.disabled = false;
    this.el.echoInput.disabled = false;
    this.echoTurns = Math.max(0, this.echoTurns - 1);
    this.appendEcho("hint", reason);
    this.el.echoInput.focus();
  }

  openEcho(entry, config) {
    this.close(true);
    this.openPanel = "echo";
    document.body.classList.add("panel-open");
    this.currentGrave = entry;
    this.echoConfig = config || null;
    this.echoTurns = 0;
    this.echoHistory = [];
    this.el.echoName.textContent = entry.grave.name;
    const echoMeta = subjectMeta(entry.grave.subject);
    if (this.el.echoNote) this.el.echoNote.textContent = echoMeta?.echo || LEGACY_COPY.echo;
    this.el.echoLog.innerHTML = "";
    this.el.echoInput.value = "";
    this.el.echoInput.disabled = false;
    this.el.echoSend.disabled = false;
    this.el.echoInput.placeholder = "说一句话";
    this.el.echoPanel.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
    this.appendEcho("grave", entry.grave.epitaph || "……");
    setTimeout(() => this.el.echoInput.focus(), 120);
  }

  preview() {
    // 改碑时那块碑已经站在那儿了，不再画预览
    if (this.mode === "edit") return;
    this.onPreview?.({
      name: this.el.raiseName.value.trim(),
      born: this.el.raiseBorn.value.trim(),
      died: this.el.raiseDied.value.trim(),
      epitaph: this.el.raiseEpitaph.value.trim(),
      story: this.el.raiseStory.value.trim(),
      voice: this.el.raiseVoice.value.trim(),
      subject: this.subject,
      photo: this.photoUrl || "",
      photoOn: this.photoOn,
      form: this.form,
      relic: this.relic,
      sound: this.soundId,
      burial: this.burial,
      anniversary: this.el.raiseAnniv.value.trim(),
      tone: Number(this.el.raiseTone.value),
      sealed: false,
    });
  }

  value() {
    return {
      name: this.el.raiseName.value.trim(),
      epitaph: this.el.raiseEpitaph.value.trim(),
      story: this.el.raiseStory.value.trim(),
      voice: this.el.raiseVoice.value.trim(),
      form: this.form,
      relic: this.relic,
      sound: this.soundId,
      tone: Number(this.el.raiseTone.value),
    };
  }

  setRaisePending(pending) {
    this.raisePending = !!pending;
    const editing = this.mode === "edit";
    this.el.raiseConfirm.disabled = this.raisePending;
    this.el.raiseConfirm.setAttribute("aria-busy", String(this.raisePending));
    this.el.raiseConfirm.textContent = this.raisePending
      ? (editing ? "正在改…" : "正在立…")
      : (editing ? "改好了" : "立下");
  }

  resetRaise() {
    this.mode = "raise";
    this.editId = null;
    this.el.raiseName.value = "";
    this.el.raiseBorn.value = "";
    this.el.raiseDied.value = "";
    this.el.raiseEpitaph.value = "";
    this.el.raiseStory.value = "";
    this.el.raiseAnniv.value = "";
    this.el.raiseVoice.value = "";
    this.el.raiseEchoBase.value = "";
    this.el.raiseEchoKey.value = "";
    this.el.raiseEchoModel.value = "";
    this.pendingEcho = null;
    this.el.raiseTone.value = 2;
    this.form = "slab";
    this.relic = "none";
    this.soundId = "none";
    this.burial = "stone";
    this.subject = "other";
    this.photoUrl = "";
    this.photoOn = "ground";
    this.audioUrl = "";
    this.el.raisePhoto.value = "";
    this.el.raiseAudio.value = "";
    this.el.raisePhotoPreview.hidden = true;
    this.el.raisePhotoPreview.removeAttribute("src");
    this.el.raiseAudioPreview.hidden = true;
    this.el.raiseAudioPreview.removeAttribute("src");
    this.el.raisePhotoHint.textContent = "会缩到 900 像素，立在碑前";
    this.el.raiseAudioHint.textContent = "走近碑的时候会响，走开就停";
    this.refreshChips();
    this.applySubjectCopy();
    this.updateCounters();
    this.setRaisePending(false);
  }

  /* ---------- 照片与录音：先传上来，再跟着碑一起立 ---------- */

  async uploadBlob(blob, kind, type) {
    const data = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
      fr.onerror = () => reject(new Error("read_failed"));
      fr.readAsDataURL(blob);
    });
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, type, data }),
    });
    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      throw new Error(info.error || "upload_failed");
    }
    return (await res.json()).url;
  }

  async attachPhoto(file) {
    this.el.raisePhotoHint.textContent = "正在缩…";
    try {
      const bitmap = await createImageBitmap(file);
      const edge = RULES.media.photoEdge;
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", RULES.media.photoQuality));
      if (!blob) throw new Error("encode_failed");
      const url = await this.uploadBlob(blob, "photo", "image/jpeg");
      this.photoUrl = url;
      this.el.raisePhotoPreview.src = url;
      this.el.raisePhotoPreview.hidden = false;
      this.el.raisePhotoHint.textContent = "放上去了。";
      this.preview();
    } catch (err) {
      this.el.raisePhotoHint.textContent =
        err && err.message === "too_big" ? "这张太大了，换一张。" : "没能放上去，再试一次。";
    }
  }

  async attachAudio(blob, type) {
    // 浏览器常把 .webm 认成 video/webm，这里统一按「音频」处理
    let t = String(type || "").toLowerCase();
    if (!t || t === "video/webm" || t === "application/octet-stream") t = "audio/webm";
    else if (t === "video/mp4" || t === "video/x-m4a") t = "audio/mp4";
    else if (t === "video/ogg") t = "audio/ogg";

    this.el.raiseAudioHint.textContent = "正在放上去…";
    try {
      const url = await this.uploadBlob(blob, "audio", t);
      this.audioUrl = url;
      this.el.raiseAudioPreview.src = url;
      this.el.raiseAudioPreview.hidden = false;
      this.el.raiseAudioHint.textContent = "放下去了。走近碑的时候会响。";
    } catch (err) {
      this.el.raiseAudioHint.textContent =
        err && err.message === "too_big" ? "这段太长了，换短一点。" : "没能放上去，再试一次。";
    }
  }

  async startRecord() {
    if (this.recorder) {
      this.stopRecord();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      this.toast("这台设备录不了音，用「选一段录音」。");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.toast("麦克风没打开，用「选一段录音」。");
      return;
    }
    const chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    this.recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      this.recorder = null;
      this.el.raiseRecord.classList.remove("recording");
      this.el.raiseRecord.textContent = "录一段（最多八秒）";
      clearTimeout(this.recTimer);
      const blob = new Blob(chunks, { type: "audio/webm" });
      if (blob.size < 500) {
        this.toast("没录上，再试一次。");
        return;
      }
      await this.attachAudio(blob, "audio/webm");
    };
    rec.start();
    this.el.raiseRecord.classList.add("recording");
    this.el.raiseRecord.textContent = "正在录…再点一下停";
    this.recTimer = setTimeout(() => this.stopRecord(), RULES.media.audioSec * 1000);
  }

  stopRecord() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
  }

  /** 立碑时填的回声配置。密钥不上传，只在本机保存。 */
  readEchoConfig() {
    const baseUrl = this.el.raiseEchoBase.value.trim();
    const key = this.el.raiseEchoKey.value.trim();
    const model = this.el.raiseEchoModel.value.trim() || "gpt-4o-mini";
    if (!baseUrl || !key) return null;
    return { baseUrl, key, model };
  }

  takeEchoConfig() {
    const cfg = this.pendingEcho;
    this.pendingEcho = null;
    return cfg;
  }

  openRaise(ctx = null) {
    this.close(true);
    // 先换上下文再重置：重置里会刷一遍按钮，那时得知道站在哪
    if (ctx) this.raiseCtx = ctx;
    this.resetRaise();
    this.mode = "raise";
    this.editId = null;
    this.el.raiseTag.textContent = "正在留下一座纪念";
    this.el.raiseConfirm.textContent = "立下";
    this.openPanel = "raise";
    document.body.classList.add("panel-open");
    this.el.raisePanel.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
    setTimeout(() => this.el.raiseName.focus(), 120);
    this.preview();
  }

  /** 作者改自己的碑：同一块面板，但字段是填好的，位置不重算。 */
  openEdit(entry) {
    if (!entry || !entry.grave) return;
    const g = entry.grave;
    this.close(true);
    this.resetRaise();
    this.mode = "edit";
    this.editId = g.id;
    this.el.raiseTag.textContent = "在改一块已经立下的碑";
    this.el.raiseConfirm.textContent = "改好了";
    this.el.raiseName.value = g.name || "";
    this.el.raiseBorn.value = g.born || "";
    this.el.raiseDied.value = g.died || "";
    this.el.raiseEpitaph.value = g.epitaph || "";
    this.el.raiseStory.value = g.story || "";
    this.el.raiseAnniv.value = g.anniversary || "";
    this.el.raiseVoice.value = g.voice || "";
    this.el.raiseTone.value = typeof g.tone === "number" ? g.tone : 2;
    this.form = g.form || "slab";
    this.relic = g.relic || "none";
    this.burial = g.burial || "stone";
    this.subject = subjectMeta(g.subject) ? g.subject : "";
    this.soundId = g.sound || "none";
    this.photoOn = g.photoOn === "face" ? "face" : "ground";
    this.photoUrl = g.photo || "";
    this.audioUrl = g.audio || "";
    if (g.photo) {
      this.el.raisePhotoPreview.src = g.photo;
      this.el.raisePhotoPreview.hidden = false;
      this.el.raisePhotoHint.textContent = "已经放着一张，换一张就覆盖它。";
    }
    if (g.audio) {
      this.el.raiseAudioPreview.src = g.audio;
      this.el.raiseAudioPreview.hidden = false;
      this.el.raiseAudioHint.textContent = "已经放着一小段，走近就会响。";
    }
    this.refreshChips();
    this.applySubjectCopy();
    this.updateCounters();
    this.setRaisePending(false);
    this.openPanel = "raise";
    document.body.classList.add("panel-open");
    this.el.raisePanel.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
    setTimeout(() => this.el.raiseName.focus(), 120);
  }

  openRead(entry, selfId) {
    this.close(true);
    this.openPanel = "read";
    document.body.classList.add("panel-open");
    this.currentGrave = entry;
    this.renderRead(entry, selfId || this.selfId);
    this.el.readPanel.classList.remove("hidden");
    this.el.hud.classList.add("hidden");
    setTimeout(() => this.el.readClose.focus(), 80);
  }

  renderRead(entry, selfId) {
    if (!entry || !entry.grave) return;
    const g = entry.grave;
    this.el.readAuthor.textContent = `${g.authorName || "无名者"}留下的纪念${g.sealed ? " · 已沉睡" : ""}`;
    const kind = subjectMeta(g.subject);
    this.el.readSubject.textContent = kind ? `纪念 · ${kind.label}` : "";
    this.el.readSubject.classList.toggle("hidden", !kind);
    this.el.readName.textContent = g.name;
    if (g.photo) {
      this.el.readPhoto.src = g.photo;
      this.el.readPhoto.hidden = false;
    } else {
      this.el.readPhoto.hidden = true;
      this.el.readPhoto.removeAttribute("src");
    }
    this.el.readEpitaph.textContent = g.epitaph || "（这一行空着）";
    this.el.readStory.textContent = g.story || "";
    this.el.readStory.style.display = g.story ? "block" : "none";
    this.el.readLights.textContent = `${g.lights || 0} 次烛火`;
    this.el.readVisits.textContent = `${g.visits || 0} 次停留`;
    this.el.readLight.textContent = whenLit(g.lastLightAt, g.lights || 0);

    const lifeText = lifeSpan(g);
    this.el.readLife.textContent = lifeText;
    this.el.readLife.classList.toggle("hidden", !lifeText);

    const offs = g.offerings || [];
    this.el.readOffers.innerHTML = "";
    if (offs.length) {
      const head = document.createElement("span");
      head.textContent = "碑前放着：";
      this.el.readOffers.appendChild(head);
      this.el.readOffers.appendChild(
        document.createTextNode(offs.map((o) => `${OFFER_LABEL[o.kind] || "一样东西"}（${o.by}）`).join(" · "))
      );
      this.el.readOffers.classList.remove("hidden");
    } else {
      this.el.readOffers.classList.add("hidden");
    }
    const noGround = g.burial === "water" || g.burial === "sky";
    const full = offs.length >= 3;
    for (const b of [this.el.offerFlower, this.el.offerCandle, this.el.offerBird]) {
      b.disabled = noGround || full || !!g.sealed;
      b.title = noGround ? "它不在土地上，前面没有地方放东西" : full ? "这座碑前面放不下了" : "";
    }

    this.el.readNotes.innerHTML = "";
    for (const note of g.notes || []) {
      const div = document.createElement("div");
      div.className = "note";
      const by = document.createElement("span");
      by.className = "by";
      by.textContent = note.by;
      div.appendChild(by);
      div.appendChild(document.createTextNode(note.text));
      this.el.readNotes.appendChild(div);
    }
    this.el.readNotes.scrollTop = this.el.readNotes.scrollHeight;

    this.el.sealBtn.classList.toggle("hidden", g.authorId !== selfId);
    this.el.sealBtn.textContent = g.sealed ? "让它醒来" : "让它沉睡";
    this.el.editBtn.classList.toggle("hidden", g.authorId !== selfId);
    this.el.deleteBtn.classList.toggle("hidden", g.authorId !== selfId);
    this.deleteArm = null;
    this.el.deleteBtn.textContent = "拆掉这座碑";
    this.el.deleteBtn.classList.remove("danger-on");
    this.el.noteInput.disabled = !!g.sealed;
    this.el.noteInput.placeholder = g.sealed ? "它已经沉睡了" : "留一句话（会署上你的名字）";
    this.el.lightBtn.disabled = !!g.sealed;

    if (entry && this.onReadShown) this.onReadShown(entry);
  }

  refreshNote(entry) {
    if (this.currentGrave && this.currentGrave.grave.id === entry.grave.id) {
      this.renderRead(entry, this.selfId);
    }
  }

  setSelf(id) {
    this.selfId = id;
  }

  close(silent = false) {
    const was = this.openPanel;
    this.openPanel = null;
    this.currentGrave = null;
    this.echoConfig = null;
    this.setRaisePending(false);
    document.body.classList.remove("panel-open");
    this.el.raisePanel.classList.add("hidden");
    this.el.readPanel.classList.add("hidden");
    this.el.echoPanel.classList.add("hidden");
    this.el.echoInput.disabled = false;
    this.el.echoSend.disabled = false;
    this.el.hud.classList.remove("hidden");
    if (was && !silent) this.onClose?.(was);
  }

  isOpen() {
    return !!this.openPanel;
  }

  showBoot() {
    this.el.boot.classList.remove("hidden", "fade");
  }

  hideBoot() {
    this.el.boot.classList.add("fade");
    this.el.hud.classList.remove("hidden");
    setTimeout(() => this.el.boot.classList.add("hidden"), 1200);
  }

  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove("show"), ms);
  }

  /** HUD 上那个开关的状态跟着声音走。 */
  setSound(on) {
    const el = this.el.soundToggle;
    if (!el) return;
    el.textContent = on ? "声音 · 开" : "声音 · 关";
    el.classList.toggle("off", !on);
    el.setAttribute("aria-pressed", String(!!on));
    el.setAttribute("aria-label", on ? "关闭所有声音" : "打开声音");
  }

  /** 视野边缘浮起一圈光，然后慢慢散掉。 */
  veil() {
    const el = document.getElementById("silence-veil");
    if (!el) return;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  }

  prompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.add("show");
    } else {
      this.el.prompt.classList.remove("show");
    }
  }

  hot(on) {
    this.el.crosshair.classList.toggle("hot", !!on);
  }

  status(peers, graves) {
    this.el.peers.textContent = peers;
    this.el.graves.textContent = graves;
  }

  seat(on) {
    this.gesture(on ? "sit" : null);
  }

  gesture(name) {
    const text = GESTURE_TEXT[name] || "";
    this.el.seatHint.textContent = text;
    this.el.seatHint.classList.toggle("hidden", !text);
  }

  toggleHelp(force) {
    const show = force !== undefined ? force : this.el.help.classList.contains("hidden");
    this.el.help.classList.toggle("hidden", !show);
    if (show) setTimeout(() => this.el.helpClose.focus(), 0);
    return show;
  }

  helpVisible() {
    return !this.el.help.classList.contains("hidden");
  }

  /**
   * 墓园名录。碑多了之后，"走过才看得见"就不够用了——
   * 得能按葬法挑、能看出哪座是自己的、点了之后屏幕上一直有指路。
   */
  renderList(graves, onPick, opts = {}) {
    const wasHidden = this.el.list.classList.contains("hidden");
    this.listAll = graves;
    this.listOnPick = onPick;
    this.listFilter = opts.filter || this.listFilter || "all";

    const filters = [
      ["all", "全部"],
      ["stone", "石碑"],
      ["tree", "木牌"],
      ["water", "纸船"],
      ["sky", "天灯"],
      ...SUBJECTS.map((s) => [s.id, s.short]),
      ["mine", "只有我的"],
    ];
    this.el.listFilters.innerHTML = "";
    for (const [key, label] of filters) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (this.listFilter === key ? " on" : "");
      chip.dataset.filter = key;
      chip.textContent = label;
      chip.setAttribute("aria-pressed", String(this.listFilter === key));
      chip.onclick = (e) => {
        e.stopPropagation();
        this.renderList(this.listAll, this.listOnPick, { filter: key });
        setTimeout(() => this.el.listFilters.querySelector(`[data-filter="${key}"]`)?.focus(), 0);
      };
      this.el.listFilters.appendChild(chip);
    }

    const rows = this.listAll.filter((g) => {
      if (this.listFilter === "all") return true;
      if (this.listFilter === "mine") return g.mine;
      if (subjectMeta(this.listFilter)) return g.subject === this.listFilter;
      return (g.burial || "stone") === this.listFilter;
    });

    this.el.listBody.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "list-row empty";
      const text = document.createElement("span");
      text.className = "n";
      text.textContent = "这一类还没有纪念。";
      empty.appendChild(text);
      this.el.listBody.appendChild(empty);
    }
    for (const g of rows) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "list-row";

      const n = document.createElement("span");
      n.className = "n";
      n.textContent = g.name;

      const d = document.createElement("span");
      d.className = "d";
      const kind = subjectMeta(g.subject);
      const parts = [kind ? kind.short : "未标明", BURIAL_SHORT[g.burial || "stone"] || "石碑"];
      parts.push(g.distance ? `${Math.round(g.distance)} 米` : "远方");
      if (g.lights) parts.push(`${g.lights} 次光`);
      const life = lifeSpan(g);
      if (life) parts.push(life);
      const offs = (g.offerings || []).length;
      if (offs) parts.push(`${offs} 件献物`);
      if (g.mine) parts.push("你的");
      d.textContent = parts.join(" · ");

      row.append(n, d);
      row.onclick = () => onPick(g);
      this.el.listBody.appendChild(row);
    }
    this.el.list.classList.remove("hidden");
    if (wasHidden) {
      setTimeout(() => (this.el.listBody.querySelector("button.list-row") || this.el.listClose).focus(), 0);
    }
  }

  showIntro() {
    if (!this.el.intro) return;
    this.el.intro.classList.remove("hidden");
    // 不用 rAF：有的帧率模式下回调会被推迟，直接延时一帧就够
    setTimeout(() => {
      if (this.el.intro) this.el.intro.style.opacity = "1";
    }, 40);
    setTimeout(() => {
      if (this.el.intro) this.el.intro.style.opacity = "0";
    }, 6200);
    setTimeout(() => {
      if (this.el.intro) this.el.intro.classList.add("hidden");
    }, 8200);
  }

  guide(text) {
    if (!this.el.guide) return;
    if (!text) {
      this.el.guide.classList.add("hidden");
      return;
    }
    if (this.el.guide.textContent !== text) this.el.guide.textContent = text;
    this.el.guide.classList.remove("hidden");
  }

  listVisible() {
    return !this.el.list.classList.contains("hidden");
  }

  hideList() {
    this.el.list.classList.add("hidden");
  }
}

export function limits() {
  return {
    name: RULES.grave.nameMax,
    epitaph: RULES.grave.epitaphMax,
    story: RULES.grave.storyMax,
    note: RULES.grave.noteMax,
  };
}
