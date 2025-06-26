class ReactionUtils {

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

    static extractEmojiId(emojiStr) {
        const match = emojiStr.match(/<:.+?:(\d+)>/);
        return match ? match[1] : emojiStr;
    }

    static emojisMatch(emoji1, emoji2) {
        return this.extractEmojiId(emoji1) === this.extractEmojiId(emoji2);
    }

    static reactionExists(message, emojiStr) {
        const emojiId = this.extractEmojiId(emojiStr);
        const existingReactions = Array.from(message.reactions.cache.keys());

        return existingReactions.some(existing => {
            const existingId = this.extractEmojiId(existing);
            return existingId === emojiId;
        });
    }

    static async addReaction(message, emoji) {
        try {
            await message.react(emoji);
            console.log(`Added reaction: ${emoji}`);

            return true;
        } catch (error) {
            console.error(`Failed to add reaction ${emoji}:`, error);
            return false;
        }
    }

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

    static logReactionAction(action, reaction, user, additionalInfo = {}) {
        console.log(`\n=== Reaction ${action.toUpperCase()} ===`);
        console.log(`Message ID: ${reaction.message.id}`);
        console.log(`User: ${user.displayName} (${user.id})`);
        console.log(`Reaction: ${reaction.emoji}`);

        if (additionalInfo.messageAuthor) {
            console.log(`Message Author: ${additionalInfo.messageAuthor.displayName} (${additionalInfo.messageAuthor.id})`);
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
