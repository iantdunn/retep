const { Events } = require('discord.js');

// TODO this will probably never be needed, but just in case
module.exports = {
    name: Events.MessageBulkDelete,
    async execute(messages) {
        // When messages are bulk deleted, check if any were on the fireboard
        if (messages.first() && messages.first().client.reactionHandler && messages.first().client.reactionHandler.fireboard) {
            const fireboard = messages.first().client.reactionHandler.fireboard;

            console.log(`\n=== Bulk Message Delete ===`);
            console.log(`${messages.size} messages were bulk deleted`);

            let removedCount = 0;

            for (const [messageId, message] of messages) {
                try {
                    const entry = await fireboard.getFireboardEntry(messageId);
                    if (entry) {
                        await fireboard.removeFireboardEntryCompletely(entry, 'bulk message delete');
                        removedCount++;
                        console.log(`Removed fireboard entry for bulk deleted message ${messageId}`);
                    }
                } catch (error) {
                    console.error(`Error handling bulk delete for message ${messageId}:`, error);
                }
            }

            console.log(`Removed ${removedCount} fireboard entries from bulk delete`);
            console.log(`===========================\n`);
        }
    },
};
