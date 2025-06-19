const { channelLink } = require("discord.js");

module.exports = {
    validReactions: [
        '👍', '👎', '❤️', '😂', '😮', '😢', '😡',
        '⭐', '🔥', '💯', '✅', '❌', '🎉', '👏'
    ],

    reactionSettings: {
        channelId: '1381413895083921449', // retep-training
        excludeAuthorReactions: true
    },

    welcomeSettings: {
        channelId: '1305933207551868981', // hello-goodbye
        welcomeEnabled: true,
        goodbyeEnabled: true
    },

    reactionRoleSettings: {
        channelId: '1381413895083921449', // retep-training
        messageId: '1385077601428705280', // Will be set when message is sent
        enabled: true,
        roleEmojis: {
            '<:2k:1305928096570146896>': '1304863176843726898',
            '<:cod:1305928215780528221>': '1304863365008719923',
            '<:cs:1318786650603524117>': '1318786120028262452',
            '<:rivals:1330054566271782975>': '1330053670532022304',
            '<:league:1372716757911081080>': '1372715813764599818',
            //'<:minecraft:1373442462772629607>': '1373441879584014496',
        }
    }
};
