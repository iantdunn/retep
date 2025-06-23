const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ValidReactionCalculator } = require('../../reactions/utils/validReactionCalculator');

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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Manually add an existing message to the fireboard')
                .addStringOption(option =>
                    option
                        .setName('messageid')
                        .setDescription('The ID of the message to add to the fireboard')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel containing the message (optional, defaults to current channel)')
                        .setRequired(false)
                )
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
            case 'add':
                await handleAdd(interaction);
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
        const fireboard = interaction.client.reactionHandler?.fireboard;

        if (!fireboard) {
            return await interaction.reply({
                content: 'Fireboard system is not available.',
                flags: MessageFlags.Ephemeral
            });
        }

        const validReactionsIncludingAuthor = await fireboard.getValidReactions(message, false);
        const totalValidReactions = ValidReactionCalculator.calculateTotalCount(validReactionsIncludingAuthor);
        const validReactionsExcludingAuthor = await fireboard.getValidReactions(message, true);

        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('📊 Message Reaction Statistics')
            .setColor(0x5865F2)
            .addFields([
                { name: 'Message ID', value: messageId },
                { name: 'Author', value: `${message.author.tag}` },
                { name: 'Total Reactions', value: totalReactions.toString() },
                { name: 'Valid Reactions', value: totalValidReactions.toString(), inline: true },
                { name: 'Valid (No Self-React)', value: ValidReactionCalculator.calculateTotalCount(validReactionsExcludingAuthor).toString(), inline: true },
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
    const fireboard = interaction.client.reactionHandler?.fireboard;

    if (!fireboard) {
        return await interaction.reply({
            content: 'Fireboard system is not available.',
            flags: MessageFlags.Ephemeral
        });
    }

    const validReactions = fireboard.getValidReactionsList();

    const embed = new EmbedBuilder()
        .setTitle('Valid Reactions List')
        .setColor(0x57F287)
        .setDescription(validReactions.join(' '))
        .addFields([
            { name: 'Total Valid Reactions', value: validReactions.length.toString(), inline: true }
        ]); await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleAdd(interaction) {
    const messageId = interaction.options.getString('messageid');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    try {
        // Check if fireboard system is available
        const fireboard = interaction.client.reactionHandler?.fireboard;
        if (!fireboard) {
            return await interaction.reply({
                content: 'Fireboard system is not available.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if fireboard is enabled
        if (!fireboard.settings.enabled) {
            return await interaction.reply({
                content: 'Fireboard system is currently disabled.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Fetch the target message
        const message = await targetChannel.messages.fetch(messageId);
        if (!message) {
            return await interaction.reply({
                content: `Message not found in ${targetChannel.name}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if message is already on fireboard
        const { FireboardDatabase } = require('../../reactions/utils/fireboardDatabase');
        const existingEntry = await FireboardDatabase.getEntry(messageId);
        if (existingEntry) {
            return await interaction.reply({
                content: 'This message is already on the fireboard.',
                flags: MessageFlags.Ephemeral
            });
        }

        // Fetch reactions and process the message
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Ensure message data is fresh
        const { ReactionUtils } = require('../../reactions/utils/reactionUtils');
        await ReactionUtils.safelyFetchMessage(message);
        await ReactionUtils.safelyFetchReactions(message);

        // Get valid reactions using fireboard's public method        
        const validReactions = await fireboard.getValidReactions(message, true);

        // Use setting default for exclusion
        const totalValidReactions = ValidReactionCalculator.calculateTotalCount(validReactions);

        if (totalValidReactions < fireboard.settings.threshold) {
            return await interaction.editReply({
                content: `This message has ${totalValidReactions} valid reactions, but the fireboard threshold is ${fireboard.settings.threshold}. Cannot add to fireboard.`
            });
        }

        // Add to fireboard
        const success = await fireboard.messageManager.addToFireboard(message, validReactions);

        if (success) {
            await interaction.editReply({
                content: '✅ Message successfully added to fireboard!'
            });
        } else {
            await interaction.editReply({
                content: 'Failed to add message to fireboard. Please check the logs for more details.'
            });
        }

    } catch (error) {
        console.error('Error in handleAdd:', error);

        const errorMessage = error.message.includes('Unknown Message')
            ? `Message not found. Make sure the message ID is correct and exists in ${targetChannel.name}.`
            : 'An error occurred while trying to add the message to the fireboard.';

        if (interaction.deferred) {
            await interaction.editReply({ content: errorMessage });
        } else {
            await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
        }
    }
}
