const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fireboard')
        .setDescription('Manage the fireboard')
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Refreshes a message\'s status on the fireboard.')
                .addStringOption(option =>
                    option
                        .setName('message_id')
                        .setDescription('The ID of the message to query.')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'refresh':
                const messageId = interaction.options.getString('message_id');
                const status = await interaction.client.reactionHandler.fireboard.refreshMessage(null, messageId);
                return interaction.reply({ content: `Message ${messageId} was ${status}.`, flags: MessageFlags.Ephemeral });
        }
    },
};