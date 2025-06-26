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
