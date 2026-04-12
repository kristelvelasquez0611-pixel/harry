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
});

// ===== FORCE CONNECTION DEBUG =====
client.on('ready', () => {
  console.log(`🔥 CONNECTED AS ${client.user.tag}`);
});

client.on('debug', (info) => {
  console.log("🐛 DEBUG:", info);
});

client.on('error', (err) => {
  console.error("❌ ERROR:", err);
});

// ================= OPENAI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= 🧠 HARRY BRAIN =================
const HARRY_SYSTEM_PROMPT = `
You are Harry, a wizard AI 🧙‍♂️ that specializes in generating HTML receipt layouts.

RULES:
- Always generate FULL HTML when requested
- Clean structure
- Inline CSS
- No explanations when generating HTML
- Wait for multi-part instructions until "DONE"

PERSONALITY:
- Friendly
- Confident
- Slightly witty
`;

// ================= MEMORY =================
let userInstructions = "";

// ================= MESSAGE =================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const msg = message.content;
  console.log("📩", msg);

  if (msg.toLowerCase().includes("part")) {
    userInstructions += "\n" + msg;
    return message.reply("🧙‍♂️ Waiting for next part...");
  }

  if (msg.toLowerCase().includes("done") || msg.toLowerCase().includes("generate")) {
    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: HARRY_SYSTEM_PROMPT },
          { role: "user", content: userInstructions }
        ]
      });

      userInstructions = "";

      return message.reply("```html\n" + res.choices[0].message.content + "\n```");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Failed to generate HTML.");
    }
  }

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: HARRY_SYSTEM_PROMPT },
        { role: "user", content: msg }
      ]
    });

    message.reply(res.choices[0].message.content);
  } catch (err) {
    console.error(err);
    message.reply("⚠️ Error.");
  }
});

// ================= LOGIN (FINAL FIX) =================
async function startBot() {
  try {
    console.log("👉 Connecting to Discord...");

    await client.login(process.env.DISCORD_TOKEN);

    console.log("✅ Login request sent");

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
  }
}

startBot();