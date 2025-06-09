const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder() // Command definition
        .setName('ping')
        .setDescription('pong'),
    async execute(interaction) { // Command functionality
        await interaction.reply(':ping_pong: Pong!');
    },
};
