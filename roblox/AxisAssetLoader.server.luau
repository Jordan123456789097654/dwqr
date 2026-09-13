--!strict
-- Axis Core Retail — Universal Asset Whitelist Loader
-- Put this Script inside any Model or Asset sold by Axis Core Retail

local HttpService = game:GetService("HttpService")

local CONFIG = {
	API_URL = "http://localhost:3000", -- Replace with your domain (e.g., https://api.axiscoreretail.com)
	API_SECRET = "your_secure_api_secret_here", -- Must match ROBLOX_API_SECRET in .env
	PRODUCT_ID = "vip_pass", -- Unique ID for this specific asset/product
	ASSET_NAME = "Axis Core Custom Asset System",
	DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE"
}

local function logDiscordSecurityAlert(authorized: boolean, creatorId: number, placeId: number)
	if not CONFIG.DISCORD_WEBHOOK_URL or CONFIG.DISCORD_WEBHOOK_URL:find("YOUR_WEBHOOK_URL") then return end

	local color = authorized and 0x2ECC71 or 0xEF4444
	local title = authorized and "✅ Asset Verification Passed — Axis Core Retail" or "🚨 Unauthorized Asset Usage Blocked — Axis Core Retail"
	
	local payload = HttpService:JSONEncode({
		username = "Axis Core Asset Security",
		embeds = {{
			title = title,
			color = color,
			fields = {
				{ name = "Asset / Product", value = "`" .. CONFIG.PRODUCT_ID .. "` (" .. CONFIG.ASSET_NAME .. ")", inline = false },
				{ name = "Place Creator ID", value = "`" .. tostring(creatorId) .. "`", inline = true },
				{ name = "Place ID", value = "`" .. tostring(placeId) .. "`", inline = true },
				{ name = "Status", value = authorized and "AUTHORIZED ✅" or "UNAUTHORIZED / LEAKED ❌", inline = true }
			},
			timestamp = DateTime.now():ToIsoDate()
		}}
	})

	pcall(function()
		HttpService:PostAsync(CONFIG.DISCORD_WEBHOOK_URL, payload, Enum.HttpContentType.ApplicationJson)
	end)
end

local function checkAssetWhitelist(): boolean
	local creatorId = game.CreatorId
	local placeId = game.PlaceId

	local url = CONFIG.API_URL .. "/api/v1/roblox/verify-asset"
	local body = HttpService:JSONEncode({
		creatorId = tostring(creatorId),
		creatorType = tostring(game.CreatorType),
		productId = CONFIG.PRODUCT_ID,
		placeId = placeId
	})

	local ok, res = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-api-secret"] = CONFIG.API_SECRET
			},
			Body = body
		})
	end)

	if ok and res and res.StatusCode == 200 then
		local decodeOk, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
		if decodeOk and data.success and data.authorized == true then
			logDiscordSecurityAlert(true, creatorId, placeId)
			return true
		end
	end

	logDiscordSecurityAlert(false, creatorId, placeId)
	return false
end

-- Initialize Asset
task.spawn(function()
	print("[Axis Core Retail] Verifying whitelist for " .. CONFIG.ASSET_NAME .. "...")
	local isAuthorized = checkAssetWhitelist()

	if isAuthorized then
		print("==================================================")
		print("⚡ " .. CONFIG.ASSET_NAME .. " Initialized Successfully!")
		print("⚡ Licensed to Place Creator ID: " .. tostring(game.CreatorId))
		print("==================================================")
		-- Core asset functionality runs here
	else
		warn("==================================================")
		warn("🚨 [AXIS CORE SECURITY] UNAUTHORIZED ASSET EXECUTION!")
		warn("🚨 Place Creator ID (" .. tostring(game.CreatorId) .. ") is not whitelisted for product: " .. CONFIG.PRODUCT_ID)
		warn("🚨 Purchase access from Axis Core Retail to use this asset.")
		warn("==================================================")

		-- Self-destruct asset to prevent unauthorized leaking
		if script.Parent then
			script.Parent:Destroy()
		end
	end
end)
