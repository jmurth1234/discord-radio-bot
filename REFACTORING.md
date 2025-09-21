# Discord Radio Bot - Refactored Architecture

This document describes the refactored architecture of the Discord Radio Bot, which improves maintainability, readability, and robustness.

## Architecture Overview

The bot has been refactored from a single monolithic file into a modular architecture with clear separation of concerns:

```
src/
├── types.ts                    # TypeScript interfaces and types
├── config.ts                   # Configuration management
├── logger.ts                   # Centralized logging utility
├── cache-manager.ts            # Audio file caching and cleanup
├── youtube-service.ts          # YouTube API interactions
├── guild-state-manager.ts      # Per-guild state management
├── voice-connection-manager.ts # Voice channel connections
├── audio-manager.ts            # Audio playback and streaming
├── discord-radio-bot.ts        # Main bot orchestration
├── bot-new.ts                  # New entry point
├── commands/
│   ├── base-command.ts         # Base command class
│   ├── command-manager.ts      # Command registration and routing
│   ├── play-command.ts         # Play command implementation
│   ├── playback-commands.ts    # Skip, pause, resume commands
│   ├── settings-commands.ts    # Volume, loop commands
│   └── utility-commands.ts     # Queue, leave commands
└── bot.ts                      # Original monolithic file (preserved)
```

## Key Improvements

### 1. **Type Safety**
- Added comprehensive TypeScript interfaces (`types.ts`)
- Eliminated `any` types and improved type safety
- Better error handling with typed errors

### 2. **Modular Design**
- **ConfigManager**: Validates and manages bot configuration
- **Logger**: Centralized logging with timestamps and levels
- **CacheManager**: Handles audio file caching and cleanup
- **YouTubeService**: Encapsulates all YouTube API interactions
- **GuildStateManager**: Manages per-guild state (queues, volume, etc.)
- **VoiceConnectionManager**: Handles voice channel connections
- **AudioManager**: Manages audio playback and streaming
- **CommandManager**: Plugin-style command system

### 3. **Command System**
- Replaced large if-else chain with a plugin-based command system
- Each command is a separate class extending `BaseCommand`
- Automatic validation and error handling
- Easy to add new commands

### 4. **Error Handling**
- Comprehensive error handling throughout the codebase
- Proper error logging with context
- Graceful error recovery

### 5. **State Management**
- Centralized guild state management
- Clean separation of concerns
- Better memory management

### 6. **Caching System**
- Improved cache management with LRU eviction
- Background caching for better performance
- Proper cleanup of temporary files

## Usage

### Running the Refactored Bot

```bash
# Build the project
yarn build

# Run the refactored bot
node dist/bot-new.js
```

### Configuration

The bot uses the same `config.json` format but now includes validation:

```json
{
  "token": "YOUR_DISCORD_BOT_TOKEN",
  "maxTransmissionGap": 5000,
  "maxCacheSizeMB": 1024
}
```

### Commands

All existing commands work the same way:
- `-play <url|search>` - Play a song or playlist
- `-skip` - Skip the current song
- `-pause` - Pause playback
- `-resume` - Resume playback
- `-volume <0-100>` - Set volume
- `-loop <off|song|queue>` - Set loop mode
- `-queue` - Show current queue
- `-leave` - Leave voice channel

## Adding New Commands

To add a new command:

1. Create a new file in `src/commands/`
2. Extend the `BaseCommand` class
3. Implement the `execute` method
4. Register the command in `discord-radio-bot.ts`

Example:

```typescript
export class MyCommand extends BaseCommand {
  public readonly name = 'mycommand';
  public readonly description = 'My custom command';
  
  public async execute(context: CommandContext): Promise<void> {
    await context.reply('Hello from my command!');
  }
}
```

## Benefits of the Refactored Architecture

1. **Maintainability**: Code is organized into logical modules
2. **Testability**: Each component can be unit tested independently
3. **Extensibility**: Easy to add new features and commands
4. **Reliability**: Better error handling and recovery
5. **Performance**: Optimized caching and state management
6. **Code Quality**: TypeScript strict mode, proper typing, and consistent patterns

## Migration

The refactored version maintains full backward compatibility:
- Same commands and functionality
- Same configuration format
- Same behavior from user perspective
- Original `bot.ts` file is preserved for reference

## Future Enhancements

The new architecture makes it easy to add:
- Database persistence for queues
- Web dashboard
- Additional audio sources
- Advanced queue management
- User permissions system
- Slash commands support