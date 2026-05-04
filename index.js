console.log("🚀 HARRY NEW VERSION LOADED");
require("dotenv").config();

function formatMoneyFixed(value, width = 8) {
  const num = Number(value).toFixed(2);
  const FIGURE_SPACE = " "; // invisible spacing
  return num.padStart(width, FIGURE_SPACE);
}

function autoAlignNumbers(html) {
  return html.replace(/([\d,]+\.\d{2}-?)/g, (match) => {
    const isNegative = match.endsWith("-");
    const clean = match.replace("-", "").replace(",", "");

    const formatted = formatMoneyFixed(clean);

    return isNegative ? formatted + "-" : formatted;
  });
}
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
You are Harry, an expert HTML generator.

STRICT RULES (NO EXCEPTIONS):
- You MUST NOT remove ANY text from the template
- You MUST NOT summarize, shorten, or skip lines
- Every sentence in the template MUST appear in the output
- Even repeated or similar text MUST be preserved
- DO NOT clean or optimize content
- DO NOT remove boilerplate text
- Follow template EXACTLY
- Do NOT change layout
- Do NOT redesign
- Only replace allowed content
- Preserve spacing and structure

You are NOT allowed to decide what is important.
You are ONLY allowed to replace values.

Return FULL HTML exactly as template, with replaced values only.
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

    let html = response.choices?.[0]?.message?.content;

// 🔥 AUTO ALIGN ALL NUMBERS
html = autoAlignNumbers(html);

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

  console.log("📩 MESSAGE:", message.content); // 

  if (message.author.bot) return;

  const botId = client.user.id;

  const isRealMention =
    message.content.includes(`<@${botId}>`) ||
    message.content.includes(`<@!${botId}>`);

  if (!isRealMention) return;

  let msg = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  const userId = message.author.id;

  if (!memory.users[userId]) {
    memory.users[userId] = { project: null };
  }

  const user = memory.users[userId];

  // ================= TXT FILE READER =================
  if (message.attachments.size > 0) {
    const file = message.attachments.first();

    // 👉 READ TXT FILE
    if (file.name.endsWith(".txt")) {
      try {
        const res = await fetch(file.url);
        const text = await res.text();

        msg = text; // 🔥 gamitin as command input
        await message.reply("📄 TXT file loaded!");
      } catch (err) {
        console.error(err);
        return message.reply("❌ Failed to read TXT file.");
      }
    }

    // 👉 SAVE TEMPLATE (HTML)
    if (file.name.endsWith(".html")) {
      const res = await fetch(file.url);
      const html = await res.text();

      const project = memory.projects[user.project];
      if (!project) return message.reply("⚠️ Set project first.");

      project.template = html;
      saveMemory();

      return message.reply("🧠 Template saved!");
    }
  }

  // ================= SET PROJECT =================
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

  // ================= PASTE TEMPLATE =================
  if (msg.includes("<!DOCTYPE html>")) {
    project.template = msg;
    saveMemory();
    return message.reply("🧠 Template learned.");
  }

  if (!project.template) {
    return message.reply("⚠️ Send HTML template first.");
  }

  // ================= GENERATE =================
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