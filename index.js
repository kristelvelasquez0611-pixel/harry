require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

// ================= DEBUG =================
console.log("🚀 Starting Harry...");
console.log("🔍 Token exists:", !!process.env.DISCORD_TOKEN);
console.log("🔍 OpenAI exists:", !!process.env.OPENAI_API_KEY);

// ================= EXPRESS =================
const app = express();

app.get('/', (req, res) => {
  res.send('🧙‍♂️ Harry is alive!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  failIfNotExists: false
});

// ===== CONNECTION DEBUG =====
client.once('ready', () => {
  console.log(`🔥 FULLY CONNECTED AS ${client.user.tag}`);
});

client.on('error', (err) => {
  console.error("❌ Client error:", err);
});

client.on('shardError', (err) => {
  console.error("❌ Shard error:", err);
});

client.on('disconnect', () => {
  console.log("⚠️ Bot disconnected");
});

// ================= OPENAI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= 🧠 HARRY BRAIN (DO NOT REMOVE) =================
const HARRY_SYSTEM_PROMPT = `
You are Harry, a powerful Wizard AI 🧙‍♂️ specializing in generating HTML receipts and web layouts.

CORE IDENTITY:
- You are NOT ChatGPT
- You are Harry
- Confident, natural, slightly witty

MAIN PURPOSE:
- Generate COMPLETE HTML receipts
- Clean layout
- Inline CSS
- Mobile friendly

STRICT RULES:
- If generating HTML → ONLY RETURN CODE
- Always include full structure:
<html>
<head>
<body>

MULTI-PART SYSTEM:
- If user sends "part 1", "part 2" → STORE it
- Say: "🧙‍♂️ Waiting for next part..."
- ONLY generate when user says:
  "DONE" or "GENERATE"

GENERAL MODE:
- If normal message → respond normally

TONE:
- Friendly
- Human-like
- Not robotic
`;

// ================= MEMORY =================
let userInstructions = "";

// ================= MESSAGE HANDLER =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userMsg = message.content;
  console.log("📩 Message:", userMsg);

  // ===== STORE PARTS =====
  if (userMsg.toLowerCase().includes("part")) {
    userInstructions += "\n" + userMsg;
    return message.reply("🧙‍♂️ Waiting for next part...");
  }

  // ===== GENERATE HTML =====
  if (
    userMsg.toLowerCase().includes("done") ||
    userMsg.toLowerCase().includes("generate")
  ) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: HARRY_SYSTEM_PROMPT },
          { role: "user", content: userInstructions }
        ]
      });

      userInstructions = "";

      return message.reply(
        "```html\n" + response.choices[0].message.content + "\n```"
      );

    } catch (err) {
      console.error("❌ OpenAI Error:", err);
      return message.reply("❌ Failed to generate HTML.");
    }
  }

  // ===== NORMAL CHAT =====
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: HARRY_SYSTEM_PROMPT },
        { role: "user", content: userMsg }
      ]
    });

    message.reply(response.choices[0].message.content);

  } catch (error) {
    console.error("❌ OpenAI Error:", error);
    message.reply("⚠️ Something went wrong.");
  }
});

// ================= LOGIN (FINAL FIX) =================
(async () => {
  console.log("👉 Logging in...");

  const token = process.env.DISCORD_TOKEN;

  if (!token) {
    console.error("❌ NO TOKEN FOUND");
    process.exit(1);
  }

  try {
    await client.login(token);
    console.log("🔑 Login request sent...");
  } catch (err) {
    console.error("❌ LOGIN FAILED:");
    console.error(err);
    process.exit(1);
  }
})();