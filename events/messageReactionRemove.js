const { Events } = require('discord.js');
const { ReactionTracker } = require('../utils/reactionTracker');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        // When a reaction is received, check if the structure is partial
        if (reaction.partial) {
            // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                // Return as `reaction.message.author` may be undefined/null
                return;
            }
        }

        // Process the reaction update using the reaction tracker
        await ReactionTracker.processReactionUpdate(reaction, user, 'remove');
    },
};