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

    const message = await channel.messages.fetch(messageId);
    if (!message) {
        throw new Error(`Message with ID ${messageId} not found.`);
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