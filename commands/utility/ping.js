const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder() // Command definition
        .setName('ping')
        .setDescription('pong'),
    async execute(interaction) { // Command functionality
        const start = Date.now();
        await interaction.reply({ content: ':ping_pong: Ping...', flags: MessageFlags.Ephemeral });
        const end = Date.now();

        await interaction.editReply(`:ping_pong: Pong!\n\nRoundtrip Latency: ${end - start}ms\nWebSocket Heartbeat: ${interaction.client.ws.ping}ms`);
    },
};
