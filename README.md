# Axis Core Retail — Direct Whitelist & Product Management System

A complete Whitelist Management System (Discord Bot + Express REST API) powered by **Supabase PostgreSQL** and integrated with **Roblox Studio Luau Scripts** for **Axis Core Retail**.

---

## 🌟 Features Overview

- **Direct Whitelist Architecture**:
  - No license keys required! Access is granted directly via Roblox purchases, `/whitelist-grant`, or Gifting.
  - Automatic whitelist checking on Roblox player join (`Players.PlayerAdded`).
  - Automatic Discord Role Synchronization when buying in Roblox or receiving a whitelist grant.

- **Discord Commands (`src/bot/commands.js`)**:
  - `/store`: Interactive product catalog with dropdown select menus.
  - `/bind-roblox`: Link Discord account to Roblox `UserId`.
  - `/my-whitelists`: View user's active product whitelists.
  - `/check-whitelist`: Check whitelist status for any Roblox ID or Discord user.
  - `/whitelist-gift`: Gift an owned whitelist to a friend.
  - `/whitelist-grant` *(Staff)*: Grant product whitelist (with optional duration/expiration).
  - `/whitelist-revoke` *(Staff)*: Revoke whitelist.
  - `/blacklist-add` *(Admin)*: Global ban across all products and Roblox games.
  - `/blacklist-remove` *(Admin)*: Remove global ban.
  - `/create-product` *(Admin)*: Register product (ID, Name, Description, Price in Robux, Role ID, Place Lock).
  - `/delete-product` *(Admin)*: Delete product.
  - `/analytics` *(Admin)*: View real-time whitelist metrics.
  - `/audit-logs` *(Admin)*: Inspect staff action audit logs.

- **Express REST API (`src/api/server.js`)**:
  - `POST /api/v1/roblox/verify`: Roblox server whitelist verification.
  - `POST /api/v1/roblox/purchase`: Real-time Roblox purchase webhook handler.

---

## 📂 Project Structure

```
roblox-license-bot/
├── roblox/
│   ├── LicenseConfig.luau              # Configuration module for Roblox Studio
│   └── RobloxLicenseSystem.server.luau # Luau server script with Discord Webhooks
├── src/
│   ├── api/
│   │   └── server.js                   # Express API server for Roblox requests
│   ├── bot/
│   │   ├── client.js                   # Discord Bot client & slash command registration
│   │   └── commands.js                 # Slash command definitions and handlers
│   ├── db/
│   │   └── database.js                 # PostgreSQL Supabase database queries
│   └── index.js                        # App entrypoint
├── .env.example
├── package.json
└── README.md
```

---

## 🚀 Quick Setup Guide

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure `.env`**:
   Ensure `DATABASE_URL` is set to your Supabase PostgreSQL connection string:
   ```env
   DATABASE_URL=postgresql://postgres:90uk7RbNgwcBPWwl@db.vfybcfhcfwefugiynmhg.supabase.co:5432/postgres
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_client_id_here
   GUILD_ID=your_discord_guild_id_here
   ROBLOX_API_SECRET=your_secure_api_secret_here
   PORT=3000
   ```

3. **Start Backend Server**:
   ```bash
   npm start
   ```
