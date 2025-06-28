const { EmbedBuilder } = require('discord.js');

module.exports.createReactionRolesEmbed = function (roleEmojis) {
    const embed = new EmbedBuilder()
        .setTitle('Reaction Roles')
        .setDescription('React to this message to give yourself a role. In addition to being pingable, roles will unlock game-specific text channels.')
        .setColor('#42f5f5');

    const roleDescriptions = [];
    for (const [emoji, roleId] of Object.entries(roleEmojis)) {
        roleDescriptions.push(`${emoji} - <@&${roleId}>`);
    }

    if (roleDescriptions.length > 0) {
        embed.addFields({
            name: 'Available Roles',
            value: roleDescriptions.join('\n'),
            inline: false
        });
    } else {
        embed.addFields({
            name: 'Available Roles',
            value: 'No roles configured',
            inline: false
        });
    }

    return embed;
}

module.exports.createFireboardEmbed = function (message, validReactions, authorNickname) {
    // Create reaction display string
    const reactionDisplay = validReactions
        .filter(r => r.count > 0)
        .map(r => `${r.emoji} ${r.count}`)
        .join(' • ');

    const embed = new EmbedBuilder()
        .setColor(0xFF4500) // Orange-red color for fire theme
        .setAuthor({ name: authorNickname || message.author.displayName, iconURL: message.author.displayAvatarURL() })
        .addFields(
            { name: 'Reactions', value: reactionDisplay || 'None', inline: true },
            { name: 'Link', value: `${message.url}`, inline: true }
        )
        .setTimestamp(message.createdAt);

    // Add description only if message content exists
    if (message.content) embed.setDescription(message.content);

    // Add attachment information if message has attachments
    if (message.attachments.size == 0) return embed;

    const attachmentArray = Array.from(message.attachments.values());
    const imageAttachment = attachmentArray.find(att =>
        att.contentType && att.contentType.startsWith('image/')
    );

    if (imageAttachment) {
        // Add image if it's an image attachment
        embed.setImage(imageAttachment.url);
    } else {
        // For non-image attachments, show filename
        const attachmentNames = attachmentArray
            .map(att => att.name || 'Unknown file')
            .join(', ');

        embed.addFields({
            name: 'Attachments',
            value: attachmentNames,
            inline: false
        });
    }

    // If there are multiple attachments and we showed an image, also list other files
    if (imageAttachment && attachmentArray.length > 1) {
        const otherAttachments = attachmentArray
            .filter(att => att !== imageAttachment)
            .map(att => att.name || 'Unknown file')
            .join(', ');

        if (otherAttachments) {
            embed.addFields({
                name: 'Other Attachments',
                value: otherAttachments,
                inline: false
            });
        }
    }

    return embed;
}

module.exports.createTextEmbed = function (text, color) {
    return new EmbedBuilder()
        .setDescription(text)
        .setColor(color);
}
