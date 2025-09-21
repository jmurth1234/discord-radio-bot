// This file maintains backward compatibility while using the refactored architecture
// Import the new refactored bot
import { DiscordRadioBot } from './discord-radio-bot.js';

// Create and start the bot using the new architecture
const bot = new DiscordRadioBot();

// Start the bot (this replaces the old void client.login(token) call)
void bot.start();
