const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const fs = require('fs');
const path = require('path');

class ReactionManager {
    /**
     * Initialize reaction manager on bot startup
     * @param {Client} client - Discord client instance
     */
    static async initialize(client) {
        console.log('Initializing Reaction Manager...');

        // Initialize reaction roles if enabled
        await this.initializeReactionRoles(client);

        console.log('Reaction Manager initialized successfully');
    }

    /**
     * Initialize reaction roles on bot startup
     * @param {Client} client - Discord client instance
     */
    static async initializeReactionRoles(client) {
        try {
            const settings = config.reactionRoleSettings;

            if (!settings.enabled) {
                console.log('Reaction roles are disabled in config');
                return;
            }

            if (Object.keys(settings.roleEmojis).length === 0) {
                console.log('No reaction role mappings configured');
                return;
            }

            const channel = await client.channels.fetch(settings.channelId);
            if (!channel) {
                console.error(`Cannot find channel with ID: ${settings.channelId}`);
                return;
            }

            let message = null;

            // Check if message ID exists and try to fetch it
            if (settings.messageId) {
                try {
                    message = await channel.messages.fetch(settings.messageId);
                    console.log(`Found existing reaction role message: ${settings.messageId}`);
                } catch (error) {
                    console.log(`Could not fetch message with ID ${settings.messageId}, will create new one`);
                    // Clear the invalid message ID
                    settings.messageId = null;
                    this.updateConfigFile();
                }
            }

            // Create new message if none exists
            if (!message) {
                message = await this.createReactionRoleMessage(channel);
                if (message) {
                    // Update config with new message ID
                    settings.messageId = message.id;
                    this.updateConfigFile();
                    console.log(`Created new reaction role message: ${message.id}`);
                }
            }

            if (message) {
                // Ensure all required reactions are present
                await this.ensureReactionRoleReactions(message);
            }

        } catch (error) {
            console.error('Error initializing reaction roles:', error);
        }
    }

    /**
     * Main handler for reaction additions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     */
    static async handleReactionAdd(reaction, user) {
        try {
            // Handle reaction roles first
            const roleHandled = await this.handleReactionRoleAdd(reaction, user);

            // If it wasn't a reaction role, handle regular reaction tracking
            if (!roleHandled) {
                await this.processReactionTracking(reaction, user, 'add');
            }
        } catch (error) {
            console.error('Error handling reaction add:', error);
        }
    }

    /**
     * Main handler for reaction removals
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     */
    static async handleReactionRemove(reaction, user) {
        try {
            // Handle reaction roles first
            const roleHandled = await this.handleReactionRoleRemove(reaction, user);

            // If it wasn't a reaction role, handle regular reaction tracking
            if (!roleHandled) {
                await this.processReactionTracking(reaction, user, 'remove');
            }
        } catch (error) {
            console.error('Error handling reaction remove:', error);
        }
    }

    // ==================== REACTION ROLES FUNCTIONALITY ====================

    /**
     * Handle reaction add for role assignment
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    static async handleReactionRoleAdd(reaction, user) {
        try {
            const settings = config.reactionRoleSettings;

            if (!settings.enabled || reaction.message.id !== settings.messageId) {
                return false;
            }

            if (user.bot) {
                return true; // Handled but no action needed
            }

            const emoji = reaction.emoji.toString();
            const roleId = settings.roleEmojis[emoji];

            if (!roleId) {
                console.log(`No role mapping found for emoji: ${emoji}`);
                return true; // Handled but no matching role
            }

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);

            if (!role) {
                console.error(`Role not found: ${roleId}`);
                return true;
            }

            if (member.roles.cache.has(roleId)) {
                console.log(`User ${user.tag} already has role ${role.name}`);
                return true;
            }

            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${user.tag}`);
            return true;

        } catch (error) {
            console.error('Error handling reaction role add:', error);
            return false;
        }
    }

    /**
     * Handle reaction remove for role removal
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    static async handleReactionRoleRemove(reaction, user) {
        try {
            const settings = config.reactionRoleSettings;

            if (!settings.enabled || reaction.message.id !== settings.messageId) {
                return false;
            }

            if (user.bot) {
                return true; // Handled but no action needed
            }

            const emoji = reaction.emoji.toString();
            const roleId = settings.roleEmojis[emoji];

            if (!roleId) {
                return true; // Handled but no matching role
            }

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);

            if (!role) {
                console.error(`Role not found: ${roleId}`);
                return true;
            }

            if (!member.roles.cache.has(roleId)) {
                console.log(`User ${user.tag} doesn't have role ${role.name}`);
                return true;
            }

            await member.roles.remove(role);
            console.log(`❌ Removed role ${role.name} from ${user.tag}`);
            return true;

        } catch (error) {
            console.error('Error handling reaction role remove:', error);
            return false;
        }
    }

    /**
     * Create the reaction role message with embed
     * @param {TextChannel} channel - Discord channel to send message to
     * @returns {Message} - The created message
     */
    static async createReactionRoleMessage(channel) {
        try {
            const settings = config.reactionRoleSettings;

            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
                .setColor('#42f5f5')
                .setTimestamp();

            // Add field showing emoji-role mappings
            const roleDescriptions = [];
            for (const [emoji, roleId] of Object.entries(settings.roleEmojis)) {
                roleDescriptions.push(`${emoji} - <@&${roleId}>`);
            }

            if (roleDescriptions.length > 0) {
                embed.addFields({
                    name: 'Available Roles',
                    value: roleDescriptions.join('\n'),
                    inline: false
                });
            }

            const message = await channel.send({ embeds: [embed] });
            return message;
        } catch (error) {
            console.error('Error creating reaction role message:', error);
            return null;
        }
    }

