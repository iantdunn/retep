const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ReactionManager } = require('../../utils/reactionManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactions')
        .setDescription('Manage and view reaction statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View reaction statistics for a message')
                .addStringOption(option =>
                    option
                        .setName('messageid')
                        .setDescription('The ID of the message to check')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('valid')
                .setDescription('View the list of valid reactions')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'stats':
                await handleStats(interaction);
                break;
            case 'valid':
                await handleValidList(interaction);
                break;
        }
    },
};

async function handleStats(interaction) {
    const messageId = interaction.options.getString('messageid');

    try {
        // Try to fetch the message
        const message = await interaction.channel.messages.fetch(messageId);

        if (!message) {
            return await interaction.reply({
                content: 'Message not found in this channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Calculate statistics
        const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);
        const validReactionsIncludingAuthor = await ReactionManager.getValidReactions(message, false);
        const totalValidReactions = await validReactionsIncludingAuthor.reduce((acc, r) => acc + r.count, 0);
        const validReactionsExcludingAuthor = await ReactionManager.getValidReactions(message, true);

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('📊 Message Reaction Statistics')
            .setColor(0x5865F2)
            .addFields([
                { name: 'Message ID', value: messageId },
                { name: 'Author', value: `${message.author.tag}` },
                { name: 'Total Reactions', value: totalReactions.toString() },
                { name: 'Valid Reactions', value: totalValidReactions.toString(), inline: true },
                { name: 'Valid (No Self-React)', value: validReactionsExcludingAuthor.reduce((acc, r) => acc + r.count, 0).toString(), inline: true },
                { name: 'Message Content', value: message.content.length > 0 ? message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '') : '*No text content*', inline: false }
            ]);

        // Add valid reactions breakdown if any exist
        if (validReactionsIncludingAuthor.length > 0) {
            const breakdown = validReactionsIncludingAuthor.map(r => `${r.emoji}: ${r.count}`).join('\n');
            embed.addFields([
                { name: 'Valid Reactions Breakdown', value: breakdown, inline: false }
            ]);
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    } catch (error) {
        console.error('Error fetching message stats:', error);
        await interaction.reply({
            content: 'Error: Could not fetch message. Make sure the message ID is correct and the message is in this channel.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleValidList(interaction) {
    const validReactions = ReactionManager.getValidReactionsList();

    const embed = new EmbedBuilder()
        .setTitle('Valid Reactions List')
        .setColor(0x57F287)
        .setDescription(validReactions.join(' '))
        .addFields([
            { name: 'Total Valid Reactions', value: validReactions.length.toString(), inline: true }
        ]);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
