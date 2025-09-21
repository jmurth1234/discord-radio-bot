import type { Message, GuildMember } from 'discord.js';
import type { CommandContext } from '../types.js';

/**
 * Base class for bot commands
 */
export abstract class BaseCommand {
	public abstract readonly name: string;
	public abstract readonly description: string;
	public readonly requiresVoiceChannel: boolean = false;
	public readonly requiresSameVoiceChannel: boolean = false;

	/**
	 * Executes the command
	 */
	public abstract execute(context: CommandContext): Promise<void>;

	/**
	 * Validates if the command can be executed in the current context
	 */
	public async validate(context: CommandContext, message: Message): Promise<boolean> {
		const member = message.member as GuildMember;

		if (this.requiresVoiceChannel && !member.voice.channel) {
			await context.reply('You need to be in a voice channel to use this command!');
			return false;
		}

		return true;
	}
}
