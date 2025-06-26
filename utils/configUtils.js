const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.js');

/**
 * Load the current configuration
 * @returns {Object} - Current configuration object
 */
function loadConfig() {
    try {
        // Clear require cache to get fresh config
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
    } catch (error) {
        console.error('Error loading config file:', error);
        return null;
    }
}

/**
 * Save configuration object back to file
 * @param {Object} config - Configuration object to save
 * @returns {boolean} - Success status
 */
function saveConfig(config) {
    try {
        const configString = `module.exports = ${JSON.stringify(config, null, 4)};`;
        fs.writeFileSync(configPath, configString, 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving config file:', error);
        return false;
    }
}

/**
 * Update a specific field in a configuration section
 * @param {string} section - Configuration section name
 * @param {string} field - Field name within the section
 * @param {*} value - New value for the field
 * @returns {boolean} - Success status
 */
function updateConfigField(section, field, value) {
    try {
        const config = loadConfig();
        if (!config) {
            return false;
        }

        if (!config[section]) {
            console.error(`Section '${section}' not found in config`);
            return false;
        }

        if (!(field in config[section])) {
            console.error(`Field '${field}' not found in section '${section}'`);
            return false;
        }

        config[section][field] = value;
        
        if (saveConfig(config)) {
            console.log(`Updated config: ${section}.${field} = ${value}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error updating config field:', error);
        return false;
    }
}

/**
 * Update the messageId for reaction roles
 * @param {string} messageId - New message ID
 * @returns {boolean} - Success status
 */
function updateReactionRoleMessageId(messageId) {
    return updateConfigField('reactionRoleSettings', 'messageId', messageId);
}

module.exports = {
    loadConfig,
    saveConfig,
    updateConfigField,
    updateReactionRoleMessageId
};
