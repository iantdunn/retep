# Contributing to retep

Thanks for your interest in contributing. This is a personal Discord bot, but contributions are welcome. Check the [issue tracker](https://github.com/iantdunn/retep/issues) for things to work on. **Please prioritize open bug reports before taking on new features.**

## Getting Started

1. Fork the repository and clone your fork.
2. Follow the setup steps in [README.md](README.md) to get the bot running locally.
3. Create a branch for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Guidelines

- **Scope** — Keep changes focused. One feature or fix per pull request.
- **Style** — Run `npm run lint` before submitting. The project uses ESLint; fix any reported issues.
- **No secrets** — Never commit `config.js` or any file containing tokens, IDs, or credentials.
- **Backward compatibility** — Changes to `config.js.example` should not break existing configs unless absolutely necessary; document any breaking changes clearly in the PR.

## Project Structure

```
retep/
├── commands/               Slash command definitions, organized by category
│   ├── fireboard/
│   └── utility/
├── database/               Database layer (Sequelize + SQLite)
│   ├── index.js            Initializes Sequelize, registers models, exports them
│   └── models/             One file per Sequelize model
├── events/                 discord.js event handlers (one file per event)
├── reactions/              Reaction-driven feature logic
│   ├── handler.js          Orchestrator; routes reaction events to the right class
│   ├── fireboard.js        Fireboard feature class
│   └── roles.js            Reaction roles feature class
├── scripts/                One-off utility scripts (deploy commands, simulate events)
├── utils/                  Shared helpers used across multiple modules
│   ├── configUtils.js      Reads and writes config.js at runtime
│   ├── embeds.js           Discord embed builder functions
│   ├── fireboardCrud.js    Fireboard database CRUD operations
│   ├── guildUtils.js       Helpers for fetching guild/channel/message/member data
│   └── reactionUtils.js    Reaction counting logic (deduplication, author exclusion)
├── config.js.example       Configuration template (copy to config.js to configure)
├── ecosystem.config.js     PM2 process manager configuration
└── index.js                Entry point; registers events, initializes the database and handlers
```

### Key conventions

- **Events** (`events/`) are auto-loaded by `index.js` at startup via `fs.readdirSync`. Each file must export `name` (the event name) and `execute(...args)`.
- **Commands** (`commands/`) are also auto-loaded recursively. Each file must export `data` (a `SlashCommandBuilder`) and an async `execute(interaction)`.
- **Reactions** are routed through `reactions/handler.js`. `ReactionHandler` tries `ReactionRoles` first, then `Fireboard`, using the return value to avoid double-handling.
- **Utilities** in `utils/` are plain exported functions — no classes, no shared state.

## Database

The bot uses **SQLite** via **Sequelize** (ORM). The database file is written to `database/fireboard.sqlite` at runtime and is gitignored — it will be created automatically on first run.

### Initialization

`database/index.js` initializes Sequelize and calls `sequelize.sync({ alter: true })` on startup. This automatically creates any missing tables and adds new columns to existing ones, so schema changes to a model take effect without a manual migration.

### Models

Models live in `database/models/`. The only current model is `FireboardEntry`:

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK) | Auto-incremented primary key |
| `messageId` | STRING (unique) | Discord message ID of the original message |
| `channelId` | STRING | Discord channel ID of the original message |
| `fireboardMessageId` | STRING (unique) | Discord message ID of the fireboard repost |
| `authorId` | STRING | Discord user ID of the original message author |
| `validReactionCount` | INTEGER | Cached count of qualifying reactions |
| `createdAt` / `updatedAt` | DATE | Managed automatically by Sequelize |

To add a new model:
1. Create `database/models/YourModel.js` following the same pattern as `FireboardEntry.js` (a function that receives `sequelize` and returns a defined model).
2. Register it in `database/index.js` alongside `FireboardEntry` and add it to the exports.

### CRUD

All database operations for the fireboard go through `utils/fireboardCrud.js`, which exports:

- `getEntry(messageId)` — finds a single entry by source message ID
- `createEntry(messageId, channelId, fireboardMessageId, authorId, validReactionCount)` — uses `findOrCreate` to safely handle race conditions
- `updateEntry(messageId, updates)` — partial update by source message ID
- `getAllEntries(limit?)` — returns all entries ordered by `createdAt` descending
- `deleteEntryObject(entry)` — destroys a model instance

When adding database operations, add them here rather than calling Sequelize directly from feature code.

## Adding a Slash Command

1. Create a file under `commands/<category>/yourCommand.js` that exports `data` (a `SlashCommandBuilder`) and an async `execute(interaction)` function.
2. Run `npm run deployCommands` to register it with Discord.
3. The command will be auto-loaded by `events/interactionCreate.js` — no further wiring needed.

## Adding a Reaction Event Handler

Reaction logic lives in `reactions/`. The `ReactionHandler` in `reactions/handler.js` delegates to individual handler classes. To add a new reaction-driven feature:

1. Create a new class in `reactions/` with `handleReactionAdd` and `handleReactionRemove` methods.
2. Instantiate and call it from `reactions/handler.js`.

## Submitting a Pull Request

- Describe what the change does and why.
- Reference the related issue number.
- Ensure `npm run lint` passes.

## Reporting Issues

Open an issue at https://github.com/iantdunn/retep/issues. For bugs, include steps to reproduce. Bug fixes take priority over new feature work.
