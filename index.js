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

// ================= EXPRESS =================
const app = express();

app.get("/", (req, res) => {
  res.send("🧙‍♂️ Harry is alive!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on ${PORT}`);
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

// ================= 🔒 TEMPLATE LOCK =================
const SYSTEM_PROMPT = `
You are Harry, a STRICT HTML template editor.

RULES:
- NEVER change layout
- NEVER change spacing
- NEVER reformat
- NEVER redesign

ONLY:
- Replace values
- Keep everything EXACT

OUTPUT:
- RAW HTML ONLY
- NO markdown
- NO explanations
`;

// ================= MESSAGE =================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    let msg = message.content.trim();
    const lower = msg.toLowerCase();

    console.log("📩", msg);

    // ================= READ ATTACHMENTS =================
    if (message.attachments.size > 0) {
      const file = message.attachments.first();

      if (file.name.endsWith(".html") || file.name.endsWith(".txt")) {
        const res = await axios.get(file.url);
        msg = res.data;
        console.log("📄 HTML loaded from attachment");
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

    // ================= 🌐 SEARCH =================
    const needsSearch =
      lower.includes("latest") ||
      lower.includes("today") ||
      lower.includes("news") ||
      lower.includes("weather") ||
      lower.includes("price");

    if (needsSearch) {
      const searchResult = await searchGoogle(msg);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Use search results to answer." },
          { role: "user", content: `${msg}\n\n${searchResult}` }
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

      if (user.projects[projectName].template) {
        return message.reply(
          `📁 Project: ${projectName}\n✅ Template loaded. Ready.`
        );
      } else {
        return message.reply(
          `📁 Project: ${projectName}\n⚠️ Send HTML template.`
        );
      }
    }

    // ================= NORMAL CHAT =================
    if (!user.currentProject) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Harry, a smart assistant." },
          { role: "user", content: msg }
        ]
      });

      return message.reply(response.choices[0].message.content);
    }

    const project = user.projects[user.currentProject];

    // ================= SAVE TEMPLATE =================
    if (msg.startsWith("<!DOCTYPE html>")) {
      project.template = msg;
      saveMemory();

      return message.reply("🧠 Template saved permanently!");
    }

    // ================= CHECK TEMPLATE =================
    if (!project.template) {
      return message.reply(
        `⚠️ No template saved for "${user.currentProject}".`
      );
    }

    // ================= MULTI PART =================
    if (lower.includes("part")) {
      user.instructions += "\n" + msg;
      return message.reply("🧙 Waiting...");
    }

    // ================= GENERATE =================
    if (lower.includes("generate") || lower.includes("done")) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `
TEMPLATE:
${project.template}

INSTRUCTIONS:
${user.instructions}
`
          }
        ]
      });

      user.instructions = "";

      return message.reply(response.choices[0].message.content);
    }

    // ================= APPLY CHANGE =================
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `
TEMPLATE:
${project.template}

CHANGE:
${msg}
`
        }
      ]
    });

    return message.reply(response.choices[0].message.content);

  } catch (err) {
    console.error("❌ ERROR:", err);
    return message.reply("⚠️ Error occurred.");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);