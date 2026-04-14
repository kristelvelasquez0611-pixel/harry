require("dotenv").config();

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧙 Harry is running"));
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
let memory = { projects: {}, users: {} };

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

  await message.react("👀").catch(() => {});

  const position = queue.length + 1;

  const statusMsg = await message.reply(
    `👀 Got your request!\n⏳ Queue position: #${position}`
  );

  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping();
  }, 3000);

  queue.push(async () => {
    let timeout;

    try {
      const userId = message.author.id;
      const msg = message.content.trim();

      // ⏰ TIMEOUT PROTECTION
      timeout = setTimeout(() => {
        console.log("⏰ TIMEOUT");

        typing = false;
        clearInterval(typingInterval);

        statusMsg.edit("⏰ Request timed out. Try again.");
      }, 60000);

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

        clearTimeout(timeout);
        typing = false;
        clearInterval(typingInterval);

        return statusMsg.edit(`📁 Project set to: ${name}`);
      }

      const project = memory.projects[user.currentProject];

      if (!project) {
        clearTimeout(timeout);
        typing = false;
        clearInterval(typingInterval);
        return statusMsg.edit("⚠️ Set project first.");
      }

      // ================= TEMPLATE FILE =================
      if (message.attachments.size > 0) {
        const file = message.attachments.first();

        if (file.name.toLowerCase().endsWith(".html")) {
          await statusMsg.edit("📥 Saving template...");

          const res = await fetch(file.url);
          const html = await res.text();

          project.template = html;
          saveMemory();

          clearTimeout(timeout);
          typing = false;
          clearInterval(typingInterval);

          return statusMsg.edit(`🧠 Template saved for: ${user.currentProject}`);
        } else {
          clearTimeout(timeout);
          typing = false;
          clearInterval(typingInterval);

          return statusMsg.edit("⚠️ Upload a valid .html file.");
        }
      }

      // ================= TEMPLATE PASTE =================
      if (msg.includes("<!DOCTYPE html>")) {
        project.template = msg;
        saveMemory();

        clearTimeout(timeout);
        typing = false;
        clearInterval(typingInterval);

        return statusMsg.edit(`🧠 Template updated.`);
      }

      if (!project.template) {
        clearTimeout(timeout);
        typing = false;
        clearInterval(typingInterval);

        return statusMsg.edit("⚠️ No template yet.");
      }

      // ================= GENERATE =================
      await statusMsg.edit("📄 Generating HTML...");

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
You are Harry, an HTML receipt wizard.

STRICT RULES:
- DO NOT change layout
- DO NOT change spacing
- DO NOT change structure
- ONLY replace values

MULTI-ITEM:
- Duplicate existing item block

BASE64:
- DO NOT modify

OUTPUT:
- FULL HTML ONLY
- NO explanation
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
        clearTimeout(timeout);
        typing = false;
        clearInterval(typingInterval);
        return statusMsg.edit("⚠️ Failed to generate.");
      }

      fs.writeFileSync("output.html", html);

      clearTimeout(timeout);
      typing = false;
      clearInterval(typingInterval);

      return statusMsg.edit({
        content: `✅ Done (${user.currentProject})`,
        files: ["output.html"]
      });

    } catch (err) {
      console.error(err);

      clearTimeout(timeout);
      typing = false;
      clearInterval(typingInterval);

      return statusMsg.edit("❌ Error occurred.");
    }
  });

  processQueue();
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);