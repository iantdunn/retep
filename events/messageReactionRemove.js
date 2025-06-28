const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (reaction.partial)
            await reaction.fetch();

        const client = reaction.message.client;
        await client.reactionHandler.remove(reaction, user);
    },
};