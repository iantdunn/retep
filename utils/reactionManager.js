const { EmbedBuilder } = require('discord.js');
const { validReactions, reactionRoleSettings } = require('../config');
const fs = require('fs');
const path = require('path');

class ReactionManager {
    /**
     * Initialize reaction manager on bot startup
     * @param {Client} client - Discord client instance
     */
    static async initialize(client) {
        console.log('Initializing Reaction Manager...');
        await this.initializeReactionRoles(client);
        console.log('Reaction Manager initialized successfully');
    }

    /**
     * Initialize reaction roles on bot startup
     * @param {Client} client - Discord client instance
     */
    static async initializeReactionRoles(client) {
        try {
            if (!reactionRoleSettings.enabled) {
                console.log('Reaction roles are disabled in config');
                return;
            }

            if (Object.keys(reactionRoleSettings.roleEmojis).length === 0) {
                console.log('No reaction role mappings configured');
                return;
            }

            const channel = await client.channels.fetch(reactionRoleSettings.channelId);
            if (!channel) {
                console.error(`Cannot find channel with ID: ${reactionRoleSettings.channelId}`);
                return;
            }

            let message = await this.getOrCreateReactionRoleMessage(channel);
            if (message) {
                await this.manageReactions(message);
            }

        } catch (error) {
            console.error('Error initializing reaction roles:', error);
        }
    }

    /**
     * Get existing reaction role message or create a new one
     * @param {TextChannel} channel - Discord channel
     * @returns {Message|null} - The reaction role message
     */
    static async getOrCreateReactionRoleMessage(channel) {
        let message = null;

        // Try to fetch existing message
        if (reactionRoleSettings.messageId) {
            try {
                message = await channel.messages.fetch(reactionRoleSettings.messageId);
                console.log(`Found existing reaction role message: ${reactionRoleSettings.messageId}`);
                return message;
            } catch (error) {
                console.log(`Could not fetch message with ID ${reactionRoleSettings.messageId}, will create new one`);
                reactionRoleSettings.messageId = null;
                this.updateConfigFile();
            }
        }

        // Create new message if none exists
        message = await this.createReactionRoleMessage(channel);
        if (message) {
            reactionRoleSettings.messageId = message.id;
            this.updateConfigFile();
            console.log(`Created new reaction role message: ${message.id}`);
        }

        return message;
    }

    /**
     * Main handler for reaction additions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     */
    static async handleReactionAdd(reaction, user) {
        try {
            const roleHandled = await this.handleReactionRoleAction(reaction, user, 'add');
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
            const roleHandled = await this.handleReactionRoleAction(reaction, user, 'remove');
            if (!roleHandled) {
                await this.processReactionTracking(reaction, user, 'remove');
            }
        } catch (error) {
            console.error('Error handling reaction remove:', error);
        }
    }

    // ==================== REACTION ROLES FUNCTIONALITY ====================

