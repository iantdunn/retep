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

        await this.roles.initialize();
        await this.fireboard.initialize();
    }

    async add(reaction, user) {
        // Try reaction roles first
        const roleHandled = await this.roles.reactionAdd(reaction, user);

        // If not handled by reaction roles, try fireboard
        if (!roleHandled)
            await this.fireboard.add(reaction, user);
    }

    async remove(reaction, user) {
        // Try reaction roles first
        const roleHandled = await this.roles.reactionRemove(reaction, user);

        // If not handled by reaction roles, try fireboard
        if (!roleHandled)
            await this.fireboard.remove(reaction, user);
    }

    async delete(message) {
        await this.fireboard.delete(message);
    }
}
