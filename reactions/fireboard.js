const { validReactions, fireboardSettings } = require('../config');
const { ReactionUtils } = require('./utils/reactionUtils');
const { FireboardDatabase } = require('./utils/fireboardDatabase');
const { FireboardMessageManager } = require('./fireboardMessageManager');

/**
 * Handles fireboard functionality - tracking and logging reactions on messages
 * Focused on core reaction processing logic
 */
class Fireboard {
    constructor(client) {
        this.client = client;
        this.settings = fireboardSettings;
        this.validReactions = validReactions;
        this.messageManager = new FireboardMessageManager(client, fireboardSettings);
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
            await this.messageManager.refreshAllEntries();

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
            if (!this.settings.enabled) return false;
            await this._processReactionChange(reaction, user, 'add');
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
            if (!this.settings.enabled) return false;
            await this._processReactionChange(reaction, user, 'remove');
            return false; // Don't block other handlers
        } catch (error) {
            console.error('Error handling fireboard reaction remove:', error);
            return false;
        }
    }

    /**
     * Handle message deletions for fireboard tracking
     * @param {Message} message - The deleted message object
     */
    async handleMessageDelete(message) {
        try {
            if (!this.settings.enabled) return;

            console.log(`\n=== Message Deleted ===`);
            console.log(`Message ID: ${message.id}`);
            console.log(`Checking for fireboard entry...`);

            const entry = await FireboardDatabase.getEntry(message.id);
            if (entry) {
                console.log(`Found fireboard entry, removing from fireboard...`);
                await this.messageManager.removeFireboardEntry(entry, 'original message deleted');
                console.log(`Successfully removed fireboard entry for deleted message ${message.id}`);
            } else {
                console.log(`No fireboard entry found for deleted message ${message.id}`);
            }

            console.log(`======================\n`);
        } catch (error) {
            console.error('Error handling message delete for fireboard:', error);
        }
    }

    /**
     * Get fireboard statistics
     * @returns {Promise<Object>} - Statistics object
     */
    async getStats() {
        try {
            const dbStats = await FireboardDatabase.getStats();
            return {
                ...dbStats,
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
            await ReactionUtils.safelyFetchMessage(message);
            await ReactionUtils.safelyFetchReactions(message);

            const validReactions = await this._getValidReactions(message);

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
        const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);
        const existingEntry = await FireboardDatabase.getEntry(message.id);

        if (totalValidReactions >= this.settings.threshold) {
            if (!existingEntry && action === 'add') {
                // Message qualifies and doesn't exist on fireboard - add it
                await this.messageManager.addToFireboard(message, validReactions);
            } else if (existingEntry) {
                // Message exists on fireboard - update it
                await this.messageManager.updateFireboardEntry(message, existingEntry, validReactions);
            }
        } else if (existingEntry) {
            // Message no longer qualifies - remove it
            await this.messageManager.removeFireboardEntry(existingEntry, 'below threshold');
            console.log(`Removed message ${message.id} from fireboard (below threshold)`);
        }
    }

    /**
     * Get all valid reactions from a message
     * @param {Message} message - The Discord message object
     * @returns {Array} - Array of valid reaction objects
     * @private
     */
    async _getValidReactions(message) {
        const messageValidReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this._isValidReaction(emoji)) {
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

    /**
     * Check if a reaction emoji is in the valid reactions list
     * @param {string} emoji - The emoji to check
     * @returns {boolean} - Whether the emoji is valid
     * @private
     */
    _isValidReaction(emoji) {
        return this.validReactions.includes(emoji);
    }

    /**
     * Log reaction change details for debugging
     * @param {MessageReaction} reaction - Reaction object
     * @param {User} user - User who performed the action
     * @param {string} action - 'add' or 'remove'
     * @param {Array} validReactions - Array of valid reaction objects
     * @private
     */
    _logReactionChange(reaction, user, action, validReactions) {
        const totalReactions = reaction.message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
        const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);

        ReactionUtils.logReactionAction(action, reaction, user, {
            messageAuthor: reaction.message.author,
            totalReactions,
            validReactions: totalValidReactions
        });

        if (validReactions.length > 0) {
            console.log(`Valid reactions breakdown:`);
            validReactions.forEach(r => {
                console.log(`  ${r.emoji}: ${r.count}`);
            });
        }
    }

    /**
     * Get valid reactions for a message (public method)
     * @param {Message} message - The Discord message object
     * @param {boolean} excludeAuthor - Whether to exclude author reactions from count
     * @returns {Promise<Array>} - Array of valid reaction objects
     */
    async getValidReactions(message, excludeAuthor = null) {
        // Use setting if not explicitly specified
        const shouldExcludeAuthor = excludeAuthor !== null ? excludeAuthor : this.settings.excludeAuthorReactions;

        const messageValidReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this._isValidReaction(emoji)) {
                await reaction.users.fetch();
                let count = reaction.count;

                if (shouldExcludeAuthor &&
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

    /**
     * Get list of valid reactions (public method)
     * @returns {Array} - Array of valid reaction strings
     */
    getValidReactionsList() {
        return [...this.validReactions];
    }
}

module.exports = { Fireboard };
