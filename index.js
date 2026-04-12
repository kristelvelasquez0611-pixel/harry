const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Harry is alive 🧙‍♂️");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Web server running");
});

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Harry is alive 🧙‍♂️");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌐 Web server running");
});

require("dotenv").config();

const fs = require("fs");
const { Client, GatewayIntentBits } = require("discord.js");
const OpenAI = require("openai");

// ================= SETUP =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

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

// ================= READY =================
client.once("ready", () => {
  console.log(`🧙‍♂️ Harry is online as ${client.user.tag}`);
});

// ================= MAIN =================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    await message.channel.sendTyping();

    const userId = message.author.id;
    const msg = message.content.trim();
    const lower = msg.toLowerCase();

    // INIT USER
    if (!memory[userId]) {
      memory[userId] = {
        projects: {},
        currentProject: null
      };
    }

    const user = memory[userId];

    // ================= PROJECT SWITCH =================
    if (lower.startsWith("project:")) {
      const projectName = msg.split(":")[1]?.trim().toLowerCase();

      if (!projectName) {
        return message.reply("⚠️ Please provide a project name.");
      }

      user.currentProject = projectName;

      if (!user.projects[projectName]) {
        user.projects[projectName] = {
          template: "",
          rules: "",
          notes: ""
        };
      }

      saveMemory();

      return message.reply(`📁 Project set to: ${projectName}`);
    }

    const currentProject = user.currentProject;

    // ================= NO PROJECT =================
    if (!currentProject) {
      return message.reply("⚠️ Please set a project first using: project: name");
    }

    const project = user.projects[currentProject];

    // ================= SAVE RULES =================
    if (lower.startsWith("rules:")) {
      const rules = msg.replace(/rules:/i, "").trim();

      project.rules = rules;
      saveMemory();

      return message.reply(`📜 Rules saved for project: ${currentProject}`);
    }

    // ================= SAVE NOTES =================
    if (lower.startsWith("notes:")) {
      const notes = msg.replace(/notes:/i, "").trim();

      project.notes = notes;
      saveMemory();

      return message.reply(`🧠 Notes saved for project: ${currentProject}`);
    }

    // ================= SAVE TEMPLATE =================
    if (msg.startsWith("<!DOCTYPE html>")) {
      project.template = msg;
      saveMemory();

      return message.reply(`🧾 Template saved for project: ${currentProject}`);
    }

    // ================= NO TEMPLATE =================
    if (!project.template) {
      return message.reply("⚠️ No template saved yet. Please send HTML template first.");
    }

    // ================= AI GENERATION =================
    const response = await openai.responses.create({
      model: "gpt-5.3",
      input: [
        {
          role: "system",
          content: `
You are Harry, a master receipt wizard and expert HTML engineer.

CORE BEHAVIOR:
- You behave like ChatGPT (smart, helpful, conversational)
- You also specialize in receipt HTML generation

RECEIPT RULES (VERY STRICT):
- Output must look like a THERMAL RECEIPT
- Narrow width layout
- Clean spacing
- Proper alignment (left/right columns)
- Monospaced feel
- NEVER break structure

PROJECT MEMORY:
- Follow saved template EXACTLY
- Apply saved rules
- Apply saved notes

RESPONSE FORMAT:
1. First: short acknowledgement (1–2 lines)
2. Then: full HTML

STRICT RULES:
- DO NOT redesign layout
- DO NOT change structure
- ONLY modify values/content
- KEEP spacing EXACT

OUTPUT:
Acknowledgement + FULL HTML
`
        },
        {
          role: "user",
          content: `
PROJECT: ${currentProject}

RULES:
${project.rules || "None"}

NOTES:
${project.notes || "None"}

TEMPLATE:
${project.template}

USER REQUEST:
${msg}
`
        }
      ]
    });

    const reply = response.output_text || "No response.";

    fs.writeFileSync("output.html", reply);

    return message.reply({
      content: "🧙‍♂️ Receipt generated with your project memory.",
      files: ["output.html"]
    });

  } catch (error) {
    console.error("ERROR:", error);
    return message.reply("❌ Something went wrong.");
  }
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);
