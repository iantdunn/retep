const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (reaction.partial)
            await reaction.fetch();

        const client = reaction.message.client;
        await client.reactionHandler.add(reaction, user);
    },
};