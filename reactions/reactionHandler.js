const { ReactionRoles } = require('./reactionRoles');
const { Fireboard } = require('./fireboard');

module.exports.ReactionHandler = class {
    constructor(client) {
        this.client = client;
        this.reactionRoles = new ReactionRoles(client);
        this.fireboard = new Fireboard(client);
    }

    async initialize() {
        console.log('Initializing Reaction Handler...');

        try {
            await this.reactionRoles.initialize();
            await this.fireboard.initialize();
            console.log('Reaction Handler initialized successfully');
        } catch (error) {
            console.error('Error initializing Reaction Handler:', error);
        }
    }

    async handleReactionAdd(reaction, user) {
        try {
            // Try reaction roles first
            const roleHandled = await this.reactionRoles.handleReactionAdd(reaction, user);

            // If not handled by reaction roles, try fireboard
            if (!roleHandled) {
                await this.fireboard.handleReactionAdd(reaction, user);
            }
        } catch (error) {
            console.error('Error handling reaction add:', error);
        }
    }

    async handleReactionRemove(reaction, user) {
        try {
            // Try reaction roles first
            const roleHandled = await this.reactionRoles.handleReactionRemove(reaction, user);

            // If not handled by reaction roles, try fireboard
            if (!roleHandled) {
                await this.fireboard.handleReactionRemove(reaction, user);
            }
        } catch (error) {
            console.error('Error handling reaction remove:', error);
        }
    }

    async handleMessageDelete(message) {
        try {
            await this.fireboard.handleMessageDelete(message);
        } catch (error) {
            console.error('Error handling message delete:', error);
        }
    }
}
