require("dotenv").config();

global.fetch = require("node-fetch");

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧠 Harry Team Mode Running"));
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
  projects: {},   // 🔥 shared templates
  users: {}       // 🔥 per-user project selection
};

if (fs.existsSync("memory.json")) {
  memory = JSON.parse(fs.readFileSync("memory.json"));
}

function saveMemory() {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🔥 Harry (TEAM MODE) is LIVE as ${client.user.tag}`);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  await message.react("👀");

  let typing = true;
  const typingInterval = setInterval(() => {
    if (typing) message.channel.sendTyping();
  }, 3000);

  try {
    const userId = message.author.id;
    const msg = message.content.trim();

    // INIT USER
    if (!memory.users[userId]) {
      memory.users[userId] = {
        currentProject: null
      };
    }

    const user = memory.users[userId];

    // ================= SET PROJECT =================
    if (msg.toLowerCase().startsWith("project:")) {
      const name = msg.split(":")[1]?.trim().toLowerCase();

      user.currentProject = name;

      if (!memory.projects[name]) {
        memory.projects[name] = {
          template: null
        };
      }

      saveMemory();

      typing = false;
      clearInterval(typingInterval);

      return message.reply(`📁 Project set to: ${name}`);
    }

    const project = memory.projects[user.currentProject];

    if (!project) {
      typing = false;
      clearInterval(typingInterval);
      return message.reply("⚠️ Set project first: project: name");
    }

    // ================= FILE TEMPLATE =================
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();

      if (attachment.name.endsWith(".html")) {
        const res = await fetch(attachment.url);
        const html = await res.text();

        project.template = html;
        saveMemory();

        typing = false;
        clearInterval(typingInterval);

        return message.reply(`🧠 Template saved for project: ${user.currentProject}`);
      }
    }

    // ================= PASTED TEMPLATE =================
    if (msg.includes("<!DOCTYPE html>")) {
      project.template = msg;
      saveMemory();

      typing = false;
      clearInterval(typingInterval);

      return message.reply(`🧠 Template updated for project: ${user.currentProject}`);
    }

    if (!project.template) {
      typing = false;
      clearInterval(typingInterval);
      return message.reply("⚠️ This project has no template yet.");
    }

    // ================= GENERATE =================
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are Harry, an HTML Wizard.

STRICT TEMPLATE MODE:

- Follow template EXACTLY
- Do NOT redesign
- Do NOT change layout
- Do NOT change spacing

ONLY replace values.

MULTI-ITEM:
Repeat item block only.

QR & PIN:
Only update if exists.

OUTPUT:
Full HTML only.
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

    let reply = response.choices?.[0]?.message?.content;

    // ================= SEND AS FILE =================
    fs.writeFileSync("output.html", reply);

    typing = false;
    clearInterval(typingInterval);

    return message.reply({
      content: `📄 Receipt generated for project: ${user.currentProject}`,
      files: ["output.html"]
    });

  } catch (error) {
    console.error(error);
    return message.reply("❌ Error occurred.");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);