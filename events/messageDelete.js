const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // When a message is deleted, check if it was on the fireboard
        // Only process if we have a valid message ID
        if (message.id && message.client.reactionHandler && message.client.reactionHandler.fireboard) {
            await message.client.reactionHandler.fireboard.handleMessageDelete(message);
        }
    },
};
