import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';

// =========================
// 🌐 EXPRESS SERVER (RENDER FIX)
// =========================
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// 🤖 DISCORD BOT
// =========================
console.log("🚀 Starting bot...");

// Check token
console.log("🔍 Token check:", process.env.DISCORD_TOKEN ? "EXISTS" : "MISSING");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// When bot is ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// When message is received
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  console.log("📩 Message:", message.content);

  if (message.content.toLowerCase() === 'hello') {
    message.reply('Hello! I am alive 🤖');
  }
});

// =========================
// 🔐 LOGIN (WITH DEBUG)
// =========================
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("🔑 Login success"))
  .catch(err => {
    console.error("❌ LOGIN FAILED:");
    console.error(err);
  });