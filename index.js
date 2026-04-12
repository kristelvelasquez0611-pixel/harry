import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';

console.log("🚀 Starting bot...");

// Create client
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

// When message received
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  console.log("📩 Message received:", message.content);

  if (message.content.toLowerCase() === 'hello') {
    message.reply('Hello! I am alive 🤖');
  }
});

// LOGIN (VERY IMPORTANT)
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log("🔑 Login success"))
  .catch(err => console.error("❌ Login error:", err));