const { discordGuildId } = require('../config.js');

module.exports.fetchMessage = async (client, channelId, messageId) => {
    const guild = client.guilds.cache.get(discordGuildId);

    const channel = guild.channels.cache.get(channelId);
    if (!channel) { // TODO remove once check has occurred in prod
        for (const [, channel] of guild.channels.cache) {
            if (channel.isTextBased()) {
                try {
                    return await channel.messages.fetch(messageId);
                } catch (error) {
                    // Message not in this channel, continue
                }
            }
        }
        throw new Error(`Channel with ID ${channelId} not found.`);
    }

    let message;
    try {
        message = await channel.messages.fetch(messageId);
    } catch (error) {
        return null;
    }

    if (message.partial) {
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