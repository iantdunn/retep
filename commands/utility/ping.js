const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder() // Command definition
        .setName('ping')
        .setDescription('pong'),
    async execute(interaction) { // Command functionality
        const start = Date.now();
        await interaction.reply({ content: '__**:ping_pong: Ping...**__', flags: MessageFlags.Ephemeral });
        const end = Date.now();

        await interaction.editReply(`***:ping_pong: Pong!***\n\n**Roundtrip Latency:** ${end - start}ms\n**WebSocket Heartbeat:** ${interaction.client.ws.ping}ms`);
    },
};
