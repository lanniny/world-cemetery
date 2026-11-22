/**
 * 假的 OpenAI 兼容上游，用来在没有真 key 的时候验证回声链路。
 * 只回一句固定的话，方便确认请求拼装、解析、限流是否正常。
 * 用法：node scripts/mock-echo.mjs    然后给主服务设 ECHO_BASE_URL=http://127.0.0.1:8898/v1
 */
import http from "node:http";

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url.startsWith("/v1/chat/completions")) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        let parsed = {};
        try {
          parsed = JSON.parse(body || "{}");
        } catch {
          /* 忽略坏请求 */
        }
        const msgs = parsed.messages || [];
        const system = msgs.find((m) => m.role === "system");
        const users = msgs.filter((m) => m.role === "user");
        console.log("上游收到：", JSON.stringify({ model: parsed.model, system: system?.content?.slice(0, 40), turns: users.length }));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "记得。那年雨下了很久，你站在门口不肯进来。" } }],
          })
        );
      });
      return;
    }
    res.writeHead(404).end();
  })
  .listen(8898, () => console.log("mock echo 在 8898 等着"));
