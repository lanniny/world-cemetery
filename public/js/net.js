export class Net {
  constructor(handlers = {}) {
    this.h = handlers;
    this.ws = null;
    this.uid = null;
    this.outbox = [];
    this.retry = 0;
    this.closed = false;
    this.token = null;
  }

  connect(profile, token) {
    this.profile = profile;
    this.token = token;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${scheme}//${location.host}/live`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.retry = 0;
      // token 是唯一能证明"这个身份是我的"的东西；uid 只是给游客用的临时名字
      this.send({
        t: "join",
        uid: this.profile.uid,
        name: this.profile.name,
        token: this.token || "",
        ...profile.pos,
      });
      while (this.outbox.length) {
        const msg = this.outbox.shift();
        this.ws.send(JSON.stringify(msg));
      }
      this.h.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.t) {
        case "welcome":
          this.uid = msg.you;
          this.h.onWelcome?.(msg);
          break;
        case "peers":
          this.h.onPeers?.(msg.l || []);
          break;
        case "raised":
          this.h.onRaised?.(msg.grave);
          break;
        case "updated":
          this.h.onUpdated?.(msg);
          break;
        case "gone":
          this.h.onGone?.(msg);
          break;
        case "edited":
          this.h.onEdited?.(msg.grave);
          break;
        case "bell":
          this.h.onBell?.(msg);
          break;
        case "silence":
          this.h.onSilence?.(msg);
          break;
        case "noted":
          this.h.onNoted?.(msg);
          break;
        case "peerIn":
          this.h.onPeerIn?.(msg);
          break;
        case "peerOut":
          this.h.onPeerOut?.(msg);
          break;
        case "reject":
          this.h.onReject?.(msg);
          break;
        default:
          break;
      }
    };

    this.ws.onclose = () => {
      this.h.onClose?.();
      if (this.closed) return;
      this.retry = Math.min(this.retry + 1, 6);
      const wait = 400 * Math.pow(1.7, this.retry);
      setTimeout(() => this.connect(this.profile, this.token), wait);
    };

    this.ws.onerror = () => {};
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    } else if (msg.t !== "join") {
      this.outbox.push(msg);
      if (this.outbox.length > 40) this.outbox.shift();
    }
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
