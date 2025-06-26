const { fireboardSettings } = require('../config');
const { calculateValidReactions, calculateTotalCount, safelyFetchMessage, logReactionAction } = require('../utils/reactionUtils');
const { getEntry, createEntry, updateEntry, deleteEntryObject, getAllEntries } = require('../utils/fireboardCrud');
const { createFireboardEmbed } = require('../utils/embeds');

module.exports.Fireboard = class {
    constructor(client) {
        this.client = client;
        this.processingMessages = new Set(); // Track messages currently being processed
    }

    async initialize() {
        console.log('Initializing Fireboard...');

        if (!fireboardSettings.enabled) {
            console.log('Reaction tracking (Fireboard) is disabled in config');
            return;
        }

        // Refresh all fireboard entries on startup
        await this.refreshAllEntries();

        console.log('Fireboard initialized successfully');
    }

    async handleReactionAdd(reaction, user) {
        if (!fireboardSettings.enabled) return false;
        await this._processReactionChange(reaction, user, 'add');
        return false; // Don't block other handlers
    }

    /**
     * Handle reaction removals for fireboard tracking
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     * @returns {boolean} - Always returns false since fireboard doesn't block other handlers
     */
    async handleReactionRemove(reaction, user) {
        if (!fireboardSettings.enabled) return false;
        await this._processReactionChange(reaction, user, 'remove');
        return false; // Don't block other handlers
    }

    /**
     * Handle message deletions for fireboard tracking
     * @param {Message} message - The deleted message object
     */
    async handleMessageDelete(message) {
        if (!fireboardSettings.enabled) return;

        console.log(`\n=== Message Deleted ===`);
        console.log(`Message ID: ${message.id}`);
        console.log(`Checking for fireboard entry...`);

        const entry = await getEntry(message.id);
        if (entry) {
            console.log(`Found fireboard entry, removing from fireboard...`);
            await this.removeFireboardEntry(entry, 'original message deleted');
            console.log(`Successfully removed fireboard entry for deleted message ${message.id}`);
        } else {
            console.log(`No fireboard entry found for deleted message ${message.id}`);
        }

        console.log(`======================\n`);
    }

    /**
     * Process reaction changes (add/remove) for fireboard tracking
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     * @private
     */
    async _processReactionChange(reaction, user, action) {
        const message = reaction.message;

        // Prevent race conditions
        if (this.processingMessages.has(message.id)) {
            console.log(`Message ${message.id} is already being processed, skipping...`);
            return;
        }

        this.processingMessages.add(message.id);

        try {
            // Ensure we have fresh message data
            await safelyFetchMessage(message);

            const validReactions = await calculateValidReactions(message);

            // Log the reaction change
            this._logReactionChange(reaction, user, action, validReactions);

            // Check fireboard qualification
            await this._handleFireboardQualification(message, validReactions, action);

        } finally {
            this.processingMessages.delete(message.id);
        }
    }

    /**
     * Handle fireboard qualification checks and updates
     * @param {Message} message - Discord message
     * @param {Array} validReactions - Array of valid reaction objects
     * @param {string} action - 'add' or 'remove'
     * @private
     */
    async _handleFireboardQualification(message, validReactions, action) {
        const totalValidReactions = calculateTotalCount(validReactions);
        const existingEntry = await getEntry(message.id);

        if (totalValidReactions >= fireboardSettings.threshold) {
            if (!existingEntry && action === 'add') {
                // Message qualifies and doesn't exist on fireboard - add it
                await this.addToFireboard(message, validReactions);
            } else if (existingEntry) {
                // Message exists on fireboard - update it
                await this.updateFireboardEntry(message, existingEntry, validReactions);
            }
        } else if (existingEntry) {
            // Message no longer qualifies - remove it
            await this.removeFireboardEntry(existingEntry, 'below threshold');
            console.log(`Removed message ${message.id} from fireboard (below threshold)`);
        }
    }

    _logReactionChange(reaction, user, action, validReactions) {
        const totalReactions = calculateTotalCount(reaction.message.reactions.cache);
        const totalValidReactions = calculateTotalCount(validReactions);

        logReactionAction(action, reaction, user, reaction.message.author, totalReactions, totalValidReactions);

        if (validReactions.length > 0) {
            console.log(`Valid reactions breakdown:`);
            validReactions.forEach(r => {
                if (r.count > 0) console.log(`  ${r.emoji}: ${r.count}`);
            });
            console.log('');
        }
    }

    /**
     * Get list of valid reactions (public method)
     * @returns {Array} - Array of valid reaction strings
     */
    getValidReactionsList() {
        return [...this.fireboardSettings.validReactions];
    }

    async addToFireboard(message, validReactions) {
        // Double-check if entry already exists to prevent race conditions
        const existingEntry = await getEntry(message.id);
        if (existingEntry) {
            console.log(`Message ${message.id} already exists on fireboard, updating instead`);
            await this.updateFireboardEntry(message, existingEntry, validReactions);
            return true;
        }

        const fireboardChannel = await this.client.channels.fetch(fireboardSettings.channelId);
        if (!fireboardChannel) {
            console.error('Fireboard channel not found');
            return false;
        }

        // Generate and send the fireboard embed
        const embed = createFireboardEmbed(message, validReactions);
        const fireboardMessage = await fireboardChannel.send({ embeds: [embed] });

        // Calculate total valid reaction count
        const totalValidReactionCount = calculateTotalCount(validReactions);

        // Save to database
        const entry = await createEntry(
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
        const fireboardChannel = await this.client.channels.fetch(fireboardSettings.channelId);
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
        const totalValidReactionCount = calculateTotalCount(validReactions);
        await updateEntry(originalMessage.id, { validReactionCount: totalValidReactionCount });

        return true;
    }

    async removeFireboardEntry(entry, reason = 'threshold not met') {
        console.log(`Removing fireboard entry for message ${entry.messageId} (${reason})`);

        // Try to delete the fireboard message
        try {
            const fireboardChannel = await this.client.channels.fetch(fireboardSettings.channelId);
            if (fireboardChannel) {
                const fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
                await fireboardMessage.delete();
                console.log(`Deleted fireboard message ${entry.fireboardMessageId}`);
            }
        } catch (error) {
            console.log(`Fireboard message ${entry.fireboardMessageId} not found for deletion (may already be deleted)`);
        }

        // Remove from database
        const deleted = await deleteEntryObject(entry);
        if (deleted) {
            console.log(`Removed database entry for message ${entry.messageId}`);
        }

        return deleted;
    }

    async refreshAllEntries() {
        console.log('Refreshing all fireboard entries...');

        const entries = await getAllEntries();
        console.log(`Found ${entries.length} fireboard entries to refresh`);

        const fireboardChannel = await this.client.channels.fetch(fireboardSettings.channelId);
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
        const fireboardChannel = await this.client.channels.fetch(fireboardSettings.channelId);
        if (!fireboardChannel) return;

        const embed = createFireboardEmbed(originalMessage, validReactions);
        const newFireboardMessage = await fireboardChannel.send({ embeds: [embed] });

        // Calculate total valid reaction count
        const totalValidReactionCount = calculateTotalCount(validReactions);

        // Update the database with the new fireboard message ID and valid reaction count
        await updateEntry(entry.messageId, {
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
        await safelyFetchMessage(originalMessage);

        // Check if fireboard message still exists
        let fireboardMessage;
        try {
            fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
        } catch (error) {
            // Fireboard message doesn't exist, recreate it
            console.log(`Recreating missing fireboard message for ${entry.messageId}`);
            const validReactions = await calculateValidReactions(originalMessage);
            await this._recreateFireboardEntry(originalMessage, entry, validReactions);
            return 'refreshed';
        }

        // Update the existing fireboard message
        const validReactions = await calculateValidReactions(originalMessage);
        await this._updateFireboardMessage(originalMessage, fireboardMessage, validReactions);

        // Update the valid reaction count in the database
        const totalValidReactionCount = calculateTotalCount(validReactions);
        await updateEntry(originalMessage.id, { validReactionCount: totalValidReactionCount });

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
}

