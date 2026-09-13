--!strict
-- Roblox License & Whitelist System Configuration
-- Place this ModuleScript in ReplicatedStorage or ServerScriptService.

local LicenseConfig = {
	-- URL of your hosted backend server (e.g. "http://localhost:3000" or "https://your-domain.com")
	SERVER_URL = "http://localhost:3000",

	-- API Secret Key (Must match ROBLOX_API_SECRET in your backend .env file)
	API_SECRET = "your_secure_api_secret_here",

	-- Whitelist Settings
	REQUIRE_WHITELIST_TO_PLAY = false, -- If true, players without a valid license for MAIN_PRODUCT_ID will be kicked on join
	MAIN_PRODUCT_ID = "vip_pass", -- Product ID checked on player join if REQUIRE_WHITELIST_TO_PLAY is true
	KICK_MESSAGE = "❌ Access Denied: You do not hold a valid license to play this game. Purchase a license or redeem a key via our Discord server!",

	-- Mapping of Roblox Developer Product IDs or GamePass IDs to Backend Product IDs
	-- [RobloxID] = "backend_product_id"
	PRODUCT_MAPPING = {
		[123456789] = "vip_pass",
		[987654321] = "admin_commands_pass"
	}
}

return LicenseConfig