    /**
     * Ensure all required reactions are present on the reaction roles message
     * @param {Message} message - Discord message to add reactions to
     */
    static async ensureReactionRoleReactions(message) {
        try {
            const settings = config.reactionRoleSettings;

            for (const emoji of Object.keys(settings.roleEmojis)) {
                try {
                    // Check if reaction already exists
                    const existingReaction = message.reactions.cache.get(emoji);
                    if (!existingReaction) {
                        await message.react(emoji);
                        console.log(`Added reaction: ${emoji}`);
                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 250));
                    }
                } catch (error) {
                    console.error(`Failed to add reaction ${emoji}:`, error);
                }
            }
        } catch (error) {
            console.error('Error ensuring reactions:', error);
        }
    }

    /**
     * Check if a reaction is for reaction roles
     * @param {MessageReaction} reaction - The reaction object
     * @returns {boolean} - Whether this reaction is for role assignment
     */
    static isReactionRoleMessage(reaction) {
        const settings = config.reactionRoleSettings;
        return settings.enabled && reaction.message.id === settings.messageId;
    }

    // ==================== REACTION TRACKING FUNCTIONALITY ====================

    /**
     * Process and log reaction statistics for a message
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     */
    static async processReactionTracking(reaction, user, action) {
        try {
            const message = reaction.message;

            // Ensure the message is fully fetched
            if (message.partial) {
                await message.fetch();
            }

            // Calculate statistics
            const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
            const validReactions = this.getValidReactions(message);
            const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);
            const validReactionsExcludingAuthor = await this.getValidReactionsExcludingAuthor(message);

            console.log(`\n=== Message Reaction Update ===`);
            console.log(`Action: ${action}`);
            console.log(`Message ID: ${message.id}`);
            console.log(`Message Author: ${message.author.tag} (${message.author.id})`);
            console.log(`User who reacted: ${user.tag} (${user.id})`);
            console.log(`Reaction: ${reaction.emoji}`);
            console.log(`Total reactions: ${totalReactions}`);
            console.log(`Total valid reactions: ${totalValidReactions}`);
            console.log(`Valid reactions (excluding author): ${validReactionsExcludingAuthor}`);

            // Log breakdown of valid reactions
            if (validReactions.length > 0) {
                console.log(`Valid reactions breakdown:`);
                validReactions.forEach(r => {
                    console.log(`  ${r.emoji}: ${r.count}`);
                });
            }

            console.log(`===============================\n`);
        } catch (error) {
            console.error('Error processing reaction tracking:', error);
        }
    }

    /**
     * Check if a reaction emoji is in the valid reactions list
     * @param {string} emoji - The emoji to check
     * @returns {boolean} - Whether the emoji is valid
     */
    static isValidReaction(emoji) {
        return config.validReactions.includes(emoji);
    }

    /**
     * Get all valid reactions from a message
     * @param {Message} message - The Discord message object
     * @returns {Array} - Array of valid reaction objects
     */
    static getValidReactions(message) {
        const validReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this.isValidReaction(emoji)) {
                validReactions.push({
                    emoji: emoji,
                    count: reaction.count,
                    users: reaction.users.cache
                });
            }
        }

        return validReactions;
    }

    /**
     * Count valid reactions excluding the message author
     * @param {Message} message - The Discord message object
     * @returns {number} - Count of valid reactions excluding author
     */
    static async getValidReactionsExcludingAuthor(message) {
        let validReactionCount = 0;

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this.isValidReaction(emoji)) {
                // Fetch all users who reacted with this emoji
                const users = await reaction.users.fetch();

                // Count reactions excluding the message author
                const nonAuthorReactions = users.filter(user =>
                    user.id !== message.author.id
                ).size;

                validReactionCount += nonAuthorReactions;
            }
        }

        return validReactionCount;
    }

    /**
     * Get the list of valid reactions
     * @returns {Array} - Array of valid reaction emojis
     */
    static getValidReactionsList() {
        return [...config.validReactions];
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Update the config file with new message ID
     */
    static updateConfigFile() {
        try {
            const configPath = path.join(__dirname, '../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');

            // Update the messageId in the existing config file
            const messageIdRegex = /(messageId:\s*)(null|'[^']*'|"[^"]*"|\d+)/;
            const newMessageIdValue = config.reactionRoleSettings.messageId ? `'${config.reactionRoleSettings.messageId}'` : 'null';

            if (messageIdRegex.test(configContent)) {
                configContent = configContent.replace(messageIdRegex, `$1${newMessageIdValue}`);
                fs.writeFileSync(configPath, configContent, 'utf8');
                console.log('Updated config file with new message ID');
            } else {
                console.log('Could not find messageId field in config file');
            }
        } catch (error) {
            console.error('Error updating config file:', error);
        }
    }
}

module.exports = { ReactionManager };
