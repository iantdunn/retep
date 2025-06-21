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

            if (message.partial) {
                await message.fetch();
            }

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
                messageValidReactions.forEach(r => {
                    console.log(`  ${r.emoji}: ${r.count}`);
                });
            }

            console.log(`==================================\n`);

            // Check if message qualifies for fireboard
            if (action === 'add' && await this.messageQualifiesForFireboard(message)) {
                await this.addToFireboard(message);
            }

        } catch (error) {
            console.error('Error processing reaction tracking:', error);
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
            return await FireboardEntry.create({
                messageId,
                fireboardMessageId,
                authorId
            });
        } catch (error) {
            console.error('Error creating fireboard entry:', error);
            return null;
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
            const fireboardChannel = await this.client.channels.fetch(this.settings.channelId);
            if (!fireboardChannel) {
                console.error('Fireboard channel not found');
                return;
            }

            // Create basic fireboard message (you can enhance this later)
            const fireboardMessage = await fireboardChannel.send({
                content: `🔥 **Fireboard Entry** 🔥\nOriginal message by <@${message.author.id}> in <#${message.channel.id}>\n\n${message.content || '*No text content*'}\n\n[Jump to message](${message.url})`
            });

            // Save to database
            await this.createFireboardEntry(message.id, fireboardMessage.id, message.author.id);

            console.log(`Added message ${message.id} to fireboard as message ${fireboardMessage.id}`);
        } catch (error) {
            console.error('Error adding message to fireboard:', error);
        }
    }

    /**
     * Update an existing fireboard entry
     * @param {Message} originalMessage - The original message
     * @param {Message} fireboardMessage - The fireboard entry message
     */
    async updateFireboardEntry(originalMessage, fireboardMessage) {
        try {
            // TODO: Implement fireboard update logic
            // - Update reaction counts in embed
            // - Edit fireboard message
            console.log(`Would update fireboard entry for message ${originalMessage.id}`);
        } catch (error) {
            console.error('Error updating fireboard entry:', error);
        }
    }

    /**
     * Remove a message from the fireboard if it no longer qualifies
     * @param {Message} fireboardMessage - The fireboard entry message
     */
    async removeFromFireboard(fireboardMessage) {
        try {
            // TODO: Implement fireboard removal logic
            // - Delete fireboard message
            // - Remove from storage
            console.log(`Would remove fireboard entry`);
        } catch (error) {
            console.error('Error removing from fireboard:', error);
        }
    }
}

module.exports = { Fireboard };
