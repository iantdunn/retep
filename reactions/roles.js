const { reactionRoleSettings } = require('../config');
const { updateReactionRoleMessageId } = require('../utils/configUtils');
const { createReactionRolesEmbed } = require('../utils/embeds');
const { emojisMatch, reactionExists } = require('../utils/reactionUtils');

module.exports.ReactionRoles = class {
    constructor(client) {
        this.client = client;
        this.settings = reactionRoleSettings;
    }

    async initialize() {
        console.log('Initializing Reaction Roles');

        if (!this.settings.enabled)
            throw new Error('Reaction roles are disabled in config');

        if (Object.keys(this.settings.roleEmojis).length === 0)
            throw new Error('No reaction role mappings configured');

        this.channel = await this.client.channels.fetch(this.settings.channelId);
        if (!this.channel)
            throw new Error(`Cannot find channel with ID: ${this.settings.channelId}`);

        let message = await this._getOrCreateMessage();
        if (message)
            await this._refreshMessage(message);
    }

    async reactionAdd(reaction, user) {
        return await this._handleRoleAction(reaction, user, 'add');
    }

    async reactionRemove(reaction, user) {
        return await this._handleRoleAction(reaction, user, 'remove');
    }

    async _handleRoleAction(reaction, user, action) {
        // Quick checks for early exit
        if (!this.settings.enabled ||
            reaction.message.id !== this.settings.messageId ||
            user.bot) { // If user is bot, ignore
            return this.settings.enabled && reaction.message.id === this.settings.messageId;
        }

        const emoji = reaction.emoji.toString();
        const roleId = this.settings.roleEmojis[emoji];

        if (!roleId) {
            console.log(`No role mapping found for emoji: ${emoji}`);
            return true;
        }

        // Make sure guild, member and role all exist
        const guild = reaction.message.guild;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) {
            console.error('Could not fetch member for reaction role');
            return true;
        }

        const role = guild.roles.cache.get(roleId);
        if (!role) {
            console.error(`Role with ID ${roleId} not found`);
            return true;
        }

        const hasRole = member.roles.cache.has(role.id);

        if (action === 'add') {
            if (hasRole) {
                console.log(`User ${user.displayName} already has role ${role.name}`);
                return true;
            }
            await member.roles.add(role);
            console.log(`Added role ${role.name} to ${user.displayName}`);
        } else if (action === 'remove') {
            if (!hasRole) {
                console.log(`User ${user.displayName} doesn't have role ${role.name}`);
                return true;
            }
            await member.roles.remove(role);
            console.log(`Removed role ${role.name} from ${user.displayName}`);
        }

        return true;
    }

    async _getOrCreateMessage() {
        // Try to fetch existing message
        if (this.settings.messageId) {
            try {
                const message = await this.channel.messages.fetch(this.settings.messageId);
                console.log(`Found existing reaction role message: ${this.settings.messageId}`);
                return message;
            } catch (error) {
                console.log(`Could not fetch message with ID ${this.settings.messageId}, will create new one`);
                this.settings.messageId = null;
            }
        }

        // Create new message
        const embed = createReactionRolesEmbed(this.settings.roleEmojis);
        const message = await this.channel.send({ embeds: [embed] });
        if (message) {
            updateReactionRoleMessageId(message.id);
            console.log(`Created new reaction role message: ${message.id}`);
        }

        return message;
    }

    async _refreshMessage(message) {
        // Clean up old reactions first
        const configEmojis = Object.keys(this.settings.roleEmojis);
        const reactionsToRemove = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            const shouldKeep = configEmojis.some(configEmoji =>
                emojisMatch(emoji, configEmoji)
            );

            if (!shouldKeep) {
                reactionsToRemove.push(reaction);
            }
        }

        for (const reaction of reactionsToRemove) {
            await reaction.users.remove(reaction.message.client.user);
            console.log(`Removed reaction: ${reaction.emoji}`);
        }

        // Update the embed
        const embed = createReactionRolesEmbed(this.settings.roleEmojis);
        await message.edit({ embeds: [embed] });
        console.log('Updated reaction roles embed with current config');

        // Add new reactions
        for (const emojiStr of Object.keys(this.settings.roleEmojis)) {
            if (!reactionExists(message, emojiStr)) {
                await message.react(emojiStr);
                console.log(`Added reaction: ${emojiStr}`);
            }
        }
    }
}
