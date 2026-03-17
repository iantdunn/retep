# retep

A Discord bot for a single guild with reaction roles, a fireboard (starboard), and welcome/goodbye messages.

## Features

- **Reaction Roles** — Posts a self-updating embed where members react with an emoji to assign themselves a role.
- **Fireboard** — Reposts messages that accumulate enough qualifying reactions to a dedicated channel (similar to a starboard). Persisted in a local SQLite database.
- **Welcome & Goodbye Messages** — Sends embed messages to a configured channel when members join or leave.
- **Slash Commands** — `/ping` for latency info, `/fireboard` subcommands for managing fireboard entries.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Discord application and bot token — create one at the [Discord Developer Portal](https://discord.com/developers/applications)
- (Optional) [PM2](https://pm2.keymetrics.io/) for process management (`npm install -g pm2`)

### Required Privileged Intents

In the Discord Developer Portal, under your application's **Bot** page, enable:

- **Server Members Intent** — required for welcome/goodbye messages
- **Message Content Intent** — required for fireboard content

## Installation

```bash
git clone https://github.com/iantdunn/retep.git
cd retep
npm install
```

## Configuration

Copy the example config and fill in your values:

```bash
cp config.js.example config.js
```

Edit `config.js`:

```js
module.exports = {
    // From the Discord Developer Portal
    "discordToken": "YOUR_BOT_TOKEN",
    "discordClientId": "YOUR_APPLICATION_CLIENT_ID",
    "discordGuildId": "YOUR_GUILD_ID",

    "welcomeSettings": {
        "channelId": "CHANNEL_ID",       // Channel to post welcome/goodbye messages
        "welcomeEnabled": true,
        "goodbyeEnabled": true
    },

    "reactionRoleSettings": {
        "channelId": "CHANNEL_ID",       // Channel where the roles embed is posted
        "messageId": "",                 // Leave blank; bot will populate this on first run
        "enabled": true,
        "roleEmojis": {
            // Map emoji string -> role ID
            // Standard emoji:   "🔥": "ROLE_ID"
            // Custom emoji:     "<:emojiname:EMOJI_ID>": "ROLE_ID"
        }
    },

    "fireboardSettings": {
        "channelId": "CHANNEL_ID",       // Channel where fireboard posts appear
        "enabled": true,
        "threshold": 3,                  // Minimum qualifying reactions to post
        "excludeAuthorReactions": true,  // Don't count the message author's own reactions
        "validReactions": [              // Emoji strings that count toward the threshold
            "🔥", "💯", "💀", "😂", "😭"
        ]
    }
};
```

> [!NOTE]
> `config.js` is gitignored. Never commit this file — it contains your bot token.

## Deploying Slash Commands

Slash commands must be registered with Discord before first use, and any time you add or modify commands:

```bash
npm run deployCommands
```

## Running the Bot

**Directly (development/testing):**

```bash
npm start
```

**With PM2 (recommended for persistent hosting):**

```bash
# Development (watch mode off, logs to ./logs/)
npm run dev

# Production
npm run prod
```

Stop/manage with standard PM2 commands: `pm2 status`, `pm2 logs retep`, `pm2 stop retep`.

## Slash Commands Reference

| Command | Description |
|---|---|
| `/ping` | Returns bot latency and WebSocket heartbeat. |
| `/fireboard refresh <message_id>` | Manually re-evaluates a message's fireboard status. |
| `/fireboard reactions` | Displays current fireboard configuration. |

## Developer Scripts

These scripts simulate events locally without needing real Discord activity:

```bash
# Simulate a member joining (tests welcome message)
node scripts/simulate-guild-member-add.js <userId>

# Simulate a member leaving (tests goodbye message)
node scripts/simulate-guild-member-remove.js <userId>
```

## Project Structure

```
retep/
├── commands/           Slash command definitions
│   ├── fireboard/
│   └── utility/
├── database/           Sequelize setup and models (SQLite)
│   └── models/
├── events/             discord.js event handlers
├── reactions/          Reaction role and fireboard logic
├── scripts/            Developer/deployment utility scripts
├── utils/              Shared helpers (embeds, CRUD, config)
├── config.js.example   Configuration template
├── ecosystem.config.js PM2 process config
└── index.js            Entry point
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
