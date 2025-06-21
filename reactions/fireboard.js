const { validReactions, fireboardSettings } = require('../config');
const { FireboardEntry } = require('../database');

/**
 * Handles fireboard functionality - tracking and logging reactions on messages
 * This system tracks valid reactions and provides statistics
 */
class Fireboard {

    constructor(client) {
        this.client = client;
        this.settings = fireboardSettings;
        this.validReactions = validReactions;
        this.fireboardEntries = new Map(); // Store fireboard entries for tracking
        this.processingMessages = new Set(); // Track messages currently being processed
    }

    /**
     * Initialize fireboard system on bot startup
     */
    async initialize() {
        try {
            console.log('Initializing Fireboard...');

            if (!this.settings.enabled) {
                console.log('Reaction tracking (Fireboard) is disabled in config');
                return;
            }

            // Refresh all fireboard entries on startup
            await this.refreshAllFireboardEntries();

            console.log('Fireboard initialized successfully');
        } catch (error) {
            console.error('Error initializing Fireboard:', error);
        }
    }

    /**
     * Handle reaction additions for fireboard tracking
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @returns {boolean} - Always returns false since fireboard doesn't block other handlers
     */
    async handleReactionAdd(reaction, user) {
        try {
            if (!this.settings.enabled) {
                return false;
            }

            await this.processReactionTracking(reaction, user, 'add');
            return false; // Don't block other handlers
        } catch (error) {
            console.error('Error handling fireboard reaction add:', error);
            return false;
        }
    }

    /**
     * Handle reaction removals for fireboard tracking
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     * @returns {boolean} - Always returns false since fireboard doesn't block other handlers
     */
    async handleReactionRemove(reaction, user) {
        try {
            if (!this.settings.enabled) {
                return false;
            }

            await this.processReactionTracking(reaction, user, 'remove');
            return false; // Don't block other handlers
        } catch (error) {
            console.error('Error handling fireboard reaction remove:', error);
            return false;
        }
    }

