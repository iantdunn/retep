const { Client, GatewayIntentBits } = require('discord.js');
const { discordToken, discordGuildId } = require('../config.js');
const guildMemberAddEvent = require('../events/guildMemberAdd.js');

const userId = process.argv[2];
if (!userId) {
    console.log('Usage: node scripts/simulate-guild-member-add.js <userId>');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
    try {
        const guild = client.guilds.cache.get(discordGuildId);
        const member = await guild.members.fetch(userId);
        console.log(`Simulating guildMemberAdd for ${member.user.tag}`);
        await guildMemberAddEvent.execute(member);
        console.log('Simulation completed');
    } catch (error) {
        console.error(error);
    } finally {
        client.destroy();
    }
});

client.login(discordToken);
