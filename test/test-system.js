require('dotenv').config();

const db = require('../src/db/database');
const createApiServer = require('../src/api/server');
const http = require('http');

async function testSystem() {
  console.log('--- Starting Verification Test Suite (Axis Core Retail Direct Whitelist System) ---');
  
  // 1. Test Database Init
  await db.initDatabase();

  // 2. Test Product Creation
  const prod = await db.createProduct('vip_pass', 'VIP Pass', 'Axis Core VIP Access', '999988887777', '123456789', 500, null);
  console.log('✅ Product created:', prod.id, prod.name);

  // 3. Test Account Binding
  const binding = await db.bindAccount('discord_user_123', '987654321', 'RobloxPlayerOne');
  console.log('✅ Account bound:', binding.discord_user_id, '->', binding.roblox_user_id);

  // 4. Test Direct Whitelist Granting
  const wl = await db.grantWhitelist({
    productId: 'vip_pass',
    discordUserId: 'discord_user_123',
    grantedBy: 'admin_test'
  });
  console.log('✅ Whitelist granted for user:', wl.discord_user_id || wl.roblox_user_id);

  // 5. Test Whitelist Verification
  const checkRes = await db.checkWhitelist('vip_pass', '987654321');
  console.log('✅ Whitelist check for Roblox ID 987654321:', checkRes);

  if (!checkRes.isWhitelisted) {
    throw new Error('Whitelist check expected to be true!');
  }

  // 6. Test Analytics & Audit Logs
  await db.logAudit('discord_user_123', 'test_action', 'System test audit log entry');
  const analytics = await db.getAnalytics();
  console.log('✅ Analytics summary:', analytics);

  // 7. Test Express API Server Verification Endpoint
  process.env.ROBLOX_API_SECRET = 'test_secret_123';
  const app = createApiServer();
  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`✅ Test server running on http://127.0.0.1:${port}`);

    const postData = JSON.stringify({
      robloxUserId: '987654321',
      productId: 'vip_pass'
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/v1/roblox/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': 'test_secret_123'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('✅ HTTP Verify Endpoint Response:', body);
        const parsed = JSON.parse(body);
        if (parsed.success && parsed.whitelisted) {
          console.log('🎉 ALL AXIS CORE RETAIL DIRECT WHITELIST TESTS PASSED!');
        } else {
          console.error('❌ HTTP verification test failed:', parsed);
        }
        server.close();
        process.exit(0);
      });
    });

    req.write(postData);
    req.end();
  });
}

testSystem().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
