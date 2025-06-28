const { Events, ActivityType } = require('discord.js');
const { ReactionHandler } = require('../reactions/handler');
const { initializeDatabase } = require('../database');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        await initializeDatabase();

        // Initialize reaction handler instance and attach to client
        client.reactionHandler = new ReactionHandler(client);
        await client.reactionHandler.initialize();

        client.user.setActivity('Family Guy S12 E19', { type: ActivityType.Watching });

        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};