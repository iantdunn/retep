const { EmbedUtils } = require('./utils/embedUtils');
const { ReactionUtils } = require('./utils/reactionUtils');
const { FireboardDatabase } = require('./utils/fireboardDatabase');

/**
 * Manages fireboard messages - creation, updates, and deletion
 */
class FireboardMessageManager {
    constructor(client, settings) {
        this.client = client;
        this.settings = settings;
    }

    /**
     * Add a message to the fireboard
     * @param {Message} message - The Discord message object
     * @param {Array} validReactions - Array of valid reaction objects
     * @returns {Promise<boolean>} - Success status
     */
    async addToFireboard(message, validReactions) {
        try {
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
            const embed = EmbedUtils.createFireboardEmbed(message, validReactions);
            const fireboardMessage = await fireboardChannel.send({ embeds: [embed] });            // Calculate total valid reaction count
            const totalValidReactionCount = validReactions.reduce((acc, r) => acc + r.count, 0);

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
        } catch (error) {
            console.error('Error adding message to fireboard:', error);
            return false;
        }
    }

    /**
     * Update an existing fireboard entry
     * @param {Message} originalMessage - The original message
     * @param {FireboardEntry} entry - The database entry
     * @param {Array} validReactions - Array of valid reaction objects
     * @returns {Promise<boolean>} - Success status
     */
    async updateFireboardEntry(originalMessage, entry, validReactions) {
        try {
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
            const totalValidReactionCount = validReactions.reduce((acc, r) => acc + r.count, 0);
            await FireboardDatabase.updateValidReactionCount(originalMessage.id, totalValidReactionCount);

            return true;
        } catch (error) {
            console.error('Error updating existing fireboard entry:', error);
            return false;
        }
    }

    /**
     * Remove a fireboard entry completely (both message and database record)
     * @param {FireboardEntry} entry - The database entry to remove
     * @param {string} reason - Reason for removal (for logging)
     * @returns {Promise<boolean>} - Success status
     */
    async removeFireboardEntry(entry, reason = 'threshold not met') {
        try {
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
        } catch (error) {
            console.error('Error removing fireboard entry completely:', error);
            return false;
        }
    }

    /**
     * Refresh all fireboard entries on bot startup
     * @returns {Promise<Object>} - Refresh statistics
     */
    async refreshAllEntries() {
        try {
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
        } catch (error) {
            console.error('Error refreshing fireboard entries:', error);
            return { refreshed: 0, removed: 0 };
        }
    }

    /**
     * Recreate a fireboard entry when the original fireboard message is missing
     * @param {Message} originalMessage - The original message
     * @param {FireboardEntry} entry - The database entry
     * @param {Array} validReactions - Array of valid reaction objects
     * @private
     */
    async _recreateFireboardEntry(originalMessage, entry, validReactions) {
        try {
            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) return;

            const embed = EmbedUtils.createFireboardEmbed(originalMessage, validReactions);
            const newFireboardMessage = await fireboardChannel.send({ embeds: [embed] });

            // Calculate total valid reaction count
            const totalValidReactionCount = validReactions.reduce((acc, r) => acc + r.count, 0);

            // Update the database with the new fireboard message ID and valid reaction count
            await FireboardDatabase.updateEntry(entry.messageId, {
                fireboardMessageId: newFireboardMessage.id,
                validReactionCount: totalValidReactionCount
            });

            console.log(`Recreated fireboard entry for message ${originalMessage.id}`);
        } catch (error) {
            console.error('Error recreating fireboard entry:', error);
        }
    }

    /**
     * Update an existing fireboard message with current reaction data
     * @param {Message} originalMessage - The original message
     * @param {Message} fireboardMessage - The fireboard message to update
     * @param {Array} validReactions - Array of valid reaction objects
     * @private
     */
    async _updateFireboardMessage(originalMessage, fireboardMessage, validReactions) {
        try {
            const embed = EmbedUtils.createFireboardEmbed(originalMessage, validReactions);
            await fireboardMessage.edit({ embeds: [embed] });
        } catch (error) {
            console.error('Error updating fireboard message:', error);
        }
    }

    /**
     * Refresh a single fireboard entry
     * @param {FireboardEntry} entry - Database entry to refresh
     * @param {TextChannel} fireboardChannel - Fireboard channel
     * @returns {Promise<string>} - Result status ('refreshed', 'removed', or 'failed')
     * @private
     */
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
        const totalValidReactionCount = validReactions.reduce((acc, r) => acc + r.count, 0);
        await FireboardDatabase.updateValidReactionCount(originalMessage.id, totalValidReactionCount);

        return 'refreshed';
    }

    /**
     * Fetch a message by ID from any accessible channel
     * @param {string} messageId - Message ID to fetch
     * @returns {Promise<Message|null>} - Message or null if not found
     * @private
     */
    async _fetchMessageById(messageId) {
        try {
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
        } catch (error) {
            console.error('Error fetching message by ID:', error);
            return null;
        }
    }

    /**
     * Get valid reactions from a message
     * @param {Message} message - Discord message
     * @returns {Promise<Array>} - Array of valid reaction objects
     * @private
     */
    async _getValidReactions(message) {
        const { validReactions } = require('../config');
        const messageValidReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (validReactions.includes(emoji)) {
                await reaction.users.fetch();
                let count = reaction.count;

                if (this.settings.excludeAuthorReactions &&
                    message.author &&
                    reaction.users.cache.has(message.author.id)) {
                    count -= 1;
                }

                messageValidReactions.push({
                    emoji: emoji,
                    count: count
                });
            }
        }

        return messageValidReactions;
    }
}

module.exports = { FireboardMessageManager };
