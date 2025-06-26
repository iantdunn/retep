const { EmbedBuilder } = require('discord.js');

function createReactionRolesEmbed(roleEmojis) {
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

function createFireboardEmbed(message, validReactions) {
    const totalValidReactions = validReactions.reduce((acc, r) => acc + r.count, 0);

    // Create reaction display string
    const reactionDisplay = validReactions
        .filter(r => r.count > 0)
        .map(r => `${r.emoji} ${r.count}`)
        .join(' • ');

    const embed = {
        color: 0xFF4500, // Orange-red color for fire theme
        author: {
            name: message.author.displayName,
            icon_url: message.author.displayAvatarURL()
        },
        description: message.content || '*No text content*',
        fields: [
            {
                name: '🔥 Reactions',
                value: reactionDisplay || 'None',
                inline: true
            },
            {
                name: '🔗 Link',
                value: `${message.url}`,
                inline: true
            }
        ],
        footer: {
            text: `Total: ${totalValidReactions} reactions`,
        },
        timestamp: message.createdAt.toISOString()
    };

    // Add attachment information if message has attachments
    if (message.attachments.size > 0) {
        _addAttachmentFields(embed, message.attachments);
    }

    return embed;
}

/**
 * Add attachment fields to an embed
 * @param {Object} embed - Embed object to modify
 * @param {Collection} attachments - Discord attachments collection
 * @private
 */
function _addAttachmentFields(embed, attachments) {
    const attachmentArray = Array.from(attachments.values());
    const imageAttachment = attachmentArray.find(att =>
        att.contentType && att.contentType.startsWith('image/')
    );

    if (imageAttachment) {
        // Add image if it's an image attachment
        embed.image = { url: imageAttachment.url };
    } else {
        // For non-image attachments, show filename
        const attachmentNames = attachmentArray
            .map(att => att.name || 'Unknown file')
            .join(', ');

        embed.fields.push({
            name: '📎 Attachments',
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
            embed.fields.push({
                name: '📎 Other Attachments',
                value: otherAttachments,
                inline: false
            });
        }
    }
}

function createTextEmbed(text, color) {
    return new EmbedBuilder()
        .setDescription(text)
        .setColor(color);
}

module.exports = { createReactionRolesEmbed, createFireboardEmbed, createTextEmbed };