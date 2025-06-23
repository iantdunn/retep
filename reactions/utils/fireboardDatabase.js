const { FireboardEntry } = require('../../database');

/**
 * Database operations utility for fireboard functionality
 */
class FireboardDatabase {
    /**
     * Get a fireboard entry by message ID
     * @param {string} messageId - The Discord message ID
     * @returns {Promise<FireboardEntry|null>} - The fireboard entry or null
     */
    static async getEntry(messageId) {
        try {
            return await FireboardEntry.findOne({
                where: { messageId }
            });
        } catch (error) {
            console.error('Error getting fireboard entry:', error);
            return null;
        }
    }

    /**
     * Create a new fireboard entry
     * @param {string} messageId - The original message ID
     * @param {string} fireboardMessageId - The fireboard message ID
     * @param {string} authorId - The original message author ID
     * @param {number} validReactionCount - The total count of valid reactions
     * @returns {Promise<FireboardEntry|null>} - The created entry or null
     */
    static async createEntry(messageId, fireboardMessageId, authorId, validReactionCount = 0) {
        try {
            // Use findOrCreate to handle race conditions
            const [entry, created] = await FireboardEntry.findOrCreate({
                where: { messageId },
                defaults: {
                    messageId,
                    fireboardMessageId,
                    authorId,
                    validReactionCount
                }
            });

            if (!created) {
                console.log(`Fireboard entry for message ${messageId} already exists`);
            }

            return entry;
        } catch (error) {
            // Handle specific unique constraint errors
            if (error.name === 'SequelizeUniqueConstraintError') {
                console.log(`Unique constraint violation for message ${messageId}, entry likely already exists`);
                // Try to find the existing entry
                try {
                    return await this.getEntry(messageId);
                } catch (findError) {
                    console.error('Error finding existing fireboard entry:', findError);
                    return null;
                }
            } else {
                console.error('Error creating fireboard entry:', error);
                return null;
            }
        }
    }

    /**
     * Update a fireboard entry
     * @param {string} messageId - The original message ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>} - Success status
     */
    static async updateEntry(messageId, updates) {
        try {
            const [updatedRowsCount] = await FireboardEntry.update(updates, {
                where: { messageId }
            });
            return updatedRowsCount > 0;
        } catch (error) {
            console.error('Error updating fireboard entry:', error);
            return false;
        }
    }

    /**
     * Delete a fireboard entry
     * @param {string} messageId - The original message ID
     * @returns {Promise<boolean>} - Success status
     */
    static async deleteEntry(messageId) {
        try {
            const result = await FireboardEntry.destroy({
                where: { messageId }
            });
            return result > 0;
        } catch (error) {
            console.error('Error deleting fireboard entry:', error);
            return false;
        }
    }

    /**
     * Get all fireboard entries
     * @param {number} limit - Maximum number of entries to return (optional)
     * @returns {Promise<Array>} - Array of fireboard entries
     */
    static async getAllEntries(limit = null) {
        try {
            const options = {
                order: [['createdAt', 'DESC']]
            };

            if (limit) {
                options.limit = limit;
            }

            return await FireboardEntry.findAll(options);
        } catch (error) {
            console.error('Error getting all fireboard entries:', error);
            return [];
        }
    }

    /**
     * Get fireboard statistics
     * @returns {Promise<Object>} - Statistics object
     */
    static async getStats() {
        try {
            const totalEntries = await FireboardEntry.count();
            const recentEntries = await FireboardEntry.count({
                where: {
                    createdAt: {
                        [require('sequelize').Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            });

            return {
                totalEntries,
                recentEntries
            };
        } catch (error) {
            console.error('Error getting fireboard stats:', error);
            return {
                totalEntries: 0,
                recentEntries: 0
            };
        }
    }

    /**
     * Delete an entry by its database object
     * @param {FireboardEntry} entry - The database entry object
     * @returns {Promise<boolean>} - Success status
     */
    static async deleteEntryObject(entry) {
        try {
            await entry.destroy();
            return true;
        } catch (error) {
            console.error('Error deleting fireboard entry object:', error);
            return false;
        }
    }

    /**
     * Check if an entry exists
     * @param {string} messageId - The message ID to check
     * @returns {Promise<boolean>} - Whether entry exists
     */
    static async entryExists(messageId) {
        try {
            const entry = await this.getEntry(messageId);
            return entry !== null;
        } catch (error) {
            console.error('Error checking if fireboard entry exists:', error);
            return false;
        }
    }

    /**
     * Update the valid reaction count for a fireboard entry
     * @param {string} messageId - The original message ID
     * @param {number} validReactionCount - The new valid reaction count
     * @returns {Promise<boolean>} - Success status
     */
    static async updateValidReactionCount(messageId, validReactionCount) {
        try {
            const [updatedRowsCount] = await FireboardEntry.update(
                { validReactionCount },
                { where: { messageId } }
            );
            return updatedRowsCount > 0;
        } catch (error) {
            console.error('Error updating valid reaction count:', error);
            return false;
        }
    }

    /**
     * Get the current valid reaction count for an entry
     * @param {string} messageId - The message ID to check
     * @returns {Promise<number|null>} - The current count or null if not found
     */
    static async getValidReactionCount(messageId) {
        try {
            const entry = await this.getEntry(messageId);
            return entry ? entry.validReactionCount : null;
        } catch (error) {
            console.error('Error getting valid reaction count:', error);
            return null;
        }
    }

    /**
     * Increment the valid reaction count for an entry
     * @param {string} messageId - The message ID
     * @param {number} increment - The amount to increment by (default 1)
     * @returns {Promise<boolean>} - Success status
     */
    static async incrementValidReactionCount(messageId, increment = 1) {
        try {
            const [updatedRowsCount] = await FireboardEntry.update(
                {
                    validReactionCount: require('sequelize').literal(`validReactionCount + ${increment}`)
                },
                { where: { messageId } }
            );
            return updatedRowsCount > 0;
        } catch (error) {
            console.error('Error incrementing valid reaction count:', error);
            return false;
        }
    }

    /**
     * Decrement the valid reaction count for an entry
     * @param {string} messageId - The message ID
     * @param {number} decrement - The amount to decrement by (default 1)
     * @returns {Promise<boolean>} - Success status
     */
    static async decrementValidReactionCount(messageId, decrement = 1) {
        try {
            const [updatedRowsCount] = await FireboardEntry.update(
                {
                    validReactionCount: require('sequelize').literal(`CASE WHEN validReactionCount >= ${decrement} THEN validReactionCount - ${decrement} ELSE 0 END`)
                },
                { where: { messageId } }
            );
            return updatedRowsCount > 0;
        } catch (error) {
            console.error('Error decrementing valid reaction count:', error);
            return false;
        }
    }
}

module.exports = { FireboardDatabase };
