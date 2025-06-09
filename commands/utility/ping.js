const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder() // Command definition
        .setName('ping')
        .setDescription('pong'),
    async execute(interaction) { // Command functionality
        const sent = await interaction.reply({ content: ':ping_pong: Ping...', flags: MessageFlags.Ephemeral })
        interaction.editReply(`:ping_pong: Pong!\nRoundtrip latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms`);
    },
};
