import { DiscordRadioBot } from './discord-radio-bot.js';
import { Logger } from './logger.js';

/**
 * Entry point for the Discord Radio Bot
 */
async function main(): Promise<void> {
	const bot = new DiscordRadioBot();

	// Handle graceful shutdown
	const shutdown = async (signal: string) => {
		Logger.info(`Received ${signal}, shutting down gracefully...`);
		try {
			await bot.stop();
			process.exit(0);
		} catch (error) {
			Logger.error('Error during shutdown', error);
			process.exit(1);
		}
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
	process.on('unhandledRejection', (reason) => {
		Logger.error('Unhandled Promise Rejection', reason);
	});
	process.on('uncaughtException', (error) => {
		Logger.error('Uncaught Exception', error);
		process.exit(1);
	});

	try {
		await bot.start();
	} catch (error) {
		Logger.error('Failed to start bot', error);
		process.exit(1);
	}
}

// Start the bot
void main();
