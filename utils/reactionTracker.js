const config = require('../config');

class ReactionTracker {
    /**
     * Check if a reaction emoji is in the valid reactions list
     * @param {string} emoji - The emoji to check
     * @returns {boolean} - Whether the emoji is valid
     */
    static isValidReaction(emoji) {
        return config.validReactions.includes(emoji);
    }

    /**
     * Get all valid reactions from a message
     * @param {Message} message - The Discord message object
     * @returns {Array} - Array of valid reaction objects
     */
    static getValidReactions(message) {
        const validReactions = [];

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this.isValidReaction(emoji)) {
                validReactions.push({
                    emoji: emoji,
                    count: reaction.count,
                    users: reaction.users.cache
                });
            }
        }

        return validReactions;
    }

    /**
     * Count valid reactions excluding the message author
     * @param {Message} message - The Discord message object
     * @returns {number} - Count of valid reactions excluding author
     */
    static async getValidReactionsExcludingAuthor(message) {
        let validReactionCount = 0;

        for (const [emoji, reaction] of message.reactions.cache) {
            if (this.isValidReaction(emoji)) {
                // Fetch all users who reacted with this emoji
                const users = await reaction.users.fetch();

                // Count reactions excluding the message author
                const nonAuthorReactions = users.filter(user =>
                    user.id !== message.author.id
                ).size;

                validReactionCount += nonAuthorReactions;
            }
        }

        return validReactionCount;
    }

    /**
     * Process and log reaction statistics for a message
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     * @param {string} action - 'add' or 'remove'
     */
    static async processReactionUpdate(reaction, user, action) {
        try {
            const message = reaction.message;

            // Ensure the message is fully fetched
            if (message.partial) {
                await message.fetch();
            }

            // Calculate statistics
            const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
            const validReactions = this.getValidReactions(message);
            const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);
            const validReactionsExcludingAuthor = await this.getValidReactionsExcludingAuthor(message);            // Log the statistics
            if (config.reactionSettings.logToConsole) {
                console.log(`\n=== Message Reaction Update ===`);
                console.log(`Action: ${action}`);
                console.log(`Message ID: ${message.id}`);
                console.log(`Message Author: ${message.author.tag} (${message.author.id})`);
                console.log(`User who reacted: ${user.tag} (${user.id})`);
                console.log(`Reaction: ${reaction.emoji}`);
                console.log(`Total reactions: ${totalReactions}`);
                console.log(`Total valid reactions: ${totalValidReactions}`);
                console.log(`Valid reactions (excluding author): ${validReactionsExcludingAuthor}`);

                // Log breakdown of valid reactions
                if (validReactions.length > 0) {
                    console.log(`Valid reactions breakdown:`);
                    validReactions.forEach(r => {
                        console.log(`  ${r.emoji}: ${r.count}`);
                    });
                }

                console.log(`===============================\n`);
            }
        } catch (error) {
            console.error('Error processing reaction update:', error);
        }
    }

    /**
     * Get the list of valid reactions
     * @returns {Array} - Array of valid reaction emojis
     */
    static getValidReactionsList() {
        return [...config.validReactions];
    }
}

module.exports = { ReactionTracker };
