const { Events, ActivityType } = require('discord.js');
const { ReactionHandler } = require('../reactions/reactionHandler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Initialize reaction handler instance and attach to client
        client.reactionHandler = new ReactionHandler(client);
        await client.reactionHandler.initialize();

        client.user.setActivity('Family Guy S12 E19', { type: ActivityType.Watching });
    },
};