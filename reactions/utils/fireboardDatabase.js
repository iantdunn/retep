const { FireboardEntry } = require('../../database');

class FireboardDatabase {
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

    static async deleteEntryObject(entry) {
        try {
            await entry.destroy();
            return true;
        } catch (error) {
            console.error('Error deleting fireboard entry object:', error);
            return false;
        }
    }

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
}

module.exports = { FireboardDatabase };
