const { EmbedBuilder, Events } = require('discord.js');
const config = require('../config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // Check if welcome messages are enabled
        if (!config.welcomeSettings.welcomeEnabled) {
            return;
        }

        // Get the welcome channel
        const channel = member.guild.channels.cache.get(config.welcomeSettings.channelId);
        if (!channel) {
            console.error('Welcome channel not found. Please check your channel ID in config.js');
            return;
        } try {
            // Get current member count
            const memberCount = member.guild.memberCount;

            // Create welcome embed with description only
            const welcomeEmbed = new EmbedBuilder()
                .setDescription(`Welcome to The Peter Griffins, ${member.user}! There are now ${memberCount} users.`)
                .setColor(0x00ff00); // Green color

            // Send the welcome message
            await channel.send({ embeds: [welcomeEmbed] });

            console.log(`Welcome message sent for ${member.user.tag} in ${member.guild.name}`);
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    },
};
