import { WebSocket } from "ws";

const url = process.argv[2] || "ws://127.0.0.1:8899/live";
const seconds = Number(process.argv[3] || 25);

const ws = new WebSocket(url);
ws.on("open", () => {
  ws.send(JSON.stringify({ t: "join", uid: "peer-latecomer", name: "后来的人", x: 1, y: 0, z: 60, yaw: 0 }));
  let tick = 0;
  const timer = setInterval(() => {
    tick += 0.2;
    const x = 1 + Math.sin(tick) * 2.2;
    const z = 60 + Math.cos(tick * 0.7) * 2.0;
    ws.send(JSON.stringify({ t: "move", x, y: 0, z, yaw: Math.sin(tick * 0.5) * 1.6, anim: "walk" }));
  }, 120);
  setTimeout(() => {
    clearInterval(timer);
    ws.close();
    process.exit(0);
  }, seconds * 1000);
});
ws.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
