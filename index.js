require("dotenv").config();

global.fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧠 Harry (Hyeri Brain) Running"));
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

// ================= ETA =================
function getETA(position) {
  return `~${position * 10} seconds`;
}

// ================= QUEUE =================
let queue = [];
let isProcessing = false;

async function updateQueueUI() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const pos = i + 1;
    const eta = getETA(pos);

    let text = `⏳ Queue position: #${pos}\n⏱ ETA: ${eta}`;

    if (pos === 1) text += "\n🟡 You are next...";
    else text += "\n⬆️ Moving up...";

    try {
      await job.statusMsg.edit(`👀 Got your request!\n${text}`);
    } catch {}
  }
}

// ================= PROCESS =================
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const job = queue.shift();
  const { message, user, project, msg, statusMsg } = job;

  updateQueueUI();

  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping().catch(() => {});
  }, 3000);

  try {
    await statusMsg.edit("⚙️ Understanding template...");
    await statusMsg.edit("📄 Generating receipt...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are Harry, an expert HTML receipt generator.

You behave like a human designer recreating receipts.

RULES:
- Follow the provided template EXACTLY in layout and structure
- Keep spacing, alignment, and visual flow identical
- DO NOT redesign or modernize
- DO NOT add new sections

ALLOWED:
- Replace all values using the provided data
- Generate multiple items by repeating the same visual structure
- Adjust content naturally while preserving layout

IMPORTANT:
- Think like recreating the SAME receipt with different data
- Preserve thermal receipt look

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

    typing = false;
    clearInterval(typingInterval);

    if (!html) return statusMsg.edit("⚠️ Failed to generate.");

    const fileName = `output_${Date.now()}.html`;
    fs.writeFileSync(fileName, html);

    await statusMsg.edit({
      content: `✅ Done (${user.project})`,
      files: [fileName]
    });

  } catch (err) {
    console.error(err);
    await statusMsg.edit("❌ Error occurred.");
  }

  isProcessing = false;
  processQueue();
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🔥 Harry (Hyeri Brain) as ${client.user.tag}`);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  await message.react("👀").catch(() => {});

  const userId = message.author.id;
  const msg = message.content.trim();

  if (!memory.users[userId]) {
    memory.users[userId] = { project: null };
  }

  const user = memory.users[userId];

  // SET PROJECT
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

  // SAVE TEMPLATE
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

  // PASTE HTML
  if (msg.includes("<!DOCTYPE html>")) {
    project.template = msg;
    saveMemory();
    return message.reply("🧠 Template learned.");
  }

  if (!project.template) {
    return message.reply("⚠️ Send HTML template first.");
  }

  // GENERATE
  if (msg.toLowerCase().includes("generate")) {

    const position = queue.length + 1;
    const eta = getETA(position);

    const statusMsg = await message.reply(
      `👀 Got your request!\n⏳ Queue position: #${position}\n⏱ ETA: ${eta}`
    );

    queue.push({ message, user, project, msg, statusMsg });

    updateQueueUI();
    processQueue();
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);