require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== MEMORY =====
let memory = {
  projects: {}, // shared templates
  users: {}     // per-user project
};

// ===== START =====
client.once("clientReady", () => {
  console.log("🔥 Harry is LIVE");
});

// ===== HELPER: GET USER PROJECT =====
function getUserProject(userId) {
  return memory.users[userId]?.project;
}

// ===== HELPER: SET PROJECT =====
function setUserProject(userId, project) {
  if (!memory.users[userId]) memory.users[userId] = {};
  memory.users[userId].project = project;
}

// ===== HELPER: EXTRACT DATA =====
function parseData(text) {
  const data = {};
  const lines = text.split("\n");

  lines.forEach(line => {
    const match = line.match(/^(.*?):\s*(.*)$/);
    if (match) {
      const key = match[1].trim().toUpperCase().replace(/\s+/g, "_");
      const value = match[2].trim();
      data[key] = value;
    }
  });

  return data;
}

// ===== HELPER: REPLACE VALUES =====
function applyTemplate(template, data) {
  let output = template;

  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, data[key]);
  });

  return output;
}

// ===== MAIN =====
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // 👀 react = seen
  await message.react("👀").catch(() => {});

  // ===== SET PROJECT =====
  if (content.toLowerCase().startsWith("project:")) {
    const project = content.split(":")[1].trim().toLowerCase();
    setUserProject(message.author.id, project);

    await message.reply(`📁 Project set to: ${project}`);
    return;
  }

  const project = getUserProject(message.author.id);

  if (!project) {
    await message.reply("⚠️ Set project first: `project: name`");
    return;
  }

  // ===== SAVE TEMPLATE =====
  if (message.attachments.size > 0) {
    const file = message.attachments.first();

    if (file.name.endsWith(".html")) {
      const res = await fetch(file.url);
      const html = await res.text();

      memory.projects[project] = html;

      await message.reply(`🧠 Template saved for: ${project}`);
      return;
    }
  }

  // ===== GENERATE (REPLACE ONLY) =====
  if (content.toLowerCase().includes("generate")) {

    const template = memory.projects[project];

    if (!template) {
      await message.reply("⚠️ No template saved.");
      return;
    }

    await message.channel.sendTyping();

    try {
      const data = parseData(content);
      const output = applyTemplate(template, data);

      fs.writeFileSync("output.html", output);

      await message.reply({
        content: `✅ Done (${project})`,
        files: ["output.html"]
      });

    } catch (err) {
      console.error(err);
      await message.reply("❌ Error processing template.");
    }

    return;
  }
});

// ===== LOGIN =====
client.login(process.env.DISCORD_TOKEN);