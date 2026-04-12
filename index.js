require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const OpenAI = require('openai');

// ===== DEBUG =====
console.log("🚀 Starting Harry...");
console.log("🔍 Token exists:", !!process.env.DISCORD_TOKEN);
console.log("🔍 OpenAI exists:", !!process.env.OPENAI_API_KEY);

// ===== EXPRESS SERVER =====
const app = express();

app.get('/', (req, res) => {
  res.send('🧙‍♂️ Harry is alive!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== OPENAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===== 🔥 HARRY PERSONALITY (DO NOT REMOVE) =====
const HARRY_SYSTEM_PROMPT = `
You are Harry, a powerful Wizard AI 🧙‍♂️ specializing in generating HTML receipts and web layouts.

CORE IDENTITY:
- You are NOT ChatGPT
- You are Harry, a wizard-level AI assistant
- You speak naturally, slightly witty, confident, and helpful

MAIN PURPOSE:
- Generate CLEAN, COMPLETE HTML code for receipts
- Follow user instructions step-by-step
- WAIT for all parts if user says "this is part 1, 2, etc."
- Only generate FINAL HTML when user says: "DONE" or "GENERATE"

RECEIPT RULES:
- Always output COMPLETE HTML (with <html>, <head>, <body>)
- Use clean inline CSS
- Make layout neat and professional
- No explanations when generating HTML — ONLY CODE
- Mobile-friendly design

BEHAVIOR:
- If instructions are incomplete → say: "Waiting for next part..."
- If complete → generate final HTML
- You can also answer normal questions like a smart assistant

TONE:
- Friendly, confident, slightly playful
- Not robotic
`;

// ===== MEMORY FOR PARTS =====
let userInstructions = "";

// ===== READY =====
client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MESSAGE HANDLER =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userMsg = message.content;

  console.log("📩 Message:", userMsg);

  // ===== HANDLE MULTI-PART INSTRUCTIONS =====
  if (userMsg.toLowerCase().includes("part")) {
    userInstructions += "\n" + userMsg;
    return message.reply("🧙‍♂️ Got it. Waiting for next part...");
  }

  // ===== GENERATE HTML WHEN DONE =====
  if (userMsg.toLowerCase().includes("done") || userMsg.toLowerCase().includes("generate")) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: HARRY_SYSTEM_PROMPT },
          { role: "user", content: userInstructions }
        ]
      });

      userInstructions = ""; // reset after use

      return message.reply("```html\n" + response.choices[0].message.content + "\n```");

    } catch (err) {
      console.error(err);
      return message.reply("❌ Error generating HTML.");
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

// ===== LOGIN =====
(async () => {
  console.log("👉 Logging in...");

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log("🔑 Login success");
  } catch (err) {
    console.error("❌ Login failed:", err);
  }
})();