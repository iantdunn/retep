const { fireboardSettings } = require('../config');
const { calculateValidReactions, calculateTotalCount } = require('../utils/reactionUtils');
const { getEntry, createEntry, updateEntry, deleteEntryObject, getAllEntries } = require('../utils/fireboardCrud');
const { createFireboardEmbed } = require('../utils/embeds');
const { fetchMessage } = require('../utils/guildUtils');

module.exports.Fireboard = class {
    constructor(client) {
        this.client = client;
        this.settings = fireboardSettings
        this.processingMessages = new Set(); // Track messages currently being processed
    }

    async initialize() {
        console.log('Initializing Fireboard');

        if (!fireboardSettings.enabled)
            throw new Error('Reaction tracking (Fireboard) is disabled in config');

        this.fireboardChannel = await this.client.channels.fetch(this.settings.channelId);

        // Refresh all fireboard entries on startup
        await this._refreshAllEntries();
    }

    async add(reaction, user) {
        if (!this.settings.enabled) return;
        await this.refreshMessage(reaction.message.channel.id, reaction.message.id);
    }

    async remove(reaction, user) {
        if (!this.settings.enabled) return;
        await this.refreshMessage(reaction.message.channel.id, reaction.message.id);
    }

    async delete(message) {
        if (!this.settings.enabled) return;

        if (message.channel.id === this.settings.channelId) return;

        console.log(`Message deleted with ID: ${message.id}`);

        const entry = await getEntry(message.id);
        if (entry) {
            await this._deleteFireboardEntry(message.id);
            console.log(`Successfully removed fireboard entry for deleted message ${message.id}`);
        } else {
            console.log(`No fireboard entry found for deleted message ${message.id}`);
        }
    }

    // TODO Do all error handling top level, public facing methods
    // Check fireboard channel exists, make sure is enabled
    async _refreshAllEntries() {
        console.log('Refreshing all fireboard entries');

        const entries = await getAllEntries();
        console.log(`Found ${entries.length} fireboard entries to refresh`);

        if (!this.fireboardChannel) {
            console.error('Fireboard channel not found during refresh');
            return;
        }

        let refreshed = 0;
        let removed = 0;

        for (const entry of entries) {
            try {
                const result = await this.refreshMessage(entry.channelId, entry.messageId);
                if (result === 'updated' || result === 'added') refreshed++;
                else if (result === 'deleted') removed++;
            } catch (error) {
                console.error(`Error refreshing entry ${entry.messageId}:`, error);
            }
        }

        console.log(`Fireboard refresh complete: ${refreshed} updated, ${removed} removed`);
    }

    async refreshMessage(channelId, messageId) {
        console.log(`Refreshing message ${messageId} in channel ${channelId}`);

        const message = await fetchMessage(this.client, channelId, messageId);
        const entry = await getEntry(messageId);

        if (entry && !message) {
            console.log(`Message ${messageId} not found, deleting fireboard entry`);
            await this._deleteFireboardEntry(messageId);
            return 'deleted';
        }

        if (!message) {
            console.log(`Message ${messageId} not found in channel ${channelId}`);
            return 'not found';
        }

        // Prevent race conditions
        if (this.processingMessages.has(messageId)) {
            console.log(`Message ${messageId} is already being processed, skipping...`);
            return 'skipped';
        } else {
            this.processingMessages.add(messageId);
        }

        let status;
        try {
            const validReactions = await calculateValidReactions(message);
            const totalValidReactions = calculateTotalCount(validReactions);

            if (totalValidReactions >= fireboardSettings.threshold) { // Eligible for fireboard
                if (entry) {
                    // Update existing entry
                    await this._updateFireboardEntry(message, validReactions);
                    status = 'updated';
                } else {
                    // Create new entry
                    await this._addFireboardEntry(message, validReactions);
                    status = 'added';
                }
            } else { // Not eligible for fireboard
                if (entry) {
                    // Delete existing entry
                    await this._deleteFireboardEntry(message.id);
                    status = 'deleted';
                } else {
                    console.log(`Message ${message.id} not eligible for fireboard.`);
                    status = 'not eligible';
                }
            }
        } finally {
            this.processingMessages.delete(messageId);
        }

        return status;
    }

    async _addFireboardEntry(message, validReactions) {
        const totalValidReactionCount = calculateTotalCount(validReactions);
        const embed = createFireboardEmbed(message, validReactions);
        const fireboardMessage = await this.fireboardChannel.send({ embeds: [embed] });

        await createEntry(
            message.id,
            message.channel.id,
            fireboardMessage.id,
            message.author.id,
            totalValidReactionCount
        );

        console.log(`Added message ${message.id} to fireboard as message ${fireboardMessage.id}`);
    }

    async _updateFireboardEntry(message, validReactions) {
        const entry = await getEntry(message.id);
        const totalValidReactionCount = calculateTotalCount(validReactions);

        let fireboardMessage;
        try {
            fireboardMessage = await this.fireboardChannel.messages.fetch(entry.fireboardMessageId);
            const embed = createFireboardEmbed(message, validReactions);
            await fireboardMessage.edit({ embeds: [embed] });
            console.log(`Updated fireboard channel message for message ${message.id} as message ${fireboardMessage.id}`);
        } catch (error) {
            // Fireboard message doesn't exist, recreate it
            const embed = createFireboardEmbed(message, validReactions);
            fireboardMessage = await this.fireboardChannel.send({ embeds: [embed] });
            console.log(`Recreated fireboard channel message for message ${message.id} as message ${fireboardMessage.id}`);
        } finally {
            // Update the database entry
            await updateEntry(entry.id, { channelId: message.channel.id, validReactionCount: totalValidReactionCount, fireboardMessageId: fireboardMessage.id });
            console.log(`Updated fireboard entry for message ${message.id} as message ${fireboardMessage.id}.`);
        }
    }

    async _deleteFireboardEntry(messageId) {
        const entry = await getEntry(messageId);

        // Try to delete the fireboard message
        try {
            const fireboardMessage = await this.fireboardChannel.messages.fetch(entry.fireboardMessageId);
            await fireboardMessage.delete();
            console.log(`Deleted fireboard message ${entry.fireboardMessageId}`);
        } catch (error) {
            console.log(`Fireboard message ${entry.fireboardMessageId} not found for deletion (may already be deleted)`);
        }

        // Remove from database
        await deleteEntryObject(entry);
    }
}
