require("dotenv").config();

const OWNER_ID = "1133386291858382939";

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
  return "~" + (position * 10) + " seconds";
}

// ================= QUEUE =================
let queue = [];
let isProcessing = false;

async function updateQueueUI() {
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const pos = i + 1;
    const eta = getETA(pos);

    let text =
  "⏳ Queue position: #" +
  pos +
  "\n⏱ ETA: " +
  eta;

    if (pos === 1) text += "\n🟡 You are next...";
    else text += "\n⬆️ Moving up...";

    try {
      await job.statusMsg.edit(
  "👀 Got your request!\n" + text
);
    } catch {}
  }
}

// ================= PROCESS =================
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const job = queue.shift();
  const { message, project, msg, statusMsg } = job;

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

    const fileName =
  "output_" + Date.now() + ".html";
    fs.writeFileSync(fileName, html);

    await statusMsg.edit({
      content: "✅ Generation complete",

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
  console.log(
  "Harry logged in: " + client.user.tag
);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  const channel = message.channel.name;

  const allowed =
  channel.startsWith("harry-receipt-") ||
  channel === "hogwarts-battlefield";

if (!allowed) return;

if (!message.mentions.has(client.user.id)) return;

  let msg = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  const userId = message.author.id;

if (!memory.users[userId]) {
  memory.users[userId] = {
    project: null
  };
}
if (msg.toLowerCase().startsWith("project:")) {

  const name = msg
    .split(":")[1]
    ?.trim()
    .toLowerCase();

  if (!memory.projects[name]) {
    return message.reply("❌ Project not found.");
  }

  memory.users[userId].project = name;

  saveMemory();

  return message.reply(
  "👀 Project set to: " + name
);
}
  // ================= TXT FILE READER =================
  if (message.attachments.size > 0) {
    const file = message.attachments.first();

    // 👉 READ TXT FILE
    if (file.name.endsWith(".txt")) {
      try {
        const res = await fetch(file.url);
        const text = await res.text();

        msg += "\n" + text;
        await message.reply("📄 TXT file loaded!");
      } catch (err) {
        console.error(err);
        return message.reply("❌ Failed to read TXT file.");
      }
    }

}

  // ================= SET PROJECT =================
if (msg.toLowerCase().startsWith("train project:")) {

  if (message.channel.name !== "hogwarts-battlefield") {
    return;
  }

  if (message.author.id !== OWNER_ID) {
    return message.reply("❌ Only owner can train.");
  }

  const name = msg
    .split(":")[1]
    ?.trim()
    .toLowerCase();

  memory.projects[name] = {
    template: null
  };

  memory.users[userId].project = name;

  saveMemory();

  return message.reply(
  "🧠 Training started for: " + name
);
}
  // ================= PASTE TEMPLATE =================
if (msg.includes("<html")) {

  if (message.author.id !== OWNER_ID) {
    return;
  }

  const projectName =
    memory.users[userId]?.project;

  if (!projectName) {
    return message.reply("⚠️ No active project.");
  }

  memory.projects[projectName].template = msg;

  saveMemory();

  return message.reply(
    "🧠 Template saved for: " + projectName
  );
}
  // ================= GENERATE =================
  if (msg.toLowerCase().includes("generate")) {

    const position = queue.length + 1;
    const eta = getETA(position);

    const statusMsg = await message.reply(
  "👀 Got your request!\n⏳ Queue position: #" +
  position +
  "\n⏱ ETA: " +
  eta
);

    const projectName =
  memory.users[userId]?.project;

if (!projectName) {
  return message.reply(
    "⚠️ Please set project first."
  );
}

const project =
  memory.projects[projectName];

if (!project?.template) {
  return message.reply(
    "❌ Template not found."
  );
}
    queue.push({
  message,
  project,
  msg,
  statusMsg
});

    updateQueueUI();
    processQueue();
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);