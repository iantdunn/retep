const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.js');

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

module.exports.updateReactionRoleMessageId = function (messageId) {
    updateConfigField('reactionRoleSettings', 'messageId', messageId);
};
