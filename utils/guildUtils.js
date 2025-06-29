const { discordGuildId } = require('../config.js');

module.exports.fetchMessage = async (client, channelId, messageId) => {
    const guild = client.guilds.cache.get(discordGuildId);
    const channelCache = guild.channels.cache;

    let message;
    try {
        const channel = channelCache.get(channelId);
        message = await channel.messages.fetch(messageId);
    } catch (error) {
        // Backup to allow message id to be provided without channel id
        for (const [, channelCacheMember] of channelCache) {
            if (!channelCacheMember.isTextBased()) continue;

            try {
                message = await channelCacheMember.messages.fetch(messageId);
                console.log(`Searched and found message ${messageId} in channel ${channelCacheMember.id}`);
            } catch (error) {
                // Message not in this channel, continue
            }
        }
    }

    if (!message) {
        console.error(`Message with ID ${messageId} not found in any channel.`);
        return null;
    } else if (message.partial) {
        await message.fetch();
    }

    for (const [, reaction] of message.reactions.cache) {
        if (reaction.partial) {
            await reaction.fetch();
        }
    }

    return message;
}

module.exports.fetchAuthorNickname = async (client, authorId) => {
    const guild = client.guilds.cache.get(discordGuildId);

    try {
        const member = await guild.members.fetch(authorId);
        return member.nickname || member.user.displayName;
    } catch (error) {
        console.error(`Error fetching member ${authorId}:`, error);
        return null;
    }
}