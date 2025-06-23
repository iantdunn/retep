/**
 * Utility class for calculating valid reactions with deduplication logic
 */
class ValidReactionCalculator {
    /**
     * Calculate valid reactions for a message, ensuring only one reaction per user is counted
     * @param {Message} message - Discord message object
     * @param {Array} validReactionEmojis - Array of valid reaction emoji strings
     * @param {boolean} excludeAuthor - Whether to exclude author reactions from count
     * @returns {Promise<Array>} - Array of valid reaction objects with deduplicated counts
     */
    static async calculateValidReactions(message, validReactionEmojis, excludeAuthor = false) {
        const messageValidReactions = [];
        const userReactionMap = new Map(); // Track which users have already been counted

        // First pass: collect all valid reactions and their users
        const validReactionData = [];
        for (const [emoji, reaction] of message.reactions.cache) {
            if (validReactionEmojis.includes(emoji)) {
                await reaction.users.fetch();
                validReactionData.push({
                    emoji: emoji,
                    reaction: reaction,
                    users: Array.from(reaction.users.cache.values())
                });
            }
        }

        // Second pass: count only the first valid reaction per user
        for (const reactionData of validReactionData) {
            let count = 0;

            for (const user of reactionData.users) {
                // Skip if user is the message author and we're excluding author reactions
                if (excludeAuthor &&
                    message.author &&
                    user.id === message.author.id) {
                    continue;
                }

                // Only count this reaction if the user hasn't been counted yet
                if (!userReactionMap.has(user.id)) {
                    userReactionMap.set(user.id, reactionData.emoji);
                    count++;
                }
            }

            messageValidReactions.push({
                emoji: reactionData.emoji,
                count: count
            });
        }

        return messageValidReactions;
    }

    /**
     * Calculate total valid reaction count from reaction array
     * @param {Array} validReactions - Array of valid reaction objects
     * @returns {number} - Total count
     */
    static calculateTotalCount(validReactions) {
        return validReactions.reduce((acc, r) => acc + r.count, 0);
    }
}

module.exports = { ValidReactionCalculator };
