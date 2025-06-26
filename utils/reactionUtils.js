const { fireboardSettings } = require('../config.js');

module.exports.calculateValidReactions = async function (message) {
    const messageValidReactions = [];
    const userReactionMap = new Map(); // Track which users have already been counted

    // First pass: collect all valid reactions and their users
    const validReactionData = [];
    for (const [emoji, reaction] of message.reactions.cache) {
        if (fireboardSettings.validReactions.includes(emoji)) {
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
            if (fireboardSettings.excludeAuthorReactions &&
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

        if (count === 0) continue; // Skip if no valid reactions
        messageValidReactions.push({
            emoji: reactionData.emoji,
            count: count
        });
    }

    return messageValidReactions;
}

module.exports.calculateTotalCount = function (validReactions) {
    return validReactions.reduce((acc, r) => acc + r.count, 0);
}

module.exports.safelyFetchMessage = async function (message) {
    try {
        if (message.partial) {
            await message.fetch();
        }

        for (const [, reaction] of message.reactions.cache) {
            if (reaction.partial) {
                await reaction.fetch();
            }
        }

        return message;
    } catch (error) {
        console.error('Error fetching message:', error);
        return null;
    }
}

function extractEmojiId(emojiStr) {
    const match = emojiStr.match(/<:.+?:(\d+)>/);
    return match ? match[1] : emojiStr;
}

module.exports.emojisMatch = function (emoji1, emoji2) {
    return extractEmojiId(emoji1) === extractEmojiId(emoji2);
}

module.exports.reactionExists = function (message, emojiStr) {
    const emojiId = extractEmojiId(emojiStr);
    const existingReactions = Array.from(message.reactions.cache.keys());

    return existingReactions.some(existing => {
        const existingId = extractEmojiId(existing);
        return existingId === emojiId;
    });
}

module.exports.logReactionAction = function (action, reaction, user, author, totalReactions, validReactions) {
    console.log(`\n=== Reaction ${action.toUpperCase()} ===`);
    console.log(`Message ID: ${reaction.message.id}`);
    console.log(`User: ${user.displayName} (${user.id})`);
    console.log(`Reaction: ${reaction.emoji}`);
    console.log(`Message Author: ${author.displayName} (${author.id})`);
    console.log(`Total reactions: ${totalReactions}`);
    console.log(`Valid reactions: ${validReactions}`);
    console.log(`===============================\n`);
}
