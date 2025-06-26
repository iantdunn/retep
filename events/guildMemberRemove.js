const { Events } = require('discord.js');
const { createTextEmbed } = require('../utils/embeds.js');
const { welcomeSettings } = require('../config.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        // Check if goodbye messages are enabled
        if (!welcomeSettings.goodbyeEnabled) {
            return;
        }

        // Get the goodbye channel
        const channel = member.guild.channels.cache.get(welcomeSettings.channelId);
        if (!channel) {
            console.error('Goodbye channel not found. Please check your channel ID in config.js');
            return;
        }

        // Get current member count (after the member left)
        const memberCount = member.guild.memberCount;

        const goodbyeEmbed = createTextEmbed(
            `**${member.user.tag}** has left the server. There are now ${memberCount} users.`,
            0xff0000
        );
        await channel.send({ embeds: [goodbyeEmbed] });

        console.log(`Goodbye message sent for ${member.user.tag} in ${member.guild.name}`);
    },
};
