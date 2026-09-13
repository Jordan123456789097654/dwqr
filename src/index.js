const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config();

const db = require('./db/database');
const createApiServer = require('./api/server');
const { startBot } = require('./bot/client');

async function main() {
  console.log('--------------------------------------------------');
  console.log('🚀 Starting Roblox License & Product Management System');
  console.log('--------------------------------------------------');

  // 1. Initialize Supabase PostgreSQL Database
  await db.initDatabase();

  // 2. Start Express API Server
  const PORT = process.env.PORT || 3000;
  const app = createApiServer();
  
  app.listen(PORT, () => {
    console.log(`[Express API] Server running on http://localhost:${PORT}`);
    console.log(`[Express API] Admin Web Panel:              http://localhost:${PORT}/admin`);
    console.log(`[Express API] Roblox Verification Endpoint: POST http://localhost:${PORT}/api/v1/roblox/verify`);
    console.log(`[Express API] Roblox Purchase Endpoint:     POST http://localhost:${PORT}/api/v1/roblox/purchase`);
  });

  // 3. Start Discord Bot Client
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (token && token !== 'your_discord_bot_token_here') {
    await startBot(token, clientId, guildId);
  } else {
    console.warn('[Notice] DISCORD_TOKEN is missing or default. Express API & Web Panel are running.');
  }
}

main().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
