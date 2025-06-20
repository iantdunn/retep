const { EmbedBuilder } = require('discord.js');
const { reactionRoleSettings } = require('../config');
const fs = require('fs');
const path = require('path');

/**
 * Handles reaction-based role assignment
 */
class ReactionRoles {
    constructor(client) {
        this.client = client;
        this.settings = reactionRoleSettings;
        this.messageId = null;
    }

    /**
     * Initialize reaction roles on bot startup
     */
    async initialize() {
        try {
            console.log('Initializing Reaction Roles...');

            if (!this.settings.enabled) {
                console.log('Reaction roles are disabled in config');
                return;
            }

            if (Object.keys(this.settings.roleEmojis).length === 0) {
                console.log('No reaction role mappings configured');
                return;
            }

            const channel = await this.client.channels.fetch(this.settings.channelId);
            if (!channel) {
                console.error(`Cannot find channel with ID: ${this.settings.channelId}`);
                return;
            }

            let message = await this.getOrCreateReactionRoleMessage(channel);
            if (message) {
                await this.manageReactions(message);
            }

            console.log('Reaction Roles initialized successfully');
        } catch (error) {
            console.error('Error initializing reaction roles:', error);
        }
    }

    /**
     * Handle reaction additions for role assignment
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    async handleReactionAdd(reaction, user) {
        return await this.handleReactionRoleAction(reaction, user, 'add');
    }

    /**
     * Handle reaction removals for role assignment
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    async handleReactionRemove(reaction, user) {
        return await this.handleReactionRoleAction(reaction, user, 'remove');
    }

    /**
     * Unified handler for reaction role add/remove actions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    async handleReactionRoleAction(reaction, user, action) {
        try {
            if (!this.settings.enabled || reaction.message.id !== this.settings.messageId || user.bot) {
                return this.settings.enabled && reaction.message.id === this.settings.messageId && user.bot;
            }

            const emoji = reaction.emoji.toString();
            const roleId = this.settings.roleEmojis[emoji];

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
     * Get existing reaction role message or create a new one
     * @param {TextChannel} channel - Discord channel
     * @returns {Message|null} - The reaction role message
     */
    async getOrCreateReactionRoleMessage(channel) {
        let message = null;

        // Try to fetch existing message
        if (this.settings.messageId) {
            try {
                message = await channel.messages.fetch(this.settings.messageId);
                console.log(`Found existing reaction role message: ${this.settings.messageId}`);
                return message;
            } catch (error) {
                console.log(`Could not fetch message with ID ${this.settings.messageId}, will create new one`);
                this.settings.messageId = null;
                this.updateConfigFile();
            }
        }

        // Create new message if none exists
        message = await this.createReactionRoleMessage(channel);
        if (message) {
            this.settings.messageId = message.id;
            this.updateConfigFile();
            console.log(`Created new reaction role message: ${message.id}`);
        }

        return message;
    }

    /**
     * Create the reaction role message with embed
     * @param {TextChannel} channel - Discord channel to send message to
     * @returns {Message} - The created message
     */
    async createReactionRoleMessage(channel) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
                .setColor('#42f5f5');

            const roleDescriptions = [];
            for (const [emoji, roleId] of Object.entries(this.settings.roleEmojis)) {
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
    async manageReactions(message) {
        try {
            // Remove reactions that are no longer in config
            await this.cleanupRemovedReactions(message);

            // Update embed if this is a reaction role message
            if (this.isReactionRoleMessage({ message })) {
                await this.updateReactionRoleEmbed(message);
            }

            // Check existing reactions to avoid unnecessary API calls
            const existingReactions = new Set(message.reactions.cache.keys());

            // For each emoji in the role mappings
            for (const emojiStr of Object.keys(this.settings.roleEmojis)) {
                // Extract the emoji ID for custom emojis
                const emojiMatch = emojiStr.match(/<:.+?:(\d+)>/);
                const emojiId = emojiMatch ? emojiMatch[1] : emojiStr;

                // Check if this emoji already exists in the reactions
                const alreadyExists = Array.from(existingReactions).some(existing => {
                    if (emojiMatch) {
                        // For custom emojis, compare the ID
                        return existing === emojiId;
                    } else {
                        // For standard emojis, direct comparison
                        return existing === emojiStr;
                    }
                });

                if (!alreadyExists) {
                    try {
                        await message.react(emojiStr);
                        console.log(`Added reaction: ${emojiStr}`);
                        // Small delay to avoid rate limits
                        await new Promise(resolve => setTimeout(resolve, 250));
                    } catch (error) {
                        console.error(`Failed to add reaction ${emojiStr}:`, error);
                    }
                } else {
                    console.log(`Reaction ${emojiStr} already exists, skipping`);
                }
            }
        } catch (error) {
            console.error('Error managing reactions:', error);
        }
    }

    /**
     * Remove reactions that are no longer in the config
     * @param {Message} message - The reaction roles message
     */
    async cleanupRemovedReactions(message) {
        try {
            const reactionsToRemove = [];

            for (const [emoji, reaction] of message.reactions.cache) {
                if (!Object.keys(this.settings.roleEmojis).toString().includes(emoji)) {
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
    isReactionRoleMessage(reaction) {
        return this.settings.enabled && reaction.message.id === this.settings.messageId;
    }

    /**
     * Update the reaction roles embed with current role mappings
     * @param {Message} message - The reaction roles message to update
     */
    async updateReactionRoleEmbed(message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('Reaction Roles')
                .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
                .setColor('#42f5f5');

            const roleDescriptions = [];
            for (const [emoji, roleId] of Object.entries(this.settings.roleEmojis)) {
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
    }

    /**
     * Update the config file with new message ID
     */
    updateConfigFile() {
        try {
            const configPath = path.join(__dirname, '../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');

            const messageIdRegex = /(messageId:\s*)(null|'[^']*'|"[^"]*"|\d+)/;
            const newMessageIdValue = this.settings.messageId ? `'${this.settings.messageId}'` : 'null';

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

module.exports = { ReactionRoles };
