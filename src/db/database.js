const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:90uk7RbNgwcBPWwl@db.vfybcfhcfwefugiynmhg.supabase.co:5432/postgres';
    
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
      console.error('[DB Error] Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

// Database Schema Setup for Axis Core Retail Direct Whitelist System
async function initDatabase() {
  const db = getPool();

  // Products Table
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT 'Axis Core Retail Product',
      role_id VARCHAR(100),
      roblox_product_id VARCHAR(100),
      price_robux INTEGER DEFAULT 0,
      place_id_lock VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure columns exist on products
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT DEFAULT 'Axis Core Retail Product';`);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS price_robux INTEGER DEFAULT 0;`);
  await db.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS place_id_lock VARCHAR(100);`);

  // Discord <-> Roblox User Bindings
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_bindings (
      discord_user_id VARCHAR(100) PRIMARY KEY,
      roblox_user_id VARCHAR(100) NOT NULL UNIQUE,
      roblox_username VARCHAR(100),
      bound_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Direct Whitelists Table
  await db.query(`
    CREATE TABLE IF NOT EXISTS whitelists (
      id SERIAL PRIMARY KEY,
      product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      roblox_user_id VARCHAR(100),
      discord_user_id VARCHAR(100),
      granted_by VARCHAR(100) DEFAULT 'system',
      is_active BOOLEAN DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Global Blacklist Table
  await db.query(`
    CREATE TABLE IF NOT EXISTS blacklists (
      target_id VARCHAR(100) PRIMARY KEY,
      target_type VARCHAR(20) DEFAULT 'user',
      reason TEXT NOT NULL,
      blacklisted_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Audit Logs Table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      staff_id VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[PostgreSQL DB] Axis Core Retail Direct Whitelist schema initialized successfully.');
}

const dbService = {
  initDatabase,
  getPool,

  // Products
  async createProduct(id, name, description = 'Axis Core Product', roleId = null, robloxProductId = null, priceRobux = 0, placeIdLock = null) {
    const db = getPool();
    const res = await db.query(
      `INSERT INTO products (id, name, description, role_id, roblox_product_id, price_robux, place_id_lock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name, 
         description = EXCLUDED.description,
         role_id = EXCLUDED.role_id, 
         roblox_product_id = EXCLUDED.roblox_product_id,
         price_robux = EXCLUDED.price_robux,
         place_id_lock = EXCLUDED.place_id_lock
       RETURNING *`,
      [id, name, description, roleId, robloxProductId, priceRobux, placeIdLock]
    );
    return res.rows[0];
  },

  async updateProduct(id, name, description, roleId, robloxProductId, priceRobux, placeIdLock) {
    const db = getPool();
    const res = await db.query(
      `UPDATE products SET name = $2, description = $3, role_id = $4, roblox_product_id = $5, price_robux = $6, place_id_lock = $7 WHERE id = $1 RETURNING *`,
      [id, name, description, roleId, robloxProductId, priceRobux, placeIdLock]
    );
    return res.rows[0];
  },

  async deleteProduct(id) {
    const db = getPool();
    const res = await db.query(`DELETE FROM products WHERE id = $1 RETURNING *`, [id]);
    return res.rowCount > 0;
  },

  async getProduct(id) {
    const db = getPool();
    const res = await db.query(`SELECT * FROM products WHERE id = $1 OR roblox_product_id = $1`, [id]);
    return res.rows[0];
  },

  async getAllProducts() {
    const db = getPool();
    const res = await db.query(`SELECT * FROM products ORDER BY name ASC`);
    return res.rows;
  },

  // User Bindings
  async bindAccount(discordUserId, robloxUserId, robloxUsername = null) {
    const db = getPool();
    const res = await db.query(
      `INSERT INTO user_bindings (discord_user_id, roblox_user_id, roblox_username)
       VALUES ($1, $2, $3)
       ON CONFLICT (discord_user_id) DO UPDATE SET roblox_user_id = EXCLUDED.roblox_user_id, roblox_username = EXCLUDED.roblox_username
       RETURNING *`,
      [discordUserId, String(robloxUserId), robloxUsername]
    );
    return res.rows[0];
  },

  async getBindingByDiscord(discordUserId) {
    const db = getPool();
    const res = await db.query(`SELECT * FROM user_bindings WHERE discord_user_id = $1`, [discordUserId]);
    return res.rows[0];
  },

  async getBindingByRoblox(robloxUserId) {
    const db = getPool();
    const res = await db.query(`SELECT * FROM user_bindings WHERE roblox_user_id = $1`, [String(robloxUserId)]);
    return res.rows[0];
  },

  // Whitelist Management
  async grantWhitelist({ productId, robloxUserId = null, discordUserId = null, grantedBy = 'system', expiresAt = null }) {
    const db = getPool();

    // Check if target is blacklisted
    if (robloxUserId && await this.isBlacklisted(robloxUserId)) {
      throw new Error(`Target Roblox ID ${robloxUserId} is globally blacklisted.`);
    }
    if (discordUserId && await this.isBlacklisted(discordUserId)) {
      throw new Error(`Target Discord User ${discordUserId} is globally blacklisted.`);
    }

    // Resolve bindings
    if (discordUserId && !robloxUserId) {
      const binding = await this.getBindingByDiscord(discordUserId);
      if (binding) robloxUserId = binding.roblox_user_id;
    }
    if (robloxUserId && !discordUserId) {
      const binding = await this.getBindingByRoblox(robloxUserId);
      if (binding) discordUserId = binding.discord_user_id;
    }

    // Check existing active whitelist
    let existingRes;
    if (robloxUserId) {
      existingRes = await db.query(`SELECT * FROM whitelists WHERE product_id = $1 AND roblox_user_id = $2 AND is_active = TRUE`, [productId, String(robloxUserId)]);
    } else if (discordUserId) {
      existingRes = await db.query(`SELECT * FROM whitelists WHERE product_id = $1 AND discord_user_id = $2 AND is_active = TRUE`, [productId, discordUserId]);
    }

    if (existingRes && existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (discordUserId && !existing.discord_user_id) {
        await db.query(`UPDATE whitelists SET discord_user_id = $1 WHERE id = $2`, [discordUserId, existing.id]);
      }
      if (robloxUserId && !existing.roblox_user_id) {
        await db.query(`UPDATE whitelists SET roblox_user_id = $1 WHERE id = $2`, [String(robloxUserId), existing.id]);
      }
      return { ...existing, updated: true };
    }

    const insertRes = await db.query(
      `INSERT INTO whitelists (product_id, roblox_user_id, discord_user_id, granted_by, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [productId, robloxUserId ? String(robloxUserId) : null, discordUserId || null, grantedBy, expiresAt]
    );

    return insertRes.rows[0];
  },

  async revokeWhitelist(productId, targetIdentifier) {
    const db = getPool();
    const res = await db.query(
      `UPDATE whitelists SET is_active = FALSE WHERE product_id = $1 AND (roblox_user_id = $2 OR discord_user_id = $3)`,
      [productId, String(targetIdentifier), String(targetIdentifier)]
    );
    return res.rowCount > 0;
  },

  async checkWhitelist(productId, robloxUserId = null, discordUserId = null, placeId = null) {
    const db = getPool();

    // Check global blacklist
    if (robloxUserId && await this.isBlacklisted(robloxUserId)) return { isWhitelisted: false, reason: 'User is globally blacklisted.' };
    if (discordUserId && await this.isBlacklisted(discordUserId)) return { isWhitelisted: false, reason: 'User is globally blacklisted.' };

    // Check Place Lock if placeId provided
    if (placeId) {
      const product = await this.getProduct(productId);
      if (product && product.place_id_lock && product.place_id_lock !== String(placeId)) {
        return { isWhitelisted: false, reason: `Place ID ${placeId} is not authorized for product ${productId}.` };
      }
    }

    // Direct check
    let sql = `SELECT * FROM whitelists WHERE product_id = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) AND (`;
    const params = [productId];
    const clauses = [];

    if (robloxUserId) {
      params.push(String(robloxUserId));
      clauses.push(`roblox_user_id = $${params.length}`);
    }
    if (discordUserId) {
      params.push(discordUserId);
      clauses.push(`discord_user_id = $${params.length}`);
    }
    sql += clauses.join(' OR ') + `)`;

    const directRes = await db.query(sql, params);
    if (directRes.rows.length > 0) return { isWhitelisted: true, whitelist: directRes.rows[0] };

    // Check via bindings
    if (discordUserId && !robloxUserId) {
      const binding = await this.getBindingByDiscord(discordUserId);
      if (binding) {
        const bindRes = await db.query(
          `SELECT * FROM whitelists WHERE product_id = $1 AND roblox_user_id = $2 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
          [productId, binding.roblox_user_id]
        );
        if (bindRes.rows.length > 0) return { isWhitelisted: true, whitelist: bindRes.rows[0] };
      }
    }

    if (robloxUserId && !discordUserId) {
      const binding = await this.getBindingByRoblox(robloxUserId);
      if (binding) {
        const bindRes = await db.query(
          `SELECT * FROM whitelists WHERE product_id = $1 AND discord_user_id = $2 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
          [productId, binding.discord_user_id]
        );
        if (bindRes.rows.length > 0) return { isWhitelisted: true, whitelist: bindRes.rows[0] };
      }
    }

    return { isWhitelisted: false, reason: 'No active whitelist found.' };
  },

  async getUserWhitelists(discordUserId = null, robloxUserId = null) {
    const db = getPool();
    let sql = `
      SELECT w.*, p.name as product_name, p.description, p.role_id, p.roblox_product_id
      FROM whitelists w
      JOIN products p ON w.product_id = p.id
      WHERE w.is_active = TRUE AND (w.expires_at IS NULL OR w.expires_at > CURRENT_TIMESTAMP) AND (`;
    const params = [];
    const clauses = [];

    if (discordUserId) {
      params.push(discordUserId);
      clauses.push(`w.discord_user_id = $${params.length}`);
    }
    if (robloxUserId) {
      params.push(String(robloxUserId));
      clauses.push(`w.roblox_user_id = $${params.length}`);
    }

    if (clauses.length === 0) return [];
    sql += clauses.join(' OR ') + `)`;

    const res = await db.query(sql, params);
    return res.rows;
  },

  // Blacklist
  async blacklistUser(targetId, reason, staffId) {
    const db = getPool();
    const res = await db.query(
      `INSERT INTO blacklists (target_id, reason, blacklisted_by) VALUES ($1, $2, $3)
       ON CONFLICT (target_id) DO UPDATE SET reason = EXCLUDED.reason, blacklisted_by = EXCLUDED.blacklisted_by
       RETURNING *`,
      [String(targetId), reason, staffId]
    );

    // Deactivate all active whitelists for this target
    await db.query(`UPDATE whitelists SET is_active = FALSE WHERE roblox_user_id = $1 OR discord_user_id = $1`, [String(targetId)]);

    return res.rows[0];
  },

  async unblacklistUser(targetId) {
    const db = getPool();
    const res = await db.query(`DELETE FROM blacklists WHERE target_id = $1 RETURNING *`, [String(targetId)]);
    return res.rowCount > 0;
  },

  async isBlacklisted(targetId) {
    const db = getPool();
    const res = await db.query(`SELECT * FROM blacklists WHERE target_id = $1`, [String(targetId)]);
    return res.rows.length > 0;
  },

  // Audit Logs
  async logAudit(staffId, action, details) {
    const db = getPool();
    await db.query(`INSERT INTO audit_logs (staff_id, action, details) VALUES ($1, $2, $3)`, [staffId, action, details]);
  },

  async getAuditLogs(limit = 20) {
    const db = getPool();
    const res = await db.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
    return res.rows;
  },

  // Analytics
  async getAnalytics() {
    const db = getPool();
    const prodCount = await db.query(`SELECT COUNT(*) FROM products`);
    const whitelistCount = await db.query(`SELECT COUNT(*) FROM whitelists WHERE is_active = TRUE`);
    const bindingCount = await db.query(`SELECT COUNT(*) FROM user_bindings`);
    const blacklistCount = await db.query(`SELECT COUNT(*) FROM blacklists`);

    return {
      totalProducts: parseInt(prodCount.rows[0].count, 10),
      activeWhitelists: parseInt(whitelistCount.rows[0].count, 10),
      linkedAccounts: parseInt(bindingCount.rows[0].count, 10),
      blacklistedUsers: parseInt(blacklistCount.rows[0].count, 10)
    };
  }
};

module.exports = dbService;
