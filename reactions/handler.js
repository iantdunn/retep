const { ReactionRoles } = require('./roles');
const { Fireboard } = require('./fireboard');

// Top level error handling
module.exports.ReactionHandler = class {
    constructor(client) {
        this.client = client;
        this.roles = new ReactionRoles(client);
        this.fireboard = new Fireboard(client);
    }

    async initialize() {
        console.log('Initializing Reaction Handler');

        try {
            await this.roles.initialize();

        } catch (error) {
            console.error('Error initializing Reaction Handler:', error);
        }

        try {
            await this.fireboard.initialize();
        } catch (error) {
            console.error('Error initializing Fireboard:', error);
        }
    }

    async add(reaction, user) {
        console.log(`Reaction added: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);

        // Try reaction roles first
        const roleHandled = await this.roles.reactionAdd(reaction, user);

        // If not handled by reaction roles, try fireboard
        if (!roleHandled)
            await this.fireboard.add(reaction, user);
    }

    async remove(reaction, user) {
        console.log(`Reaction removed: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);

        // Try reaction roles first
        const roleHandled = await this.roles.reactionRemove(reaction, user);

        // If not handled by reaction roles, try fireboard
        if (!roleHandled)
            await this.fireboard.remove(reaction, user);
    }
}
