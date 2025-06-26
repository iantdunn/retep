const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.js');

/**
 * Update a specific field in a configuration section
 * @param {string} section - Configuration section name
 * @param {string} field - Field name within the section
 * @param {*} value - New value for the field
 * @returns {boolean} - Success status
 */
function updateConfigField(section, field, value) {
    // Clear require cache
    delete require.cache[require.resolve(configPath)];
    const config = require(configPath);

    if (!config) {
        return;
    }

    if (!config[section]) {
        console.error(`Section '${section}' not found in config`);
        return;
    }

    if (!(field in config[section])) {
        console.error(`Field '${field}' not found in section '${section}'`);
        return;
    }

    config[section][field] = value;

    // Save config
    const configString = `module.exports = ${JSON.stringify(config, null, 4)};`;
    fs.writeFileSync(configPath, configString, 'utf8');

    console.log(`Updated config: ${section}.${field} = ${value}`);
}

/**
 * Update the messageId for reaction roles
 * @param {string} messageId - New message ID
 * @returns {boolean} - Success status
 */
function updateReactionRoleMessageId(messageId) {
    updateConfigField('reactionRoleSettings', 'messageId', messageId);
}

module.exports = {
    updateReactionRoleMessageId
};
