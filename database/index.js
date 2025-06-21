const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'fireboard.sqlite'),
    logging: false, // Set to console.log to see SQL queries
});

// Import models
const FireboardEntry = require('./models/FireboardEntry')(sequelize);

// Test the connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

// Initialize database and create tables
async function initializeDatabase() {
    try {
        await testConnection();
        await sequelize.sync();
        console.log('Database tables created successfully.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

module.exports = {
    sequelize,
    FireboardEntry,
    initializeDatabase,
};
