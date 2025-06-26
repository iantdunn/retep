const { ReactionUtils } = require('./utils/reactionUtils');
const { ValidReactionCalculator } = require('./utils/validReactionCalculator');
const { FireboardDatabase } = require('./utils/fireboardDatabase');
const { createFireboardEmbed } = require('../utils/embeds');

class FireboardMessageManager {
    constructor(client, settings) {
        this.client = client;
        this.settings = settings;
    }

    async addToFireboard(message, validReactions) {
        // Double-check if entry already exists to prevent race conditions
        const existingEntry = await FireboardDatabase.getEntry(message.id);
        if (existingEntry) {
            console.log(`Message ${message.id} already exists on fireboard, updating instead`);
            await this.updateFireboardEntry(message, existingEntry, validReactions);
            return true;
        }

        const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
        if (!fireboardChannel) {
            console.error('Fireboard channel not found');
            return false;
        }

        // Generate and send the fireboard embed
        const embed = createFireboardEmbed(message, validReactions);
        const fireboardMessage = await fireboardChannel.send({ embeds: [embed] });

        // Calculate total valid reaction count
        const totalValidReactionCount = ValidReactionCalculator.calculateTotalCount(validReactions);

        // Save to database
        const entry = await FireboardDatabase.createEntry(
            message.id,
            fireboardMessage.id,
            message.author.id,
            totalValidReactionCount
        );

        if (entry) {
            console.log(`Added message ${message.id} to fireboard as message ${fireboardMessage.id}`);
            return true;
        } else {
            console.log(`Failed to create database entry for message ${message.id}`);
            return false;
        }
    }

    async updateFireboardEntry(originalMessage, entry, validReactions) {
        const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
        if (!fireboardChannel) return false;

        let fireboardMessage;
        try {
            fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
        } catch (error) {
            // Fireboard message doesn't exist, recreate it
            await this._recreateFireboardEntry(originalMessage, entry, validReactions);
            return true;
        }

        // Update the fireboard message
        await this._updateFireboardMessage(originalMessage, fireboardMessage, validReactions);

        // Update the valid reaction count in the database
        const totalValidReactionCount = ValidReactionCalculator.calculateTotalCount(validReactions);
        await FireboardDatabase.updateValidReactionCount(originalMessage.id, totalValidReactionCount);

        return true;
    }

    async removeFireboardEntry(entry, reason = 'threshold not met') {
        console.log(`Removing fireboard entry for message ${entry.messageId} (${reason})`);

        // Try to delete the fireboard message
        try {
            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (fireboardChannel) {
                const fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
                await fireboardMessage.delete();
                console.log(`Deleted fireboard message ${entry.fireboardMessageId}`);
            }
        } catch (error) {
            console.log(`Fireboard message ${entry.fireboardMessageId} not found for deletion (may already be deleted)`);
        }

        // Remove from database
        const deleted = await FireboardDatabase.deleteEntryObject(entry);
        if (deleted) {
            console.log(`Removed database entry for message ${entry.messageId}`);
        }

        return deleted;
    }

    async refreshAllEntries() {
        console.log('Refreshing all fireboard entries...');

        const entries = await FireboardDatabase.getAllEntries();
        console.log(`Found ${entries.length} fireboard entries to refresh`);

        const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
        if (!fireboardChannel) {
            console.error('Fireboard channel not found during refresh');
            return { refreshed: 0, removed: 0 };
        }

        let refreshed = 0;
        let removed = 0;

        for (const entry of entries) {
            try {
                const result = await this._refreshSingleEntry(entry, fireboardChannel);
                if (result === 'refreshed') refreshed++;
                else if (result === 'removed') removed++;
            } catch (error) {
                console.error(`Error refreshing entry ${entry.messageId}:`, error);
            }
        }

        console.log(`Fireboard refresh complete: ${refreshed} updated, ${removed} removed`);
        return { refreshed, removed };
    }

    async _recreateFireboardEntry(originalMessage, entry, validReactions) {
        const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
        if (!fireboardChannel) return;

        const embed = createFireboardEmbed(originalMessage, validReactions);
        const newFireboardMessage = await fireboardChannel.send({ embeds: [embed] });

        // Calculate total valid reaction count
        const totalValidReactionCount = ValidReactionCalculator.calculateTotalCount(validReactions);

        // Update the database with the new fireboard message ID and valid reaction count
        await FireboardDatabase.updateEntry(entry.messageId, {
            fireboardMessageId: newFireboardMessage.id,
            validReactionCount: totalValidReactionCount
        });

        console.log(`Recreated fireboard entry for message ${originalMessage.id}`);
    }

    async _updateFireboardMessage(originalMessage, fireboardMessage, validReactions) {
        const embed = createFireboardEmbed(originalMessage, validReactions);
        await fireboardMessage.edit({ embeds: [embed] });
    }

    async _refreshSingleEntry(entry, fireboardChannel) {
        // Try to fetch the original message
        const originalMessage = await this._fetchMessageById(entry.messageId);
        if (!originalMessage) {
            // Original message no longer exists, remove from fireboard
            await this.removeFireboardEntry(entry, 'original message deleted');
            return 'removed';
        }

        // Fetch reactions and check if still qualifies
        await ReactionUtils.safelyFetchMessage(originalMessage);
        await ReactionUtils.safelyFetchReactions(originalMessage);

        // Check if fireboard message still exists
        let fireboardMessage;
        try {
            fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
        } catch (error) {
            // Fireboard message doesn't exist, recreate it
            console.log(`Recreating missing fireboard message for ${entry.messageId}`);
            const validReactions = await this._getValidReactions(originalMessage);
            await this._recreateFireboardEntry(originalMessage, entry, validReactions);
            return 'refreshed';
        }

        // Update the existing fireboard message
        const validReactions = await this._getValidReactions(originalMessage);
        await this._updateFireboardMessage(originalMessage, fireboardMessage, validReactions);

        // Update the valid reaction count in the database
        const totalValidReactionCount = ValidReactionCalculator.calculateTotalCount(validReactions);
        await FireboardDatabase.updateValidReactionCount(originalMessage.id, totalValidReactionCount);

        return 'refreshed';
    }

    async _fetchMessageById(messageId) {
        for (const [, guild] of this.client.guilds.cache) {
            for (const [, channel] of guild.channels.cache) {
                if (channel.isTextBased()) {
                    try {
                        return await channel.messages.fetch(messageId);
                    } catch (error) {
                        // Message not in this channel, continue
                    }
                }
            }
        }
        return null;
    }

    /**
     * Get valid reactions from a message
     * @param {Message} message - Discord message
     * @returns {Promise<Array>} - Array of valid reaction objects
     * @private
     */
    async _getValidReactions(message) {
        const { validReactions } = require('../config');
        return await ValidReactionCalculator.calculateValidReactions(
            message,
            validReactions,
            this.settings.excludeAuthorReactions
        );
    }
}

module.exports = { FireboardMessageManager };
