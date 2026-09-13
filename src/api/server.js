const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../db/database');
const { getClient } = require('../bot/client');

function createApiServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static admin web panel
  app.use('/admin', express.static(path.join(__dirname, '../web/public')));
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/public/index.html'));
  });

  // Root URL Redirect to Admin Web Panel
  app.get('/', (req, res) => {
    res.redirect('/admin');
  });

  // Authorization Middleware
  const authMiddleware = (req, res, next) => {
    const apiSecret = process.env.ROBLOX_API_SECRET;
    if (!apiSecret || apiSecret === 'your_secure_api_secret_here') {
      return next();
    }

    const providedSecret = req.headers['x-api-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (providedSecret !== apiSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Secret header.' });
    }
    next();
  };

  // Health check
  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', service: 'Axis Core Retail Whitelist API & Web Panel', timestamp: new Date().toISOString() });
  });

  // Web Admin Panel Analytics & Stats Data Endpoint
  app.get('/api/v1/admin/stats', async (req, res) => {
    try {
      const analytics = await db.getAnalytics();
      const products = await db.getAllProducts();
      const pool = db.getPool();
      const wlRes = await pool.query(`SELECT * FROM whitelists ORDER BY created_at DESC LIMIT 50`);

      return res.json({
        success: true,
        analytics,
        products,
        whitelists: wlRes.rows
      });
    } catch (err) {
      console.error('[API Admin Stats Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin Grant Whitelist Endpoint (Web Panel)
  app.post('/api/v1/admin/whitelists/grant', async (req, res) => {
    try {
      const { productId, robloxUserId, discordUserId } = req.body;
      if (!productId || (!robloxUserId && !discordUserId)) {
        return res.status(400).json({ success: false, error: 'Missing productId and target user ID' });
      }

      const wl = await db.grantWhitelist({
        productId,
        robloxUserId: robloxUserId || null,
        discordUserId: discordUserId || null,
        grantedBy: 'WebAdminPanel'
      });

      return res.json({ success: true, whitelist: wl });
    } catch (err) {
      console.error('[API Admin Grant Error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Asset Whitelist Verification (Supports Place Creator / Group Owner checks)
  app.post('/api/v1/roblox/verify-asset', authMiddleware, async (req, res) => {
    try {
      const { creatorId, creatorType, productId, placeId } = req.body;

      if (!creatorId || !productId) {
        return res.status(400).json({ success: false, error: 'Missing creatorId and productId' });
      }

      const result = await db.checkWhitelist(productId, creatorId, null, placeId);
      const product = await db.getProduct(productId);

      return res.json({
        success: true,
        authorized: result.isWhitelisted,
        reason: result.reason || null,
        creatorId: String(creatorId),
        creatorType: creatorType || 'User',
        productId,
        productName: product ? product.name : productId
      });
    } catch (err) {
      console.error('[API Error /verify-asset]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Standard Verify Endpoint
  app.post('/api/v1/roblox/verify', authMiddleware, async (req, res) => {
    try {
      const { robloxUserId, productId, placeId } = req.body;

      if (!robloxUserId || !productId) {
        return res.status(400).json({ success: false, error: 'Missing robloxUserId and productId' });
      }

      const result = await db.checkWhitelist(productId, robloxUserId, null, placeId);
      const product = await db.getProduct(productId);

      return res.json({
        success: true,
        whitelisted: result.isWhitelisted,
        reason: result.reason || null,
        robloxUserId: String(robloxUserId),
        productId,
        productName: product ? product.name : productId
      });
    } catch (err) {
      console.error('[API Error /verify]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Process Roblox In-Game Asset Purchase
  app.post('/api/v1/roblox/purchase', authMiddleware, async (req, res) => {
    try {
      const { robloxUserId, productId, robloxUsername, placeId, purchaseId } = req.body;

      if (!robloxUserId || !productId) {
        return res.status(400).json({ success: false, error: 'Missing robloxUserId and productId' });
      }

      let product = await db.getProduct(productId);
      if (!product) {
        product = await db.createProduct(productId, `Asset ${productId}`, 'Axis Core Retail Asset');
      }

      const whitelist = await db.grantWhitelist({
        productId,
        robloxUserId,
        grantedBy: `roblox_asset_purchase:${purchaseId || placeId || 'in_game'}`
      });

      if (robloxUsername) {
        const existingBinding = await db.getBindingByRoblox(robloxUserId);
        if (existingBinding) {
          await db.bindAccount(existingBinding.discord_user_id, robloxUserId, robloxUsername);
        }
      }

      if (whitelist.discord_user_id && product.role_id) {
        const botClient = getClient();
        if (botClient && botClient.guilds.cache.size > 0) {
          const guildId = process.env.GUILD_ID;
          const guild = guildId ? botClient.guilds.cache.get(guildId) : botClient.guilds.cache.first();
          if (guild) {
            try {
              const member = await guild.members.fetch(whitelist.discord_user_id);
              const role = await guild.roles.fetch(product.role_id);
              if (member && role) {
                await member.roles.add(role);
                console.log(`[API] Assigned Discord role '${role.name}' to asset buyer ${member.user.tag}.`);
              }
            } catch (roleErr) {
              console.error('[API] Role sync error:', roleErr.message);
            }
          }
        }
      }

      return res.json({
        success: true,
        message: 'Asset whitelist granted successfully.',
        robloxUserId: String(robloxUserId),
        productId,
        whitelist
      });
    } catch (err) {
      console.error('[API Error /purchase]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return app;
}

module.exports = createApiServer;
