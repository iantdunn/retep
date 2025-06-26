const { reactionRoleSettings } = require('../config');
const { updateReactionRoleMessageId } = require('../utils/configUtils');
const { ReactionUtils } = require('./utils/reactionUtils');
const { createReactionRolesEmbed } = require('../utils/embeds');

module.exports.ReactionRoles = class {
    constructor(client) {
        this.client = client;
    }

    async initialize() {
        console.log('Initializing Reaction Roles...');

        if (!reactionRoleSettings.enabled) {
            console.log('Reaction roles are disabled in config');
            return;
        }

        if (Object.keys(reactionRoleSettings.roleEmojis).length === 0) {
            console.log('No reaction role mappings configured');
            return;
        }

        const channel = await this.client.channels.fetch(reactionRoleSettings.channelId);
        if (!channel) {
            console.error(`Cannot find channel with ID: ${reactionRoleSettings.channelId}`);
            return;
        }

        let message = await this._getOrCreateMessage(channel);
        if (message) {
            await this._manageMessageReactions(message);
        }

        console.log('Reaction Roles initialized successfully');
    }

    async handleReactionAdd(reaction, user) {
        return await this._handleRoleAction(reaction, user, 'add');
    }

    async handleReactionRemove(reaction, user) {
        return await this._handleRoleAction(reaction, user, 'remove');
    }

    async _handleRoleAction(reaction, user, action) {
        // Quick checks for early exit
        if (!reactionRoleSettings.enabled ||
            reaction.message.id !== reactionRoleSettings.messageId ||
            user.bot) { // If user is bot, ignore
            return reactionRoleSettings.enabled && reaction.message.id === reactionRoleSettings.messageId;
        }

        const emoji = reaction.emoji.toString();
        const roleId = reactionRoleSettings.roleEmojis[emoji];

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
    }

    async _performRoleAction(member, role, user, action) {
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

    async _getOrCreateMessage(channel) {
        // Try to fetch existing message
        if (reactionRoleSettings.messageId) {
            try {
                const message = await channel.messages.fetch(reactionRoleSettings.messageId);
                console.log(`Found existing reaction role message: ${reactionRoleSettings.messageId}`);
                return message;
            } catch (error) {
                console.log(`Could not fetch message with ID ${reactionRoleSettings.messageId}, will create new one`);
                reactionRoleSettings.messageId = null;
            }
        }

        // Create new message
        const embed = createReactionRolesEmbed(reactionRoleSettings.roleEmojis);
        const message = await channel.send({ embeds: [embed] });
        if (message) {
            reactionRoleSettings.messageId = message.id; // TODO is this call needed?
            updateReactionRoleMessageId(message.id);
            console.log(`Created new reaction role message: ${message.id}`);
        }

        return message;
    }

    async _manageMessageReactions(message) {
        // Clean up old reactions first
        const configEmojis = Object.keys(reactionRoleSettings.roleEmojis);
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
        }

        // Update the embed
        const embed = createReactionRolesEmbed(reactionRoleSettings.roleEmojis);
        await message.edit({ embeds: [embed] });
        console.log('Updated reaction roles embed with current config');

        // Add new reactions
        for (const emojiStr of Object.keys(reactionRoleSettings.roleEmojis)) {
            if (!ReactionUtils.reactionExists(message, emojiStr)) {
                await ReactionUtils.addReaction(message, emojiStr);
            }
        }
    }
}
