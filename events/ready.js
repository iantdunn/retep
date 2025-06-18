const { Events } = require('discord.js');
const { ReactionManager } = require('../utils/reactionManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Initialize reaction manager (includes reaction roles)
        await ReactionManager.initialize(client);
    },
};