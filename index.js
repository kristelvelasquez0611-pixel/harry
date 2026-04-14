require("dotenv").config();

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧠 Harry Live Queue + ETA Running"));
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

// ================= ETA FUNCTION =================
function getETA(position) {
  const secondsPerJob = 15; // adjust if needed
  const eta = position * secondsPerJob;
  return `~${eta} seconds`;
}

// ================= QUEUE =================
let queue = [];
let isProcessing = false;

// 🔄 LIVE QUEUE UPDATE
async function updateQueueUI() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const position = i + 1;
    const eta = getETA(position);

    let text = `⏳ Queue position: #${position}\n⏱ Estimated wait: ${eta}`;

    if (position === 1) {
      text += "\n🟡 You are next...";
    } else {
      text += "\n⬆️ Moving up...";
    }

    try {
      await job.statusMsg.edit(`👀 Got your request!\n${text}`);
    } catch {}
  }
}

// 🔄 PROCESS QUEUE
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const job = queue.shift();
  const { message, user, project, msg, statusMsg } = job;

  // update queue positions
  updateQueueUI();

  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping().catch(() => {});
  }, 3000);

  let timeout;

  try {
    // ⏰ TIMEOUT
    timeout = setTimeout(() => {
      typing = false;
      clearInterval(typingInterval);
      statusMsg.edit("⏰ Request timed out. Try again.");
    }, 60000);

    // ⚙️ PROCESSING
    await statusMsg.edit("⚙️ Processing your request...");

    // 📄 GENERATING
    await statusMsg.edit("📄 Generating HTML...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are Harry, an HTML Wizard.

STRICT TEMPLATE LOCK MODE:

DO NOT:
- change layout
- change spacing
- change alignment
- remove anything

ONLY:
- replace values
- duplicate item blocks if needed

Return FULL HTML only.
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

    // ✅ UNIQUE FILE
    const fileName = `output_${message.author.id}_${Date.now()}.html`;
    fs.writeFileSync(fileName, html);

    clearTimeout(timeout);
    typing = false;
    clearInterval(typingInterval);

    await statusMsg.edit({
      content: `✅ Done (${user.project})`,
      files: [fileName]
    });

  } catch (err) {
    console.error(err);

    clearTimeout(timeout);
    typing = false;
    clearInterval(typingInterval);

    await statusMsg.edit("❌ Error occurred.");
  }

  isProcessing = false;
  processQueue();
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🔥 Harry LIVE QUEUE + ETA MODE as ${client.user.tag}`);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  await message.react("👀").catch(() => {});

  const userId = message.author.id;
  const msg = message.content.trim();

  // INIT USER
  if (!memory.users[userId]) {
    memory.users[userId] = { project: null };
  }

  const user = memory.users[userId];

  // ===== SET PROJECT =====
  if (msg.toLowerCase().startsWith("project:")) {
    const name = msg.split(":")[1]?.trim().toLowerCase();

    user.project = name;

    if (!memory.projects[name]) {
      memory.projects[name] = { template: null };
    }

    saveMemory();

    return message.reply(`📁 Project set to: ${name}`);
  }

  const project = memory.projects[user.project];

  if (!project) {
    return message.reply("⚠️ Set project first.");
  }

  // ===== SAVE TEMPLATE =====
  if (message.attachments.size > 0) {
    const file = message.attachments.first();

    if (file.name.endsWith(".html")) {
      const res = await fetch(file.url);
      const html = await res.text();

      project.template = html;
      saveMemory();

      return message.reply("🧠 Template saved!");
    }
  }

  // ===== PASTE HTML =====
  if (msg.includes("<!DOCTYPE html>")) {
    project.template = msg;
    saveMemory();

    return message.reply("🧠 Template learned.");
  }

  if (!project.template) {
    return message.reply("⚠️ Send HTML template first.");
  }

  // ===== GENERATE =====
  if (msg.toLowerCase().includes("generate")) {

    const position = queue.length + 1;
    const eta = getETA(position);

    const statusMsg = await message.reply(
      `👀 Got your request!\n⏳ Queue position: #${position}\n⏱ Estimated wait: ${eta}`
    );

    queue.push({ message, user, project, msg, statusMsg });

    updateQueueUI();
    processQueue();
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);