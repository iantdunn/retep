const { discordGuildId } = require('../config.js');

module.exports.fetchChannel = async function (client, channelId) {
    const guild = client.guilds.cache.get(discordGuildId);

    try {
        return await guild.channels.cache.get(channelId);
    } catch (error) {
        return null;
    }
};

module.exports.fetchMessage = async function (client, channelId, messageId) {
    const guild = client.guilds.cache.get(discordGuildId);
    const channel = await module.exports.fetchChannel(client, channelId);

    // Backup to allow message id to be provided without channel id
    let message;
    if (!channel) {
        for (const [, cacheChannel] of guild.channels.cache) {
            if (!cacheChannel.isTextBased()) continue;

            try {
                message = await cacheChannel.messages.fetch(messageId);
                channel = cacheChannel; // Set channel if found
                console.log(`Searched and found message ${messageId} in channel ${cacheChannel.id}`);
            } catch (error) {
                // Message not in this channel, continue
            }
        }
    }

    try {
        if (!message)
            message = await channel.messages.fetch(messageId);

        if (!message) {
            console.error(`Message with ID ${messageId} not found in channel ${channelId}.`);
            return null;
        }

        if (message.partial) await message.fetch();

        for (const [, reaction] of message.reactions.cache)
            if (reaction.partial)
                await reaction.fetch();

        return message;
    } catch (error) {
        console.error(`Message with ID ${messageId} not found in any channel or could not be fetched.`, error);
        return null;
    }
};

module.exports.fetchAuthorNickname = async function (client, authorId) {
    const guild = client.guilds.cache.get(discordGuildId);

    try {
        const member = await guild.members.fetch(authorId);
        return member.nickname || member.user.displayName;
    } catch (error) {
        console.error(`Error fetching member ${authorId}:`, error);
        return null;
    }
}