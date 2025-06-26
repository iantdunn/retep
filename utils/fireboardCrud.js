const { FireboardEntry } = require('../database');

module.exports.getEntry = async (messageId) => {
    try {
        return await FireboardEntry.findOne({
            where: { messageId }
        });
    } catch (error) {
        console.error('Error getting fireboard entry:', error);
        return null;
    }
}

module.exports.createEntry = async (messageId, fireboardMessageId, authorId, validReactionCount = 0) => {
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

module.exports.updateEntry = async (messageId, updates) => {
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

module.exports.getAllEntries = async (limit = null) => {
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

module.exports.deleteEntryObject = async (entry) => {
    try {
        await entry.destroy();
        return true;
    } catch (error) {
        console.error('Error deleting fireboard entry object:', error);
        return false;
    }
}
