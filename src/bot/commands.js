const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const db = require('../db/database');

const commands = [
  // User Commands
  new SlashCommandBuilder()
    .setName('bind-roblox')
    .setDescription('Link your Roblox account with your Discord profile.')
    .addStringOption(opt =>
      opt.setName('roblox-userid')
         .setDescription('Your numerical Roblox UserId (e.g. 12345678)')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('roblox-username')
         .setDescription('Your Roblox Username (Optional)')
         .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('my-whitelists')
    .setDescription('View all active Axis Core Retail product whitelists linked to your account.'),

  new SlashCommandBuilder()
    .setName('store')
    .setDescription('Browse Axis Core Retail products and active shop catalog.'),

  new SlashCommandBuilder()
    .setName('check-whitelist')
    .setDescription('Check if a user or Roblox ID holds an active product whitelist.')
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('The Product ID to check')
         .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('discord-user')
         .setDescription('Discord user to check')
         .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('roblox-userid')
         .setDescription('Roblox UserId to check')
         .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('whitelist-gift')
    .setDescription('Gift one of your product whitelists to a friend.')
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('Product ID to gift')
         .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('recipient-discord')
         .setDescription('Discord User receiving the whitelist')
         .setRequired(true)
    ),

  // ADMIN / STAFF COMMANDS

  new SlashCommandBuilder()
    .setName('whitelist-grant')
    .setDescription('[Staff] Grant a product whitelist to a Discord user or Roblox User ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('The Product ID')
         .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('discord-user')
         .setDescription('Target Discord User')
         .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('roblox-userid')
         .setDescription('Target Roblox UserId')
         .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('duration-days')
         .setDescription('Whitelist duration in days (leave empty for lifetime)')
         .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('whitelist-revoke')
    .setDescription('[Staff] Revoke a product whitelist.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('The Product ID')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('target')
         .setDescription('Discord User ID or Roblox User ID')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('blacklist-add')
    .setDescription('[Admin] Ban a user globally from all Axis Core Retail products and Roblox places.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('target-id')
         .setDescription('Discord User ID or Roblox User ID')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
         .setDescription('Reason for global blacklist')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('blacklist-remove')
    .setDescription('[Admin] Unban a user from the global blacklist.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('target-id')
         .setDescription('Discord User ID or Roblox User ID')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('create-product')
    .setDescription('[Admin] Register a new Axis Core Retail product.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('Unique Product ID (e.g. vip_pass, admin_panel)')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('name')
         .setDescription('Display Name of the Product')
         .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('description')
         .setDescription('Product description')
         .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role')
         .setDescription('Discord Role to grant on whitelist')
         .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('roblox-product-id')
         .setDescription('Roblox Developer Product / GamePass ID')
         .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('price-robux')
         .setDescription('Price in Robux')
         .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('place-id-lock')
         .setDescription('Restrict whitelist execution to a specific Place ID')
         .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('delete-product')
    .setDescription('[Admin] Delete an Axis Core Retail product.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('product-id')
         .setDescription('The Product ID to delete')
         .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('[Admin] View Axis Core Retail whitelist and customer analytics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('audit-logs')
    .setDescription('[Admin] View recent staff administrative action logs.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

  const { user, guild, member } = interaction;

  try {
    // Select Menu Interaction (/store product details)
    if (interaction.isStringSelectMenu() && interaction.customId === 'store_product_select') {
      const selectedProductId = interaction.values[0];
      const product = await db.getProduct(selectedProductId);

      if (!product) {
        return interaction.reply({ content: '❌ Selected product not found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📦 ${product.name} (ID: \`${product.id}\`)`)
        .setColor(0x00D2FF)
        .setDescription(product.description || 'No description provided.')
        .addFields(
          { name: 'Price', value: product.price_robux ? `\`${product.price_robux} R$\`` : 'Free / Custom', inline: true },
          { name: 'Roblox DevProduct ID', value: product.roblox_product_id ? `\`${product.roblox_product_id}\`` : 'Not configured', inline: true },
          { name: 'Linked Discord Role', value: product.role_id ? `<@&${product.role_id}>` : 'None', inline: true },
          { name: 'Place Lock', value: product.place_id_lock ? `\`${product.place_id_lock}\`` : 'Global / Unlocked', inline: true }
        )
        .setFooter({ text: 'Axis Core Retail — Whitelist Management System' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const { commandName, options } = interaction;

    // /bind-roblox
    if (commandName === 'bind-roblox') {
      const robloxUserId = options.getString('roblox-userid');
      const robloxUsername = options.getString('roblox-username') || null;

      if (!/^\d+$/.test(robloxUserId)) {
        return interaction.reply({ content: '❌ Roblox UserId must be a numeric ID.', ephemeral: true });
      }

      await db.bindAccount(user.id, robloxUserId, robloxUsername);
      await db.logAudit(user.id, 'bind_roblox', `Linked Discord user ${user.id} to Roblox ID ${robloxUserId}`);

      const embed = new EmbedBuilder()
        .setTitle('✅ Axis Core Account Linked')
        .setColor(0x2ECC71)
        .addFields(
          { name: 'Discord Profile', value: `<@${user.id}>`, inline: true },
          { name: 'Roblox UserId', value: `\`${robloxUserId}\``, inline: true },
          { name: 'Roblox Username', value: `${robloxUsername || 'N/A'}`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /my-whitelists
    if (commandName === 'my-whitelists') {
      const binding = await db.getBindingByDiscord(user.id);
      const whitelists = await db.getUserWhitelists(user.id, binding ? binding.roblox_user_id : null);

      const embed = new EmbedBuilder()
        .setTitle(`📜 Axis Core Whitelists — ${user.username}`)
        .setColor(0x00D2FF)
        .setTimestamp();

      if (binding) {
        embed.setDescription(`Linked Roblox Account: **${binding.roblox_username || binding.roblox_user_id}** (ID: \`${binding.roblox_user_id}\`)`);
      } else {
        embed.setDescription('💡 *Link your Roblox account using `/bind-roblox` to sync in-game Roblox purchases automatically!*');
      }

      if (whitelists.length === 0) {
        embed.addFields({ name: 'No Active Whitelists', value: 'You currently do not hold any active product whitelists.' });
      } else {
        whitelists.forEach(w => {
          embed.addFields({
            name: `✅ ${w.product_name} (\`${w.product_id}\`)`,
            value: `Granted By: \`${w.granted_by}\` | Expires: ${w.expires_at ? `<t:${Math.floor(new Date(w.expires_at).getTime() / 1000)}:R>` : '**Never (Lifetime)**'}`,
            inline: false
          });
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /store
    if (commandName === 'store') {
      const products = await db.getAllProducts();

      const embed = new EmbedBuilder()
        .setTitle('🛒 Axis Core Retail Catalog')
        .setColor(0x00D2FF)
        .setDescription('Select a product from the dropdown menu below to view full details and purchase options.')
        .setTimestamp();

      if (products.length === 0) {
        embed.addFields({ name: 'No Products', value: 'No products registered in the store catalog yet.' });
        return interaction.reply({ embeds: [embed] });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('store_product_select')
        .setPlaceholder('Choose a product to inspect...')
        .addOptions(
          products.map(p => ({
            label: p.name,
            description: p.description ? p.description.substring(0, 50) : `ID: ${p.id}`,
            value: p.id
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // /check-whitelist
    if (commandName === 'check-whitelist') {
      const productId = options.getString('product-id');
      const discordTarget = options.getUser('discord-user');
      const robloxTarget = options.getString('roblox-userid');

      if (!discordTarget && !robloxTarget) {
        return interaction.reply({ content: '❌ Provide either a Discord user or Roblox UserId to check.', ephemeral: true });
      }

      const res = await db.checkWhitelist(
        productId,
        robloxTarget || null,
        discordTarget ? discordTarget.id : null
      );

      const targetLabel = discordTarget ? `<@${discordTarget.id}>` : `Roblox ID \`${robloxTarget}\``;

      const embed = new EmbedBuilder()
        .setTitle('🔍 Whitelist Status Check')
        .setColor(res.isWhitelisted ? 0x2ECC71 : 0xE74C3C)
        .addFields(
          { name: 'Target', value: targetLabel, inline: true },
          { name: 'Product ID', value: `\`${productId}\``, inline: true },
          { name: 'Status', value: res.isWhitelisted ? '✅ **WHITELISTED**' : `❌ **NOT WHITELISTED** (${res.reason || 'None'})`, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // STAFF: /whitelist-grant
    if (commandName === 'whitelist-grant') {
      const productId = options.getString('product-id');
      const discordUser = options.getUser('discord-user');
      const robloxUserId = options.getString('roblox-userid');
      const durationDays = options.getInteger('duration-days');

      if (!discordUser && !robloxUserId) {
        return interaction.reply({ content: '❌ Specify either a Discord user or Roblox UserId.', ephemeral: true });
      }

      const product = await db.getProduct(productId);
      if (!product) {
        return interaction.reply({ content: `❌ Product \`${productId}\` does not exist.`, ephemeral: true });
      }

      let expiresAt = null;
      if (durationDays && durationDays > 0) {
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const wl = await db.grantWhitelist({
        productId,
        discordUserId: discordUser ? discordUser.id : null,
        robloxUserId: robloxUserId || null,
        grantedBy: `Staff:${user.username}`,
        expiresAt
      });

      await db.logAudit(user.id, 'grant_whitelist', `Granted ${productId} to Discord:${discordUser?.id} Roblox:${robloxUserId}`);

      if (discordUser && product.role_id && guild) {
        try {
          const targetMember = await guild.members.fetch(discordUser.id);
          const role = await guild.roles.fetch(product.role_id);
          if (targetMember && role) await targetMember.roles.add(role);
        } catch (err) {
          console.error('[Bot] Role grant warning:', err.message);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('👑 [Axis Staff] Whitelist Granted')
        .setColor(0x2ECC71)
        .addFields(
          { name: 'Product', value: `**${product.name}** (\`${productId}\`)`, inline: false },
          { name: 'Discord User', value: discordUser ? `<@${discordUser.id}>` : 'None', inline: true },
          { name: 'Roblox UserId', value: robloxUserId ? `\`${robloxUserId}\`` : 'None', inline: true },
          { name: 'Duration', value: durationDays ? `${durationDays} Days` : '**Lifetime**', inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // STAFF: /whitelist-revoke
    if (commandName === 'whitelist-revoke') {
      const productId = options.getString('product-id');
      const target = options.getString('target');

      const success = await db.revokeWhitelist(productId, target);
      if (!success) {
        return interaction.reply({ content: `❌ No active whitelist found for product \`${productId}\` matching \`${target}\`.`, ephemeral: true });
      }

      await db.logAudit(user.id, 'revoke_whitelist', `Revoked ${productId} from ${target}`);

      const embed = new EmbedBuilder()
        .setTitle('👑 [Axis Staff] Whitelist Revoked')
        .setColor(0xE74C3C)
        .setDescription(`Revoked product \`${productId}\` whitelist from target \`${target}\`.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ADMIN: /blacklist-add
    if (commandName === 'blacklist-add') {
      const targetId = options.getString('target-id');
      const reason = options.getString('reason');

      await db.blacklistUser(targetId, reason, user.id);
      await db.logAudit(user.id, 'blacklist_add', `Blacklisted ${targetId} for: ${reason}`);

      const embed = new EmbedBuilder()
        .setTitle('⛔ [Axis Admin] Global Blacklist Added')
        .setColor(0xE74C3C)
        .addFields(
          { name: 'Target ID', value: `\`${targetId}\``, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ADMIN: /blacklist-remove
    if (commandName === 'blacklist-remove') {
      const targetId = options.getString('target-id');

      const success = await db.unblacklistUser(targetId);
      if (!success) {
        return interaction.reply({ content: `❌ Target ID \`${targetId}\` is not on the blacklist.`, ephemeral: true });
      }

      await db.logAudit(user.id, 'blacklist_remove', `Removed blacklist for ${targetId}`);

      return interaction.reply({ content: `✅ Target \`${targetId}\` removed from global blacklist.`, ephemeral: true });
    }

    // ADMIN: /create-product
    if (commandName === 'create-product') {
      const productId = options.getString('product-id');
      const name = options.getString('name');
      const desc = options.getString('description') || 'Axis Core Retail Product';
      const role = options.getRole('role');
      const robloxProductId = options.getString('roblox-product-id');
      const priceRobux = options.getInteger('price-robux') || 0;
      const placeIdLock = options.getString('place-id-lock');

      await db.createProduct(productId, name, desc, role ? role.id : null, robloxProductId || null, priceRobux, placeIdLock || null);
      await db.logAudit(user.id, 'create_product', `Created product ${productId}`);

      const embed = new EmbedBuilder()
        .setTitle('📦 [Axis Admin] Product Registered')
        .setColor(0x2ECC71)
        .addFields(
          { name: 'Product ID', value: `\`${productId}\``, inline: true },
          { name: 'Name', value: name, inline: true },
          { name: 'Price', value: priceRobux ? `\`${priceRobux} R$\`` : 'Free', inline: true },
          { name: 'Roblox ID', value: robloxProductId ? `\`${robloxProductId}\`` : 'None', inline: true },
          { name: 'Role', value: role ? `<@&${role.id}>` : 'None', inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ADMIN: /delete-product
    if (commandName === 'delete-product') {
      const productId = options.getString('product-id');

      const success = await db.deleteProduct(productId);
      if (!success) {
        return interaction.reply({ content: `❌ Product ID \`${productId}\` not found.`, ephemeral: true });
      }

      await db.logAudit(user.id, 'delete_product', `Deleted product ${productId}`);

      return interaction.reply({ content: `🗑️ Product \`${productId}\` and its whitelists deleted.`, ephemeral: true });
    }

    // ADMIN: /analytics
    if (commandName === 'analytics') {
      const stats = await db.getAnalytics();

      const embed = new EmbedBuilder()
        .setTitle('📊 Axis Core Retail Analytics Dashboard')
        .setColor(0x00D2FF)
        .addFields(
          { name: 'Registered Products', value: `\`${stats.totalProducts}\``, inline: true },
          { name: 'Active Whitelists', value: `\`${stats.activeWhitelists}\``, inline: true },
          { name: 'Linked Discord-Roblox Users', value: `\`${stats.linkedAccounts}\``, inline: true },
          { name: 'Globally Blacklisted Users', value: `\`${stats.blacklistedUsers}\``, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ADMIN: /audit-logs
    if (commandName === 'audit-logs') {
      const logs = await db.getAuditLogs(15);

      const embed = new EmbedBuilder()
        .setTitle('📋 Staff Audit Action Logs')
        .setColor(0x3498DB)
        .setTimestamp();

      if (logs.length === 0) {
        embed.setDescription('No audit logs recorded yet.');
      } else {
        logs.forEach(l => {
          embed.addFields({
            name: `Action: \`${l.action}\` | Staff: <@${l.staff_id}>`,
            value: `${l.details} (<t:${Math.floor(new Date(l.created_at).getTime() / 1000)}:R>)`,
            inline: false
          });
        });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (err) {
    console.error(`[Bot Error in ${interaction.commandName || 'interaction'}]:`, err);
    const msg = `❌ Error: ${err.message || 'Internal failure.'}`;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
}

module.exports = {
  commands,
  handleInteraction
};
