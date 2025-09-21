import type { Message, GuildMember } from 'discord.js';
import type { BaseCommand } from './base-command.js';
import type { CommandContext } from '../types.js';
import type { VoiceConnectionManager } from '../voice-connection-manager.js';
import { Logger } from '../logger.js';

/**
 * Manages command registration and execution
 */
export class CommandManager {
	private readonly commands = new Map<string, BaseCommand>();
	private readonly prefix: string;
	private readonly voiceManager: VoiceConnectionManager;

	constructor(prefix: string, voiceManager: VoiceConnectionManager) {
		this.prefix = prefix;
		this.voiceManager = voiceManager;
	}

	/**
	 * Registers a command
	 */
	public registerCommand(command: BaseCommand): void {
		this.commands.set(command.name, command);
		Logger.debug(`Registered command: ${command.name}`);
	}

	/**
	 * Processes a message and executes commands if applicable
	 */
	public async processMessage(message: Message): Promise<void> {
		// Early returns for invalid messages
		if (!message.guild || message.author.bot || !message.content.startsWith(this.prefix)) {
			return;
		}

		const args = message.content.slice(this.prefix.length).trim().split(/ +/);
		const commandName = args.shift()?.toLowerCase();

		if (!commandName) {
			return;
		}

		Logger.info(`${message.author.username} used command: ${commandName}`);

		const command = this.commands.get(commandName);
		if (!command) {
			return; // Unknown command, ignore silently
		}

		const member = message.member as GuildMember;

		// Check voice channel requirements
		if (command.requiresSameVoiceChannel && !this.voiceManager.isUserInSameChannel(member)) {
			await message.reply('You need to be in the same voice channel as the bot to use this command.');
			return;
		}

		// Create command context
		const context: CommandContext = {
			guildId: message.guild.id,
			userId: message.author.id,
			channelId: message.channel.id,
			args,
			reply: async (content: string) => {
				await message.reply(content);
			},
		};

		// Add member to context for commands that need it
		(context as any).member = member;

		try {
			// Validate command
			if (!(await command.validate(context, message))) {
				return;
			}

			// Execute command
			await command.execute(context);
		} catch (error) {
			Logger.error(`Command execution failed: ${commandName}`, error);
			await context.reply(
				`An error occurred while executing the command: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	/**
	 * Gets all registered commands
	 */
	public getCommands(): Map<string, BaseCommand> {
		return new Map(this.commands);
	}

	/**
	 * Gets a specific command by name
	 */
	public getCommand(name: string): BaseCommand | undefined {
		return this.commands.get(name);
	}
}
