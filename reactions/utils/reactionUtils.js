/**
 * Common utility functions for reaction handling
 */
class ReactionUtils {
    /**
     * Add a delay between operations to avoid rate limits
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise} - Promise that resolves after delay
     */
    static delay(ms = 250) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Safely fetch a message, handling partials and errors
     * @param {Message} message - Message to fetch
     * @returns {Promise<Message|null>} - Fetched message or null
     */
    static async safelyFetchMessage(message) {
        try {
            if (message.partial) {
                await message.fetch();
            }
            return message;
        } catch (error) {
            console.error('Error fetching message:', error);
            return null;
        }
    }

    /**
     * Safely fetch all reactions on a message
     * @param {Message} message - Message to fetch reactions for
     * @returns {Promise<boolean>} - Success status
     */
    static async safelyFetchReactions(message) {
        try {
            for (const [, reaction] of message.reactions.cache) {
                if (reaction.partial) {
                    await reaction.fetch();
                }
            }
            return true;
        } catch (error) {
            console.error('Error fetching reactions:', error);
            return false;
        }
    }

    /**
     * Check if an emoji string matches another emoji (handles custom emojis)
     * @param {string} emoji1 - First emoji string
     * @param {string} emoji2 - Second emoji string
     * @returns {boolean} - Whether emojis match
     */
    static emojisMatch(emoji1, emoji2) {
        // For custom emojis, extract the ID
        const extractId = (emoji) => {
            const match = emoji.match(/<:.+?:(\d+)>/);
            return match ? match[1] : emoji;
        };

        return extractId(emoji1) === extractId(emoji2);
    }

    /**
     * Extract emoji ID from custom emoji string
     * @param {string} emojiStr - Emoji string
     * @returns {string} - Emoji ID or original string for standard emojis
     */
    static extractEmojiId(emojiStr) {
        const match = emojiStr.match(/<:.+?:(\d+)>/);
        return match ? match[1] : emojiStr;
    }

    /**
     * Check if a reaction already exists on a message
     * @param {Message} message - Discord message
     * @param {string} emojiStr - Emoji string to check
     * @returns {boolean} - Whether reaction exists
     */
    static reactionExists(message, emojiStr) {
        const emojiId = this.extractEmojiId(emojiStr);
        const existingReactions = Array.from(message.reactions.cache.keys());

        return existingReactions.some(existing => {
            const existingId = this.extractEmojiId(existing);
            return existingId === emojiId;
        });
    }

    /**
     * Add a reaction to a message with error handling and rate limiting
     * @param {Message} message - Message to add reaction to
     * @param {string} emoji - Emoji to add
     * @param {boolean} withDelay - Whether to add delay after reaction
     * @returns {Promise<boolean>} - Success status
     */
    static async addReaction(message, emoji, withDelay = true) {
        try {
            await message.react(emoji);
            console.log(`Added reaction: ${emoji}`);

            if (withDelay) {
                await this.delay(250);
            }

            return true;
        } catch (error) {
            console.error(`Failed to add reaction ${emoji}:`, error);
            return false;
        }
    }

    /**
     * Remove a reaction from a message with error handling
     * @param {MessageReaction} reaction - Reaction to remove
     * @param {User} user - User to remove reaction for (optional, defaults to bot)
     * @returns {Promise<boolean>} - Success status
     */
    static async removeReaction(reaction, user = null) {
        try {
            if (user) {
                await reaction.users.remove(user);
            } else {
                await reaction.users.remove(reaction.message.client.user);
            }
            console.log(`Removed reaction: ${reaction.emoji}`);
            return true;
        } catch (error) {
            console.error(`Failed to remove reaction ${reaction.emoji}:`, error);
            return false;
        }
    }

    /**
     * Get user-friendly display name for logging
     * @param {User} user - Discord user
     * @returns {string} - Display name with tag
     */
    static getUserDisplayName(user) {
        return `${user.displayName || user.username} (${user.tag})`;
    }

    /**
     * Check if a user is a bot
     * @param {User} user - Discord user
     * @returns {boolean} - Whether user is a bot
     */
    static isBot(user) {
        return user.bot;
    }

    /**
     * Validate that required objects exist
     * @param {Object} objects - Object with named references to check
     * @returns {Object} - Validation result with missing items
     */
    static validateObjects(objects) {
        const missing = [];

        for (const [name, obj] of Object.entries(objects)) {
            if (!obj) {
                missing.push(name);
            }
        }

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Log reaction action details for debugging
     * @param {string} action - Action being performed
     * @param {MessageReaction} reaction - Reaction object
     * @param {User} user - User performing action
     * @param {Object} additionalInfo - Additional info to log
     */
    static logReactionAction(action, reaction, user, additionalInfo = {}) {
        console.log(`\n=== Reaction ${action.toUpperCase()} ===`);
        console.log(`Message ID: ${reaction.message.id}`);
        console.log(`User: ${this.getUserDisplayName(user)} (${user.id})`);
        console.log(`Reaction: ${reaction.emoji}`);

        if (additionalInfo.messageAuthor) {
            console.log(`Message Author: ${this.getUserDisplayName(additionalInfo.messageAuthor)} (${additionalInfo.messageAuthor.id})`);
        }

        if (additionalInfo.totalReactions !== undefined) {
            console.log(`Total reactions: ${additionalInfo.totalReactions}`);
        }

        if (additionalInfo.validReactions !== undefined) {
            console.log(`Valid reactions: ${additionalInfo.validReactions}`);
        }

        console.log(`===============================\n`);
    }
}

module.exports = { ReactionUtils };
