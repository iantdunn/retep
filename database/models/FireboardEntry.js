const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const FireboardEntry = sequelize.define('FireboardEntry', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Discord message ID of the original message',
        },
        fireboardMessageId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Discord message ID of the fireboard entry',
        },
        authorId: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord user ID of the original message author',
        },
    }, {
        tableName: 'fireboard_entries',
        timestamps: true, // Adds createdAt and updatedAt
        indexes: [
            {
                unique: true,
                fields: ['messageId']
            },
            {
                unique: true,
                fields: ['fireboardMessageId']
            },
            {
                fields: ['authorId']
            }
        ]
    });

    return FireboardEntry;
};
