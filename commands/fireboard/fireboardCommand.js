const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { fireboardSettings } = require('../../config.js');

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
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reactions')
                .setDescription('View the current valid reactions to qualify for the fireboard.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'refresh':
                const messageId = interaction.options.getString('message_id');
                const status = await interaction.client.reactionHandler.fireboard.refreshMessage(null, messageId);
                return interaction.reply({
                    content: `Message ${messageId} was ${status}.`,
                    flags: MessageFlags.Ephemeral
                });
            case 'reactions':
                if (!fireboardSettings.enabled) {
                    return interaction.reply({
                        content: '🚫 Fireboard is currently disabled.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                return interaction.reply({
                    content: `**Fireboard Channel:** <#${fireboardSettings.channelId}>\n**Current Valid Reactions:** ${fireboardSettings.validReactions.join(', ')}\n**Reaction Threshold:** ${fireboardSettings.threshold}\n**Author (self) Reactions:** ${fireboardSettings.excludeAuthorReactions ? 'Disabled' : 'Enabled'}`,
                    flags: MessageFlags.Ephemeral
                });
        }
    },
};