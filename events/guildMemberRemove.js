const { EmbedBuilder, Events } = require('discord.js');
const config = require('../config.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        // Check if goodbye messages are enabled
        if (!config.welcomeSettings.goodbyeEnabled) {
            return;
        }

        // Get the goodbye channel
        const channel = member.guild.channels.cache.get(config.welcomeSettings.channelId);
        if (!channel) {
            console.error('Goodbye channel not found. Please check your channel ID in config.js');
            return;
        } try {
            // Get current member count (after the member left)
            const memberCount = member.guild.memberCount;

            // Create goodbye embed with description only
            const goodbyeEmbed = new EmbedBuilder()
                .setDescription(`**${member.user.tag}** has left the server. There are now ${memberCount} users.`)
                .setColor(0xff0000); // Red color

            // Send the goodbye message
            await channel.send({ embeds: [goodbyeEmbed] });

            console.log(`Goodbye message sent for ${member.user.tag} in ${member.guild.name}`);
        } catch (error) {
            console.error('Error sending goodbye message:', error);
        }
    },
};
