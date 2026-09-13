const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { commands, handleInteraction } = require('./commands');

let client = null;

async function startBot(token, clientId, guildId) {
  if (!token || token === 'your_discord_bot_token_here') {
    console.warn('[Bot] DISCORD_TOKEN not configured in .env. Discord bot will not connect, but HTTP server can still run.');
    return null;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  // Register Slash Commands
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('[Bot] Refreshing application slash commands...');
    const body = commands.map(cmd => cmd.toJSON());

    if (guildId && guildId !== 'your_discord_guild_id_here') {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log(`[Bot] Successfully registered ${commands.length} guild slash commands.`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log(`[Bot] Successfully registered ${commands.length} global slash commands.`);
    }
  } catch (error) {
    console.error('[Bot] Error registering slash commands:', error);
  }

  client.on('ready', () => {
    console.log(`[Bot] Logged in as ${client.user.tag}! License Bot is active.`);
  });

  client.on('interactionCreate', async (interaction) => {
    await handleInteraction(interaction);
  });

  await client.login(token);
  return client;
}

function getClient() {
  return client;
}

module.exports = {
  startBot,
  getClient
};
