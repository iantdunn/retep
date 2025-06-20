const { Events } = require('discord.js');
const { ReactionManager } = require('../utils/reactionManager');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Initialize reaction manager (includes reaction roles)
        await ReactionManager.initialize(client);

        client.user.setActivity('S12 E19', { type: 'WATCHING' });

        // await client.user.setPresence({
        //     activities: [{ name: 'S12 E19', type: 'WATCHING' }],
        //     status: 'online'
        // });

        console.log('Set presence to "Watching S12 E19"');
    },
};