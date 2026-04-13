require("dotenv").config();

global.fetch = require("node-fetch");

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧙 Harry Queue UI Running"));
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("🌐 Server running"));

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= OPENAI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ================= MEMORY =================
let memory = {
  projects: {},
  users: {}
};

if (fs.existsSync("memory.json")) {
  memory = JSON.parse(fs.readFileSync("memory.json"));
}

function saveMemory() {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

// ================= QUEUE =================
let queue = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;

  processing = true;
  const job = queue.shift();

  try {
    await job();
  } catch (err) {
    console.error("QUEUE ERROR:", err);
  }

  processing = false;
  processQueue();
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🔥 Harry is LIVE as ${client.user.tag}`);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  await message.react("👀");

  // ================= QUEUE POSITION =================
  const position = queue.length + 1;

  const statusMsg = await message.reply(
    `👀 Got your request!\n⏳ Queue position: #${position}`
  );

  // ================= TYPING (IMMEDIATE) =================
  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping();
  }, 3000);

  queue.push(async () => {
    try {
      const userId = message.author.id;
      const msg = message.content.trim();

      // ================= PROCESSING STATUS =================
      await statusMsg.edit("⚙️ Processing your request...");

      // INIT USER
      if (!memory.users[userId]) {
        memory.users[userId] = { currentProject: null };
      }

      const user = memory.users[userId];

      // ================= SET PROJECT =================
      if (msg.toLowerCase().startsWith("project:")) {
        const name = msg.split(":")[1]?.trim().toLowerCase();

        user.currentProject = name;

        if (!memory.projects[name]) {
          memory.projects[name] = { template: null };
        }

        saveMemory();

        typing = false;
        clearInterval(typingInterval);

        return statusMsg.edit(`📁 Project set to: ${name}`);
      }

      // ================= GET PROJECT =================
      const project = memory.projects[user.currentProject];

      if (!project) {
        typing = false;
        clearInterval(typingInterval);
        return statusMsg.edit("⚠️ Set project first: project: name");
      }

      // ================= TEMPLATE VIA FILE =================
      if (message.attachments.size > 0) {
        const file = message.attachments.first();

        if (file.name.endsWith(".html")) {
          const res = await fetch(file.url);
          const html = await res.text();

          project.template = html;
          saveMemory();

          typing = false;
          clearInterval(typingInterval);

          return statusMsg.edit(`🧠 Template saved for: ${user.currentProject}`);
        }
      }

      // ================= TEMPLATE VIA PASTE =================
      if (msg.includes("<!DOCTYPE html>")) {
        project.template = msg;
        saveMemory();

        typing = false;
        clearInterval(typingInterval);

        return statusMsg.edit(`🧠 Template updated for: ${user.currentProject}`);
      }

      if (!project.template) {
        typing = false;
        clearInterval(typingInterval);
        return statusMsg.edit("⚠️ No template yet.");
      }

      // ================= GENERATE =================
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
You are Harry, an HTML receipt wizard.

🚨 ULTRA STRICT TEMPLATE LOCK MODE 🚨

RULES:
- DO NOT change structure
- DO NOT change spacing
- DO NOT change alignment
- DO NOT change CSS
- DO NOT change classes

ONLY replace TEXT VALUES.

BASE64:
- DO NOT modify base64 images

MULTI-ITEM:
- Duplicate existing item block only

QR / PIN:
- Update value only

POLICY:
- KEEP EXACT format including <br>

OUTPUT:
- FULL HTML ONLY
- NO markdown
- NO explanation

FAIL IF YOU MODIFY STRUCTURE
`
          },
          {
            role: "user",
            content: `
TEMPLATE:
${project.template}

DATA:
${msg}
`
          }
        ]
      });

      const html = response.choices?.[0]?.message?.content;

      if (!html) {
        typing = false;
        clearInterval(typingInterval);
        return statusMsg.edit("⚠️ Failed to generate.");
      }

      fs.writeFileSync("output.html", html);

      typing = false;
      clearInterval(typingInterval);

      return statusMsg.edit({
        content: `✅ Done (${user.currentProject})`,
        files: ["output.html"]
      });

    } catch (err) {
      console.error(err);
      return statusMsg.edit("❌ Error occurred.");
    }
  });

  processQueue();
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);