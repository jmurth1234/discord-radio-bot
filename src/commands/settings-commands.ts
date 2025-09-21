import { BaseCommand } from './base-command.js';
import type { CommandContext, LoopMode } from '../types.js';
import type { GuildStateManager } from '../guild-state-manager.js';
import type { AudioManager } from '../audio-manager.js';

export class VolumeCommand extends BaseCommand {
	public readonly name = 'volume';
	public readonly description = 'Set the playback volume (0-100)';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly audioManager: AudioManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const volumeArg = context.args[0];

		if (!volumeArg) {
			await context.reply('Please provide a volume level between 0 and 100.');
			return;
		}

		const volume = parseInt(volumeArg, 10);
		if (isNaN(volume) || volume < 0 || volume > 100) {
			await context.reply('Volume must be a number between 0 and 100.');
			return;
		}

		const volumeDecimal = volume / 100;
		const appliedToCurrent = this.audioManager.setVolume(context.guildId, volumeDecimal);

		if (appliedToCurrent) {
			await context.reply(`Volume set to ${volume}% and applied to current playback.`);
		} else {
			await context.reply(`Volume set to ${volume}%.`);
		}
	}
}

export class LoopCommand extends BaseCommand {
	public readonly name = 'loop';
	public readonly description = 'Set the loop mode (off, song, queue)';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly guildStateManager: GuildStateManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const loopArg = context.args[0]?.toLowerCase();

		if (!loopArg || !['off', 'song', 'queue'].includes(loopArg)) {
			await context.reply('Please specify a loop mode: off, song, or queue.');
			return;
		}

		const loopMode = loopArg as LoopMode;
		this.guildStateManager.setLoopMode(context.guildId, loopMode);
		await context.reply(`Loop mode set to ${loopMode}.`);
	}
}
