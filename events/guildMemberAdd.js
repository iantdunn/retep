const { Events } = require('discord.js');
const { createTextEmbed } = require('../utils/embeds.js');
const { welcomeSettings } = require('../config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // Check if welcome messages are enabled
        if (!welcomeSettings.welcomeEnabled) {
            return;
        }

        // Get the welcome channel
        const channel = member.guild.channels.cache.get(welcomeSettings.channelId);
        if (!channel) {
            console.error('Welcome channel not found. Please check your channel ID in config.js');
            return;
        }

        // Get current member count
        const memberCount = member.guild.memberCount;

        const welcomeEmbed = createTextEmbed(
            `Welcome to ${member.guild.name}, ${member.user}! There are now ${memberCount} users.`,
            0x00ff00
        );
        await channel.send({ embeds: [welcomeEmbed] });

        console.log(`Welcome message sent for ${member.user.tag} in ${member.guild.name}`);
    },
};
