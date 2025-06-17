module.exports = {
    // Valid reactions configuration
    validReactions: [
        '👍', '👎', '❤️', '😂', '😮', '😢', '😡',
        '⭐', '🔥', '💯', '✅', '❌', '🎉', '👏'
    ],

    // Reaction tracking settings
    reactionSettings: {
        // Whether to log reaction updates to console
        logToConsole: true,

        // Whether to prevent self-reactions from counting
        excludeAuthorReactions: true
    }
};
