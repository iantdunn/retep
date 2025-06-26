const fs = require('fs');
const path = require('path');

/**
 * Utility class for managing configuration file updates
 */
class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../config.js');
    }

    _updateConfigField(section, field, value) {
        try {
            let configContent = fs.readFileSync(this.configPath, 'utf8');

            // Create regex pattern for the specific field within the section
            const fieldRegex = new RegExp(
                `(${section}:\\s*{[\\s\\S]*?${field}:\\s*)(null|'[^']*'|"[^"]*"|\\d+|true|false)([\\s\\S]*?})`,
                'g'
            );

            const newValue = this._formatValue(value);

            if (fieldRegex.test(configContent)) {
                configContent = configContent.replace(fieldRegex, `$1${newValue}$3`);
                fs.writeFileSync(this.configPath, configContent, 'utf8');
                console.log(`Updated config: ${section}.${field} = ${newValue}`);
                return true;
            } else {
                console.error(`Could not find ${section}.${field} in config file`);
                return false;
            }
        } catch (error) {
            console.error('Error updating config file:', error);
            return false;
        }
    }

    /**
     * Update the messageId for reaction roles
     * @param {string} messageId - New message ID
     * @returns {boolean} - Success status
     */
    updateReactionRoleMessageId(messageId) {
        return this._updateConfigField('reactionRoleSettings', 'messageId', messageId);
    }

    /**
     * Format a value for insertion into the config file
     * @param {*} value - Value to format
     * @returns {string} - Formatted value
     * @private
     */
    _formatValue(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'string') {
            return `'${value}'`;
        }
        if (typeof value === 'boolean') {
            return value.toString();
        }
        if (typeof value === 'number') {
            return value.toString();
        }
        return `'${value}'`;
    }
}

module.exports = { ConfigManager };
