const { reactionRoleSettings } = require('../config');
const { ConfigManager } = require('./utils/configManager');
const { EmbedUtils } = require('./utils/embedUtils');
const { ReactionUtils } = require('./utils/reactionUtils');

/**
 * Handles reaction-based role assignment
 * Focused on core role assignment logic
 */
class ReactionRoles {
    constructor(client) {
        this.client = client;
        this.settings = reactionRoleSettings;
        this.configManager = new ConfigManager();
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
            } let message = await this._getOrCreateMessage(channel);
            if (message) {
                await this._manageMessageReactions(message);
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
        return await this._handleRoleAction(reaction, user, 'add');
    }

    /**
     * Handle reaction removals for role assignment
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     * @returns {boolean} - Whether this was handled as a reaction role
     */
    async handleReactionRemove(reaction, user) {
        return await this._handleRoleAction(reaction, user, 'remove');
    }

    /**
     * Unified handler for reaction role add/remove actions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     * @returns {boolean} - Whether this was handled as a reaction role
     * @private
     */
    async _handleRoleAction(reaction, user, action) {
        try {
            // Quick checks for early exit
            if (!this.settings.enabled ||
                reaction.message.id !== this.settings.messageId ||
                ReactionUtils.isBot(user)) {
                return this.settings.enabled && reaction.message.id === this.settings.messageId;
            }

            const emoji = reaction.emoji.toString();
            const roleId = this.settings.roleEmojis[emoji];

            if (!roleId) {
                console.log(`No role mapping found for emoji: ${emoji}`);
                return true;
            }

            const validation = ReactionUtils.validateObjects({
                guild: reaction.message.guild,
                member: await reaction.message.guild.members.fetch(user.id).catch(() => null),
                role: reaction.message.guild.roles.cache.get(roleId)
            });

            if (!validation.valid) {
                console.error(`Missing objects for reaction role: ${validation.missing.join(', ')}`);
                return true;
            }

            const { member, role } = {
                member: await reaction.message.guild.members.fetch(user.id),
                role: reaction.message.guild.roles.cache.get(roleId)
            };

            return await this._performRoleAction(member, role, user, action);

        } catch (error) {
            console.error(`Error handling reaction role ${action}:`, error);
            return false;
        }
    }

    /**
     * Perform the actual role add/remove operation
     * @param {GuildMember} member - Guild member
     * @param {Role} role - Role to assign/remove
     * @param {User} user - User for logging
     * @param {string} action - 'add' or 'remove'
     * @returns {boolean} - Success status
     * @private
     */
    async _performRoleAction(member, role, user, action) {
        const hasRole = member.roles.cache.has(role.id);
        const userDisplay = ReactionUtils.getUserDisplayName(user);

        if (action === 'add') {
            if (hasRole) {
                console.log(`User ${userDisplay} already has role ${role.name}`);
                return true;
            }
            await member.roles.add(role);
            console.log(`Added role ${role.name} to ${userDisplay}`);
        } else if (action === 'remove') {
            if (!hasRole) {
                console.log(`User ${userDisplay} doesn't have role ${role.name}`);
                return true;
            }
            await member.roles.remove(role);
            console.log(`Removed role ${role.name} from ${userDisplay}`);
        }

        return true;
    }

    /**
     * Get existing reaction role message or create a new one
     * @param {TextChannel} channel - Discord channel
     * @returns {Message|null} - The reaction role message
     * @private
     */
    async _getOrCreateMessage(channel) {
        // Try to fetch existing message
        if (this.settings.messageId) {
            try {
                const message = await channel.messages.fetch(this.settings.messageId);
                console.log(`Found existing reaction role message: ${this.settings.messageId}`);
                return message;
            } catch (error) {
                console.log(`Could not fetch message with ID ${this.settings.messageId}, will create new one`);
                this.settings.messageId = null;
            }
        }

        // Create new message
        const message = await this._createMessage(channel);
        if (message) {
            this.settings.messageId = message.id;
            this.configManager.updateReactionRoleMessageId(message.id);
            console.log(`Created new reaction role message: ${message.id}`);
        }

        return message;
    }

    /**
     * Create the reaction role message
     * @param {TextChannel} channel - Discord channel to send message to
     * @returns {Message|null} - The created message
     * @private
     */
    async _createMessage(channel) {
        try {
            const embed = EmbedUtils.createReactionRolesEmbed(this.settings.roleEmojis);
            return await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error creating reaction role message:', error);
            return null;
        }
    }

    /**
     * Manage reactions on the reaction roles message
     * @param {Message} message - Discord message to manage reactions on
     * @private
     */
    async _manageMessageReactions(message) {
        try {
            // Clean up old reactions first
            await this._cleanupOldReactions(message);

            // Update the embed
            await this._updateMessageEmbed(message);

            // Add new reactions
            await this._addMissingReactions(message);

        } catch (error) {
            console.error('Error managing reactions:', error);
        }
    }

    /**
     * Remove reactions that are no longer in the config
     * @param {Message} message - The reaction roles message
     * @private
     */
    async _cleanupOldReactions(message) {
        const configEmojis = Object.keys(this.settings.roleEmojis);
        const reactionsToRemove = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            const shouldKeep = configEmojis.some(configEmoji =>
                ReactionUtils.emojisMatch(emoji, configEmoji)
            );

            if (!shouldKeep) {
                reactionsToRemove.push(reaction);
            }
        }

        for (const reaction of reactionsToRemove) {
            await ReactionUtils.removeReaction(reaction);
            await ReactionUtils.delay();
        }
    }

    /**
     * Add missing reactions to the message
     * @param {Message} message - Message to add reactions to
     * @private
     */
    async _addMissingReactions(message) {
        for (const emojiStr of Object.keys(this.settings.roleEmojis)) {
            if (!ReactionUtils.reactionExists(message, emojiStr)) {
                await ReactionUtils.addReaction(message, emojiStr);
            }
        }
    }

    /**
     * Update the reaction roles embed with current role mappings
     * @param {Message} message - The reaction roles message to update
     * @private
     */
    async _updateMessageEmbed(message) {
        try {
            const embed = EmbedUtils.createReactionRolesEmbed(this.settings.roleEmojis);
            await message.edit({ embeds: [embed] });
            console.log('Updated reaction roles embed with current config');
        } catch (error) {
            console.error('Error updating reaction roles embed:', error);
        }
    }
}

module.exports = { ReactionRoles };