    /**
     * Unified handler for reaction role add/remove actions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    static async handleReactionRoleAction(reaction, user, action) {
        try {
            if (!reactionRoleSettings.enabled || reaction.message.id !== reactionRoleSettings.messageId || user.bot) {
                return reactionRoleSettings.enabled && reaction.message.id === reactionRoleSettings.messageId && user.bot;
            }

            const emoji = reaction.emoji.toString();
            const roleId = reactionRoleSettings.roleEmojis[emoji];

            if (!roleId) {
                console.log(`No role mapping found for emoji: ${emoji}`);
                return true;
            }

            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);

            if (!role) {
                console.error(`Role not found: ${roleId}`);
                return true;
            }

            const hasRole = member.roles.cache.has(roleId);

            if (action === 'add') {
                if (hasRole) {
                    console.log(`User ${user.tag} already has role ${role.name}`);
                    return true;
                }
                await member.roles.add(role);
                console.log(`Added role ${role.name} to ${user.tag}`);
            } else if (action === 'remove') {
                if (!hasRole) {
                    console.log(`User ${user.tag} doesn't have role ${role.name}`);
                    return true;
                }
                await member.roles.remove(role);
                console.log(`Removed role ${role.name} from ${user.tag}`);
            }

            return true;
        } catch (error) {
            console.error(`Error handling reaction role ${action}:`, error);
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
            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
                .setColor('#42f5f5')
                .setTimestamp();

            const roleDescriptions = [];
            for (const [emoji, roleId] of Object.entries(reactionRoleSettings.roleEmojis)) {
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
     * Unified method to manage reactions on a message
     * @param {Message} message - Discord message to manage reactions on
     */
    static async manageReactions(message) {
        try {
            let targetEmojis = Object.keys(reactionRoleSettings.roleEmojis);

            // Remove reactions that are no longer in config
            const configuredEmojis = new Set(targetEmojis);
            await this.cleanupRemovedReactions(message, configuredEmojis);

            // Update embed if this is a reaction role message
            if (this.isReactionRoleMessage({ message })) {
                await this.updateReactionRoleEmbed(message);
            }

            // Check existing reactions to avoid unnecessary API calls
            const existingReactions = new Set(message.reactions.cache.keys());

            for (const emoji of targetEmojis) {
                if (!existingReactions.has(emoji)) {
                    try {
                        await message.react(emoji);
                        console.log(`Added reaction: ${emoji}`);
                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 250));
                    } catch (error) {
                        console.error(`Failed to add reaction ${emoji}:`, error);
                    }
                } else {
                    console.log(`Reaction ${emoji} already exists, skipping`);
                }
            }
        } catch (error) {
            console.error('Error managing reactions:', error);
        }
    }

    /**
     * Remove reactions that are no longer in the config
     * @param {Message} message - The reaction roles message
     * @param {Set} configuredEmojis - Set of currently configured emojis
     */
    static async cleanupRemovedReactions(message, configuredEmojis) {
        try {
            const reactionsToRemove = [];

            for (const [emoji, reaction] of message.reactions.cache) {
                if (!configuredEmojis.has(emoji)) {
                    reactionsToRemove.push({ emoji, reaction });
                }
            }

            if (reactionsToRemove.length === 0) {
                console.log('No reactions to clean up');
                return;
            }

            console.log(`Removing ${reactionsToRemove.length} outdated reactions...`);

            for (const { emoji, reaction } of reactionsToRemove) {
                try {
                    const botUser = message.client.user;
                    await reaction.users.remove(botUser);
                    console.log(`Removed bot reaction: ${emoji}`);
                    await new Promise(resolve => setTimeout(resolve, 250));
                } catch (error) {
                    console.error(`Failed to remove reaction ${emoji}:`, error);
                }
            }

        } catch (error) {
            console.error('Error cleaning up removed reactions:', error);
        }
    }

    /**
     * Check if a reaction is for reaction roles
     * @param {MessageReaction|Object} reaction - The reaction object
     * @returns {boolean} - Whether this reaction is for role assignment
     */
    static isReactionRoleMessage(reaction) {
        return reactionRoleSettings.enabled && reaction.message.id === reactionRoleSettings.messageId;
    }

    /**
     * Update the reaction roles embed with current role mappings
     * @param {Message} message - The reaction roles message to update
     */
    static async updateReactionRoleEmbed(message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
                .setColor('#42f5f5')
                .setTimestamp();

            const roleDescriptions = [];
            for (const [emoji, roleId] of Object.entries(reactionRoleSettings.roleEmojis)) {
                roleDescriptions.push(`${emoji} - <@&${roleId}>`);
            }

            if (roleDescriptions.length > 0) {
                embed.addFields({
                    name: 'Available Roles',
                    value: roleDescriptions.join('\n'),
                    inline: false
                });
            } else {
                embed.addFields({
                    name: 'Available Roles',
                    value: 'No roles configured',
                    inline: false
                });
            }

            await message.edit({ embeds: [embed] });
            console.log('Updated reaction roles embed with current config');

        } catch (error) {
            console.error('Error updating reaction roles embed:', error);
        }
    }    // ==================== REACTION TRACKING FUNCTIONALITY ====================

    /**
     * Process and log reaction statistics for a message
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     */
    static async processReactionTracking(reaction, user, action) {
        try {
            const message = reaction.message;

            if (message.partial) {
                await message.fetch();
            }

            const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
            const messageValidReactions = await this.getValidReactions(message, false);
            const messageValidReactionsExcludingAuthor = await this.getValidReactions(message, true);

            console.log(`\n=== Message Reaction Update ===`);
            console.log(`Action: ${action}`);
            console.log(`Message ID: ${message.id}`);
            console.log(`Message Author: ${message.author.tag} (${message.author.id})`);
            console.log(`User who reacted: ${user.tag} (${user.id})`);
            console.log(`Reaction: ${reaction.emoji}`);
            console.log(`Total reactions: ${totalReactions}`);
            console.log(`Total valid reactions: ${messageValidReactions.reduce((acc, r) => acc + r.count, 0)}`);
            console.log(`Valid reactions excluding author: ${messageValidReactionsExcludingAuthor.reduce((acc, r) => acc + r.count, 0)}`);

            if (messageValidReactions.length > 0) {
                console.log(`Valid reactions breakdown:`);
                messageValidReactions.forEach(r => {
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
        return validReactions.includes(emoji);
    }

    /**
     * Get all valid reactions from a message
     * @param {Message} message - The Discord message object
     * @param {boolean} excludeAuthorReactions - Whether to exclude reactions made by the message author
     * @returns {Array} - Array of valid reaction objects
     */
    static async getValidReactions(message, excludeAuthorReactions = true) {
        const messageValidReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this.isValidReaction(emoji)) {
                // Force fetch users cache to ensure it's up to date
                await reaction.users.fetch();
                let count = reaction.count;

                if (excludeAuthorReactions && message.author && reaction.users.cache.has(message.author.id)) {
                    count -= 1; // Exclude author's own reaction
                }

                messageValidReactions.push({
                    emoji: emoji,
                    count: count
                });
            }
        }

        return messageValidReactions;
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Update the config file with new message ID
     */
    static updateConfigFile() {
        try {
            const configPath = path.join(__dirname, '../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');

            const messageIdRegex = /(messageId:\s*)(null|'[^']*'|"[^"]*"|\d+)/;
            const newMessageIdValue = reactionRoleSettings.messageId ? `'${reactionRoleSettings.messageId}'` : 'null';

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

    /**
     * Get the list of valid reactions
     * @returns {Array} - Array of valid reaction emojis
     */
    static getValidReactionsList() {
        return [...validReactions];
    }
}

module.exports = { ReactionManager };