    /**
     * Process and log reaction statistics for a message
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     */
    async processReactionTracking(reaction, user, action) {
        try {
            const message = reaction.message;

            // Always fetch the message to ensure we have the latest content and reactions
            await message.fetch();

            // Also fetch all reactions to ensure we have complete reaction data
            for (const [, messageReaction] of message.reactions.cache) {
                if (messageReaction.partial) {
                    await messageReaction.fetch();
                }
            }

            // Prevent race conditions by checking if this message is already being processed
            if (this.processingMessages.has(message.id)) {
                console.log(`Message ${message.id} is already being processed, skipping...`);
                return;
            }

            // Lock this message for processing
            this.processingMessages.add(message.id);

            try {
                const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
                const messageValidReactions = await this.getValidReactions(message, false);
                const messageValidReactionsExcludingAuthor = await this.getValidReactions(message, true);

                console.log(`\n=== Fireboard Reaction Update ===`);
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
                    messageValidReactionsExcludingAuthor.forEach(r => {
                        console.log(`  ${r.emoji}: ${r.count}`);
                    });
                }

                console.log(`==================================\n`);            // Check if message qualifies for fireboard
                if (action === 'add' && await this.messageQualifiesForFireboard(message)) {
                    await this.addToFireboard(message);
                } else if (action === 'remove') {
                    // Check if message needs to be removed from fireboard
                    await this.checkAndRemoveFromFireboard(message);
                }

                // Update existing fireboard entry if it exists
                const existingEntry = await this.getFireboardEntry(message.id);
                if (existingEntry) {
                    await this.updateExistingFireboardEntry(message, existingEntry);
                }
            } finally {
                // Always unlock the message when done processing
                this.processingMessages.delete(message.id);
            }

        } catch (error) {
            console.error('Error processing reaction tracking:', error);
            // Make sure to unlock the message even if there's an error
            if (reaction.message && reaction.message.id) {
                this.processingMessages.delete(reaction.message.id);
            }
        }
    }

    /**
     * Check if a reaction emoji is in the valid reactions list
     * @param {string} emoji - The emoji to check
     * @returns {boolean} - Whether the emoji is valid
     */
    isValidReaction(emoji) {
        return this.validReactions.includes(emoji);
    }

    /**
     * Get all valid reactions from a message
     * @param {Message} message - The Discord message object
     * @param {boolean} excludeAuthorReactions - Whether to exclude reactions made by the message author
     * @returns {Array} - Array of valid reaction objects
     */
    async getValidReactions(message, excludeAuthorReactions = true) {
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

    /**
     * Get the list of valid reactions
     * @returns {Array} - Array of valid reaction emojis
     */
    getValidReactionsList() {
        return [...this.validReactions];
    }

    /**
     * Check if a message is already on the fireboard
     * @param {string} messageId - The Discord message ID
     * @returns {Promise<FireboardEntry|null>} - The fireboard entry or null
     */
    async getFireboardEntry(messageId) {
        try {
            return await FireboardEntry.findOne({
                where: { messageId }
            });
        } catch (error) {
            console.error('Error getting fireboard entry:', error);
            return null;
        }
    }

    /**
     * Create a new fireboard entry in the database
     * @param {string} messageId - The original message ID
     * @param {string} fireboardMessageId - The fireboard message ID
     * @param {string} authorId - The original message author ID
     * @returns {Promise<FireboardEntry|null>} - The created entry or null
     */
    async createFireboardEntry(messageId, fireboardMessageId, authorId) {
        try {
            // Use findOrCreate to handle race conditions
            const [entry, created] = await FireboardEntry.findOrCreate({
                where: { messageId },
                defaults: {
                    messageId,
                    fireboardMessageId,
                    authorId
                }
            });

            if (!created) {
                console.log(`Fireboard entry for message ${messageId} already exists`);
            }

            return entry;
        } catch (error) {
            // Handle specific unique constraint errors
            if (error.name === 'SequelizeUniqueConstraintError') {
                console.log(`Unique constraint violation for message ${messageId}, entry likely already exists`);
                // Try to find the existing entry
                try {
                    return await FireboardEntry.findOne({ where: { messageId } });
                } catch (findError) {
                    console.error('Error finding existing fireboard entry:', findError);
                    return null;
                }
            } else {
                console.error('Error creating fireboard entry:', error);
                return null;
            }
        }
    }

    /**
     * Delete a fireboard entry from the database
     * @param {string} messageId - The original message ID
     * @returns {Promise<boolean>} - Success status
     */
    async deleteFireboardEntry(messageId) {
        try {
            const result = await FireboardEntry.destroy({
                where: { messageId }
            });
            return result > 0;
        } catch (error) {
            console.error('Error deleting fireboard entry:', error);
            return false;
        }
    }    /**
     * Check if a message meets the threshold for fireboard
     * @param {Message} message - The Discord message object
     * @returns {boolean} - Whether the message should be on the fireboard
     */
    async messageQualifiesForFireboard(message) {
        try {
            if (!this.settings.enabled) return false;

            // Check if already on fireboard
            const existingEntry = await this.getFireboardEntry(message.id);
            if (existingEntry) return false; // Already on fireboard

            // Get valid reactions count
            const validReactions = await this.getValidReactions(message, this.settings.excludeAuthorReactions);
            const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);

            return totalValidReactions >= this.settings.threshold;
        } catch (error) {
            console.error('Error checking fireboard qualification:', error);
            return false;
        }
    }    /**
     * Add a message to the fireboard
     * @param {Message} message - The Discord message object
     */
    async addToFireboard(message) {
        try {
            // Double-check if entry already exists to prevent race conditions
            const existingEntry = await this.getFireboardEntry(message.id);
            if (existingEntry) {
                console.log(`Message ${message.id} already exists on fireboard, updating instead`);
                await this.updateExistingFireboardEntry(message, existingEntry);
                return;
            }

            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) {
                console.error('Fireboard channel not found');
                return;
            }

            // Generate the fireboard embed
            const embed = await this.generateFireboardEmbed(message);
            if (!embed) {
                console.error('Failed to generate fireboard embed');
                return;
            }

            // Send the fireboard message with embed only (no content)
            const fireboardMessage = await fireboardChannel.send({ embeds: [embed] });

            // Save to database using findOrCreate to handle race conditions
            const entry = await this.createFireboardEntry(message.id, fireboardMessage.id, message.author.id);

            if (entry) {
                console.log(`Added message ${message.id} to fireboard as message ${fireboardMessage.id}`);
            } else {
                console.log(`Failed to create database entry for message ${message.id}, but fireboard message was sent`);
            }
        } catch (error) {
            console.error('Error adding message to fireboard:', error);
        }
    }

    /**
     * Generate a fireboard embed for a message
     * @param {Message} message - The Discord message object
     * @returns {Object} - Discord embed object
     */
    async generateFireboardEmbed(message) {
        try {
            const validReactions = await this.getValidReactions(message, this.settings.excludeAuthorReactions);
            const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);

            // Create reaction display string
            const reactionDisplay = validReactions
                .filter(r => r.count > 0)
                .map(r => `${r.emoji} ${r.count}`)
                .join(' • ');

            const embed = {
                color: 0xFF4500, // Orange-red color for fire theme
                author: {
                    name: message.author.displayName || message.author.username,
                    icon_url: message.author.displayAvatarURL()
                },
                description: message.content || '*No text content*',
                fields: [
                    {
                        name: '🔥 Reactions',
                        value: reactionDisplay || 'None',
                        inline: true
                    },
                    {
                        name: '🔗 Link',
                        value: `${message.url}`,
                        inline: true
                    }
                ],
                footer: {
                    text: `Total: ${totalValidReactions} reactions`,
                },
                timestamp: message.createdAt.toISOString()
            };

            // Add attachment information if message has attachments
            if (message.attachments.size > 0) {
                const attachments = Array.from(message.attachments.values());
                const imageAttachment = attachments.find(att =>
                    att.contentType && att.contentType.startsWith('image/')
                );

                if (imageAttachment) {
                    // Add image if it's an image attachment
                    embed.image = { url: imageAttachment.url };
                } else {
                    // For non-image attachments or if image can't be displayed, show filename
                    const attachmentNames = attachments
                        .map(att => att.name || 'Unknown file')
                        .join(', ');

                    embed.fields.push({
                        name: '📎 Attachments',
                        value: attachmentNames,
                        inline: false
                    });
                }

                // If there are multiple attachments and we showed an image, also list other files
                if (imageAttachment && attachments.length > 1) {
                    const otherAttachments = attachments
                        .filter(att => att !== imageAttachment)
                        .map(att => att.name || 'Unknown file')
                        .join(', ');

                    if (otherAttachments) {
                        embed.fields.push({
                            name: '📎 Other Attachments',
                            value: otherAttachments,
                            inline: false
                        });
                    }
                }
            }

            return embed;
        } catch (error) {
            console.error('Error generating fireboard embed:', error);
            return null;
        }
    }

    /**
     * Refresh all fireboard entries on bot startup
     */
    async refreshAllFireboardEntries() {
        try {
            console.log('Refreshing all fireboard entries...');

            // Get all fireboard entries from database
            const entries = await FireboardEntry.findAll();
            console.log(`Found ${entries.length} fireboard entries to refresh`);

            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) {
                console.error('Fireboard channel not found during refresh');
                return;
            }

            let refreshed = 0;
            let removed = 0;

            for (const entry of entries) {
                try {
                    // Try to fetch the original message
                    const originalMessage = await this.fetchMessageById(entry.messageId);
                    if (!originalMessage) {
                        // Original message no longer exists, remove from fireboard
                        await this.removeFireboardEntryCompletely(entry);
                        removed++;
                        continue;
                    }

                    // Check if fireboard message still exists
                    let fireboardMessage;
                    try {
                        fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
                    } catch (error) {
                        // Fireboard message doesn't exist, recreate it
                        console.log(`Recreating missing fireboard message for ${entry.messageId}`);
                        await this.recreateFireboardEntry(originalMessage, entry);
                        refreshed++;
                        continue;
                    }

                    // Update the existing fireboard message
                    await this.updateFireboardMessage(originalMessage, fireboardMessage);
                    refreshed++;

                } catch (error) {
                    console.error(`Error refreshing entry ${entry.messageId}:`, error);
                }
            }

            console.log(`Fireboard refresh complete: ${refreshed} updated, ${removed} removed`);
        } catch (error) {
            console.error('Error refreshing fireboard entries:', error);
        }
    }

    /**
     * Fetch a message by ID from any channel the bot has access to
     * @param {string} messageId - The message ID to fetch
     * @returns {Promise<Message|null>} - The message or null if not found
     */
    async fetchMessageById(messageId) {
        try {
            // Try to find the message in all cached channels
            for (const [, guild] of this.client.guilds.cache) {
                for (const [, channel] of guild.channels.cache) {
                    if (channel.isTextBased()) {
                        try {
                            const message = await channel.messages.fetch(messageId);
                            return message;
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
     * Recreate a fireboard entry when the original fireboard message is missing
     * @param {Message} originalMessage - The original message
     * @param {FireboardEntry} entry - The database entry
     */
    async recreateFireboardEntry(originalMessage, entry) {
        try {
            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) return;

            const embed = await this.generateFireboardEmbed(originalMessage);
            if (!embed) return;

            const newFireboardMessage = await fireboardChannel.send({ embeds: [embed] });

            // Update the database with the new fireboard message ID
            await entry.update({ fireboardMessageId: newFireboardMessage.id });

            console.log(`Recreated fireboard entry for message ${originalMessage.id}`);
        } catch (error) {
            console.error('Error recreating fireboard entry:', error);
        }
    }

    /**
     * Update an existing fireboard message with current reaction data
     * @param {Message} originalMessage - The original message
     * @param {Message} fireboardMessage - The fireboard message to update
     */
    async updateFireboardMessage(originalMessage, fireboardMessage) {
        try {
            const embed = await this.generateFireboardEmbed(originalMessage);
            if (!embed) return;

            await fireboardMessage.edit({ embeds: [embed] });
        } catch (error) {
            console.error('Error updating fireboard message:', error);
        }
    }

    /**
     * Check if a message should be removed from fireboard and remove it if necessary
     * @param {Message} message - The Discord message object
     */
    async checkAndRemoveFromFireboard(message) {
        try {
            const entry = await this.getFireboardEntry(message.id);
            if (!entry) return; // Not on fireboard

            // Check if message still qualifies (ignoring the "already exists" check)
            const validReactions = await this.getValidReactions(message, this.settings.excludeAuthorReactions);
            const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);

            if (totalValidReactions < this.settings.threshold) {
                await this.removeFireboardEntryCompletely(entry);
                console.log(`Removed message ${message.id} from fireboard (below threshold)`);
            }
        } catch (error) {
            console.error('Error checking fireboard removal:', error);
        }
    }

    /**
     * Update an existing fireboard entry with new reaction data
     * @param {Message} originalMessage - The original message
     * @param {FireboardEntry} entry - The database entry
     */
    async updateExistingFireboardEntry(originalMessage, entry) {
        try {
            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) return;

            let fireboardMessage;
            try {
                fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
            } catch (error) {
                // Fireboard message doesn't exist, recreate it
                await this.recreateFireboardEntry(originalMessage, entry);
                return;
            }

            await this.updateFireboardMessage(originalMessage, fireboardMessage);
        } catch (error) {
            console.error('Error updating existing fireboard entry:', error);
        }
    }

    /**
     * Completely remove a fireboard entry (both message and database record)
     * @param {FireboardEntry} entry - The database entry to remove
     */
    async removeFireboardEntryCompletely(entry) {
        try {
            // Try to delete the fireboard message
            try {
                const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
                if (fireboardChannel) {
                    const fireboardMessage = await fireboardChannel.messages.fetch(entry.fireboardMessageId);
                    await fireboardMessage.delete();
                }
            } catch (error) {
                // Message might already be deleted, that's fine
                console.log(`Fireboard message ${entry.fireboardMessageId} not found for deletion`);
            }

            // Remove from database
            await entry.destroy();
        } catch (error) {
            console.error('Error removing fireboard entry completely:', error);
        }
    }

    /**
     * Get all fireboard entries from the database
     * @param {number} limit - Maximum number of entries to return (optional)
     * @returns {Promise<Array>} - Array of fireboard entries
     */
    async getAllFireboardEntries(limit = null) {
        try {
            const options = {
                order: [['createdAt', 'DESC']]
            };

            if (limit) {
                options.limit = limit;
            }

            return await FireboardEntry.findAll(options);
        } catch (error) {
            console.error('Error getting all fireboard entries:', error);
            return [];
        }
    }

    /**
     * Get fireboard statistics
     * @returns {Promise<Object>} - Statistics object
     */
    async getFireboardStats() {
        try {
            const totalEntries = await FireboardEntry.count();
            const recentEntries = await FireboardEntry.count({
                where: {
                    createdAt: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            });

            return {
                totalEntries,
                recentEntries,
                threshold: this.settings.threshold,
                enabled: this.settings.enabled
            };
        } catch (error) {
            console.error('Error getting fireboard stats:', error);
            return {
                totalEntries: 0,
                recentEntries: 0,
                threshold: this.settings.threshold,
                enabled: this.settings.enabled
            };
        }
    }

}

module.exports = { Fireboard };
