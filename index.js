import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';

// EXPRESS SERVER (REQUIRED FOR RENDER)
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// DISCORD BOT
console.log("🚀 Starting bot...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  console.log("📩 Message:", message.content);

  if (message.content.toLowerCase() === 'hello') {
    message.reply('Hello! I am alive 🤖');
  }
});

client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("🔑 Login success"))
  .catch(err => console.error("❌ Login error:", err));