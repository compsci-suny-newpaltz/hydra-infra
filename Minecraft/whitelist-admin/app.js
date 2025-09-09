const express = require("express");
const bodyParser = require("body-parser");
const { Rcon } = require("rcon-client");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

const RCON_HOST = process.env.RCON_HOST || "mc";
const RCON_PORT = parseInt(process.env.RCON_PORT || "25575", 10);
const RCON_PASSWORD = process.env.RCON_PASSWORD;
const APP_PORT = parseInt(process.env.APP_PORT || "3000", 10);

async function withRcon(fn) {
  const rcon = new Rcon({
    host: RCON_HOST,
    port: RCON_PORT,
    password: RCON_PASSWORD
  });
  await rcon.connect();
  try {
    return await fn(rcon);
  } finally {
    rcon.end();
  }
}

app.get("/api/status", async (_req, res) => {
  try {
    const reply = await withRcon((r) => r.send("list"));
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Ensure whitelist is on
app.post("/api/enable", async (_req, res) => {
  try {
    const reply = await withRcon((r) => r.send("whitelist on"));
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/add", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });

  try {
    // Add & ensure enabled
    const reply1 = await withRcon((r) => r.send(`whitelist add ${name}`));
    const reply2 = await withRcon((r) => r.send("whitelist on"));
    res.json({ ok: true, added: name, replies: [reply1, reply2] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/remove", async (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, error: "Name required" });

  try {
    const reply = await withRcon((r) => r.send(`whitelist remove ${name}`));
    res.json({ ok: true, removed: name, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/list", async (_req, res) => {
  try {
    const reply = await withRcon((r) => r.send("whitelist list"));
    // Reply looks like: "There are N whitelisted players: name1, name2"
    const names = reply.includes(":")
      ? reply.split(":")[1].split(",").map(s => s.trim()).filter(Boolean)
      : [];
    res.json({ ok: true, raw: reply, names });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(APP_PORT, () => {
  console.log(`Whitelist Admin listening on 0.0.0.0:${APP_PORT}`);
});

