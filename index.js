require("dotenv").config();

global.fetch = require("node-fetch");

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const OpenAI = require("openai");

// ================= SERVER =================
const app = express();
app.get("/", (req, res) => res.send("🧠 Harry HTML Wizard Running"));
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
let memory = {};

if (fs.existsSync("memory.json")) {
  memory = JSON.parse(fs.readFileSync("memory.json"));
}

function saveMemory() {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

// ================= READY =================
client.once("ready", () => {
  console.log(`🔥 Harry is LIVE as ${client.user.tag}`);
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
    if (!memory[userId]) {
      memory[userId] = {
        projects: {},
        currentProject: null
      };
    }

    const user = memory[userId];

    // ================= PROJECT =================
    if (msg.toLowerCase().startsWith("project:")) {
      const name = msg.split(":")[1]?.trim().toLowerCase();

      user.currentProject = name;

      if (!user.projects[name]) {
        user.projects[name] = {
          template: null
        };
      }

      saveMemory();

      typing = false;
      clearInterval(typingInterval);

      return message.reply(`📁 Project set to: ${name}`);
    }

    const project = user.projects[user.currentProject];

    if (!project) {
      typing = false;
      clearInterval(typingInterval);
      return message.reply("⚠️ Set project first: project: name");
    }

    // ================= HANDLE FILE TEMPLATE =================
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();

      if (attachment.name.endsWith(".html")) {
        const res = await fetch(attachment.url);
        const html = await res.text();

        project.template = html;
        saveMemory();

        typing = false;
        clearInterval(typingInterval);

        return message.reply("🧠 Template saved permanently!");
      }
    }

    // ================= HANDLE PASTED HTML =================
    if (msg.includes("<!DOCTYPE html>")) {
      project.template = msg;
      saveMemory();

      typing = false;
      clearInterval(typingInterval);

      return message.reply("🧠 Template learned.");
    }

    if (!project.template) {
      typing = false;
      clearInterval(typingInterval);
      return message.reply("⚠️ Send HTML template first.");
    }

    // ================= HARRY HTML WIZARD =================
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are Harry, an HTML Wizard.

You operate in STRICT TEMPLATE LOCK MODE.

---

CORE RULE:

You are given a reference HTML template.

You MUST:
✔ Follow structure EXACTLY
✔ Follow spacing EXACTLY
✔ Follow alignment EXACTLY
✔ Follow layout EXACTLY

---

YOU MUST NOT:

❌ Add new sections
❌ Remove sections
❌ Redesign layout
❌ Change CSS
❌ Change spacing
❌ Convert structure (no tables unless template uses it)

---

DATA RULE:

✔ Replace ONLY data that exists in the template
✔ DO NOT add new fields
✔ DO NOT invent sections

---

PROJECT LOGIC:

✔ Each project has its own template
✔ ALWAYS follow that template only

---

QR RULE:

✔ ONLY update QR if it exists in template
✔ KEEP same placement and structure

---

PIN RULE:

✔ ONLY update PIN if it exists
✔ DO NOT add if missing

---

MULTI-ITEM RULE (ONLY EXCEPTION):

You are allowed to duplicate ONLY the item section.

Item section includes:
- item row
- item description
- tax row

If multiple items exist:
✔ Repeat SAME structure
✔ Keep spacing EXACT

DO NOT duplicate:
- header
- totals
- policy
- payment
- QR

---

OUTPUT:

✔ FULL HTML ONLY
✔ NO markdown
✔ NO explanation

---

FINAL BEHAVIOR:

Template = LAW
You ONLY inject data.
`
        },
        {
          role: "user",
          content: `
REFERENCE TEMPLATE:
${project.template}

---

GENERATE RECEIPT USING THIS DATA:
${msg}
`
        }
      ]
    });

    let reply = response.choices?.[0]?.message?.content;

    // ================= SAFE QR REPLACEMENT =================
    const qrMatch = msg.match(/\[QR\]\s*([\d\s]+)/);
    if (qrMatch && reply) {
      const qrValue = qrMatch[1].trim();

      reply = reply.replace(
        /https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=\d+x\d+&data=.*?/g,
        `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrValue}`
      );
    }

    typing = false;
    clearInterval(typingInterval);

    if (!reply) {
      return message.reply("⚠️ Failed to generate.");
    }

    return message.reply(reply);

  } catch (error) {
    console.error("❌ ERROR:", error);

    return message.reply("❌ Something went wrong.");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);