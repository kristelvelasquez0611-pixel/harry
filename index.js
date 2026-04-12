import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import OpenAI from 'openai';
import express from 'express';

// ===== EXPRESS SERVER (RENDER FIX) =====
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ===== CHECK ENV =====
console.log("Checking ENV...");
console.log("DISCORD_TOKEN exists:", !!process.env.DISCORD_TOKEN);
console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);

// ===== OPENAI =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== DISCORD CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===== READY EVENT =====
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== MESSAGE HANDLER =====
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log("📩 Message received:", message.content);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are Harry, a friendly AI assistant." },
        { role: "user", content: message.content },
      ],
    });

    const reply = response.choices[0].message.content;

    await message.reply(reply);

  } catch (error) {
    console.error("❌ OpenAI Error:", error);
    message.reply("Error processing your request.");
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("🔑 Discord login success"))
  .catch(err => console.error("❌ Discord login failed:", err));