const { Client, GatewayIntentBits } = require('discord.js');
const { discordToken, discordGuildId } = require('../config.js');
const guildMemberRemoveEvent = require('../events/guildMemberRemove.js');

const userId = process.argv[2];
if (!userId) {
    console.log('Usage: node scripts/simulate-guild-member-remove.js <userId>');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
    try {
        const guild = client.guilds.cache.get(discordGuildId);
        const member = await guild.members.fetch(userId);
        console.log(`Simulating guildMemberRemove for ${member.user.tag}`);
        await guildMemberRemoveEvent.execute(member);
        console.log('Simulation completed');
    } catch (error) {
        console.error(error);
    } finally {
        client.destroy();
    }
});

client.login(discordToken);
