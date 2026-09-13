--!strict
-- Roblox ServerScript for Roblox ServerScriptService
-- Integrates MarketplaceService and HttpService with the Discord Bot Backend

local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local LicenseConfig = require(script.Parent:WaitForChild("LicenseConfig"))

local RobloxLicenseSystem = {}

-- Helper function for authenticated HTTP requests to the backend server
local function sendApiRequest(endpoint: string, data: table)
	local url = LicenseConfig.SERVER_URL .. endpoint
	local jsonData = HttpService:JSONEncode(data)

	local success, response = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
				["x-api-secret"] = LicenseConfig.API_SECRET
			},
			Body = jsonData
		})
	end)

	if success and response.StatusCode == 200 then
		local decodeSuccess, decoded = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if decodeSuccess then
			return true, decoded
		end
	end

	warn("[LicenseSystem] HTTP Request to " .. endpoint .. " failed. Status: " .. tostring(response and response.StatusCode or "Error"))
	return false, nil
end

-- Check if a Roblox UserId holds a license for a given Product ID
function RobloxLicenseSystem:VerifyLicense(userId: number, productId: string): boolean
	local ok, data = sendApiRequest("/api/v1/roblox/verify", {
		robloxUserId = tostring(userId),
		productId = productId
	})

	if ok and data then
		return data.licensed == true
	end
	return false
end

-- Process Developer Product Purchases (MarketplaceService.ProcessReceipt)
local function processReceipt(receiptInfo)
	local userId = receiptInfo.PlayerId
	local robloxProductId = receiptInfo.ProductId
	local purchaseId = receiptInfo.PurchaseId

	local mappedProductId = LicenseConfig.PRODUCT_MAPPING[robloxProductId] or tostring(robloxProductId)

	print("[LicenseSystem] Processing receipt for User " .. tostring(userId) .. " - Product: " .. mappedProductId)

	local player = Players:GetPlayerByUserId(userId)
	local robloxUsername = player and player.Name or nil

	local ok, res = sendApiRequest("/api/v1/roblox/purchase", {
		robloxUserId = tostring(userId),
		productId = mappedProductId,
		robloxUsername = robloxUsername,
		placeId = game.PlaceId,
		purchaseId = purchaseId
	})

	if ok and res and res.success then
		print("[LicenseSystem] License granted successfully for User " .. tostring(userId))
		return Enum.ProductPurchaseDecision.PurchaseGranted
	else
		warn("[LicenseSystem] Failed to register license on backend for User " .. tostring(userId))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
end

MarketplaceService.ProcessReceipt = processReceipt

-- Handle GamePass Purchases
MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, gamePassId, wasPurchased)
	if wasPurchased and player then
		local mappedProductId = LicenseConfig.PRODUCT_MAPPING[gamePassId] or tostring(gamePassId)
		print("[LicenseSystem] GamePass purchased: " .. mappedProductId .. " by " .. player.Name)

		sendApiRequest("/api/v1/roblox/purchase", {
			robloxUserId = tostring(player.UserId),
			productId = mappedProductId,
			robloxUsername = player.Name,
			placeId = game.PlaceId
		})
	end
end)

-- Player Join Whitelist Verification
Players.PlayerAdded:Connect(function(player)
	if LicenseConfig.REQUIRE_WHITELIST_TO_PLAY then
		local isLicensed = RobloxLicenseSystem:VerifyLicense(player.UserId, LicenseConfig.MAIN_PRODUCT_ID)
		if not isLicensed then
			warn("[LicenseSystem] Kicking non-whitelisted user: " .. player.Name .. " (" .. tostring(player.UserId) .. ")")
			player:Kick(LicenseConfig.KICK_MESSAGE)
		else
			print("[LicenseSystem] Whitelist check passed for " .. player.Name)
		end
	end
end)

return RobloxLicenseSystem
