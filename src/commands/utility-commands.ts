import { BaseCommand } from './base-command.js';
import type { CommandContext } from '../types.js';
import type { GuildStateManager } from '../guild-state-manager.js';
import type { VoiceConnectionManager } from '../voice-connection-manager.js';
import type { User } from 'discord.js';

export class QueueCommand extends BaseCommand {
	public readonly name = 'queue';
	public readonly description = 'Show the current queue';

	constructor(private readonly guildStateManager: GuildStateManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const currentSong = this.guildStateManager.getCurrentSong(context.guildId);
		const queue = this.guildStateManager.getQueue(context.guildId);
		const loopMode = this.guildStateManager.getLoopMode(context.guildId);

		if (!currentSong && queue.length === 0) {
			await context.reply('The queue is empty.');
			return;
		}

		const formatSong = (song: { title: string; requester: User }) =>
			`**${song.title}** (requested by ${song.requester.username})`;

		let queueString = '';

		if (currentSong) {
			queueString += `__Now Playing__ \n\n${formatSong(currentSong)}\n\n`;
		}

		if (queue.length > 0) {
			queueString += '__Queue:__\n\n';
			queueString += queue
				.slice(0, 10) // Limit to first 10 songs to prevent long messages
				.map((song, index) => `${index + 1}. ${formatSong(song)}`)
				.join('\n');

			if (queue.length > 10) {
				queueString += `\n... and ${queue.length - 10} more songs`;
			}
		}

		queueString += `\n\n__Loop Mode:__ ${loopMode}`;

		await context.reply(queueString);
	}
}

export class LeaveCommand extends BaseCommand {
	public readonly name = 'leave';
	public readonly description = 'Leave the voice channel';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly voiceManager: VoiceConnectionManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const success = this.voiceManager.disconnectFromChannel(context.guildId);
		
		if (success) {
			await context.reply('Left the voice channel.');
		} else {
			await context.reply('I am not in a voice channel.');
		}
	}
}