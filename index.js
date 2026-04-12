require("dotenv").config();

const fs = require("fs");
const express = require("express");
const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

// ================= CRASH PROTECTION =================
process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 PROMISE ERROR:", err);
});

// ================= DEBUG =================
console.log("🚀 Starting Harry...");
console.log("🔍 Discord Token:", !!process.env.DISCORD_TOKEN);
console.log("🔍 OpenAI Key:", !!process.env.OPENAI_API_KEY);

// ================= EXPRESS =================
const app = express();

app.get("/", (req, res) => {
  res.send("🧙‍♂️ Harry is alive!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

client.once("ready", () => {
  console.log(`🔥 CONNECTED AS ${client.user.tag}`);
});

// ================= OPENAI =================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================= MEMORY =================
let memory = {};

if (fs.existsSync("memory.json")) {
  try {
    memory = JSON.parse(fs.readFileSync("memory.json"));
  } catch {
    memory = {};
  }
}

function saveMemory() {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

// ================= GOOGLE SEARCH =================
async function searchGoogle(query) {
  try {
    const res = await axios.post(
      "https://google.serper.dev/search",
      { q: query },
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const results = res.data.organic?.slice(0, 3) || [];

    return results.map(r => `${r.title}\n${r.snippet}`).join("\n\n");

  } catch (err) {
    console.error("Search error:", err);
    return "No live data found.";
  }
}

// ================= 🔒 TEMPLATE LOCK PROMPT =================
const SYSTEM_PROMPT = `
You are Harry, a STRICT HTML template editor.

🚨 ABSOLUTE RULES:
- NEVER change layout
- NEVER change spacing
- NEVER reformat HTML
- NEVER reorder anything
- NEVER improve or redesign

YOU MUST:
- ONLY replace text values
- KEEP ALL TAGS EXACT
- KEEP INDENTATION EXACT
- KEEP LINE BREAKS EXACT

OUTPUT:
- FULL HTML ONLY
- NO explanations
- NO markdown
- NO \`\`\`

If unsure → DO NOTHING to structure.
`;

// ================= MESSAGE =================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    console.log("📩 MESSAGE:", message.content);

    const userId = message.author.id;
    let msg = message.content.trim();
    const lower = msg.toLowerCase();

    // ================= READ ATTACHMENTS =================
    if (message.attachments.size > 0) {
      const file = message.attachments.first();

      if (file.name.endsWith(".html") || file.name.endsWith(".txt")) {
        const res = await axios.get(file.url);
        msg = res.data;
        console.log("📄 Loaded HTML from attachment");
      }
    }

    // INIT USER
    if (!memory[userId]) {
      memory[userId] = {
        projects: {},
        currentProject: null,
        instructions: ""
      };
    }

    const user = memory[userId];

    // ================= 🌐 INTERNET SEARCH =================
    const needsSearch =
      lower.includes("latest") ||
      lower.includes("today") ||
      lower.includes("news") ||
      lower.includes("current") ||
      lower.includes("weather") ||
      lower.includes("price");

    if (needsSearch) {
      const searchResult = await searchGoogle(msg);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Use real-time search results to answer naturally."
          },
          {
            role: "user",
            content: `
Question: ${msg}

Search Results:
${searchResult}
            `
          }
        ]
      });

      return message.reply(response.choices[0].message.content);
    }

    // ================= 📁 PROJECT =================
    if (lower.startsWith("project:")) {
      const projectName = msg.split(":")[1]?.trim().toLowerCase();

      user.currentProject = projectName;

      if (!user.projects[projectName]) {
        user.projects[projectName] = {
          template: null
        };
      }

      saveMemory();

      return message.reply(`📁 Project set to: ${projectName}`);
    }

    // ================= 💬 NORMAL CHAT =================
    if (!user.currentProject) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Harry, a friendly and smart assistant."
          },
          {
            role: "user",
            content: msg
          }
        ]
      });

      return message.reply(response.choices[0].message.content);
    }

    const project = user.projects[user.currentProject];

    // ================= 💾 SAVE TEMPLATE =================
    if (msg.trim().startsWith("<!DOCTYPE html>")) {
      project.template = msg;
      saveMemory();

      return message.reply("🧠 Template saved!");
    }

    if (!project.template) {
      return message.reply("⚠️ Send HTML template first.");
    }

    // ================= 📦 MULTI PART =================
    if (lower.includes("part")) {
      user.instructions += "\n" + msg;
      return message.reply("🧙 Waiting for next part...");
    }

    // ================= ⚡ GENERATE =================
    if (lower.includes("done") || lower.includes("generate")) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `
You MUST follow this template EXACTLY.

TEMPLATE:
${project.template}

ONLY replace values using:

${user.instructions}
            `
          }
        ]
      });

      user.instructions = "";

      return message.reply(response.choices[0].message.content);
    }

    // ================= 🔄 APPLY CHANGE =================
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `
You MUST follow this template EXACTLY.

TEMPLATE:
${project.template}

Change request:
${msg}
          `
        }
      ]
    });

    return message.reply(response.choices[0].message.content);

  } catch (error) {
    console.error("❌ ERROR:", error);
    return message.reply("⚠️ Something went wrong.");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);