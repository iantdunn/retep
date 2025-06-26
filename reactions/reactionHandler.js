const { ReactionRoles } = require('./reactionRoles');
const { Fireboard } = require('./fireboard');

/**
 * Main reaction handler that delegates to appropriate modules
 * This is the interface that other parts of the bot will use
 */
class ReactionHandler {
    constructor(client) {
        this.client = client;
        this.reactionRoles = new ReactionRoles(client);
        this.fireboard = new Fireboard(client);
    }

    /**
     * Initialize all reaction systems on bot startup
     */
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

    /**
     * Main handler for reaction additions
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who reacted
     */
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

    /**
     * Main handler for reaction removals
     * @param {MessageReaction} reaction - The reaction object
     * @param {User} user - The user who removed the reaction
     */
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

    /**
     * Handle message deletions
     * @param {Message} message - The deleted message
     */
    async handleMessageDelete(message) {
        try {
            await this.fireboard.handleMessageDelete(message);
        } catch (error) {
            console.error('Error handling message delete:', error);
        }
    }
}

module.exports = { ReactionHandler };
