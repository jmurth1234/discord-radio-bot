import { BaseCommand } from './base-command.js';
import type { CommandContext } from '../types.js';
import type { AudioManager } from '../audio-manager.js';

export class SkipCommand extends BaseCommand {
	public readonly name = 'skip';
	public readonly description = 'Skip the current song';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly audioManager: AudioManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const success = this.audioManager.skipCurrentSong(context.guildId);

		if (success) {
			await context.reply('Skipped the current song.');
		} else {
			await context.reply('No song is currently playing.');
		}
	}
}

export class PauseCommand extends BaseCommand {
	public readonly name = 'pause';
	public readonly description = 'Pause the current song';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly audioManager: AudioManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const success = this.audioManager.pausePlayback(context.guildId);

		if (success) {
			await context.reply('Paused the current song.');
		} else {
			await context.reply('No song is currently playing.');
		}
	}
}

export class ResumeCommand extends BaseCommand {
	public readonly name = 'resume';
	public readonly description = 'Resume the paused song';
	public override readonly requiresSameVoiceChannel = true;

	constructor(private readonly audioManager: AudioManager) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const success = this.audioManager.resumePlayback(context.guildId);

		if (success) {
			await context.reply('Resumed the current song.');
		} else {
			await context.reply('No song is currently paused.');
		}
	}
}
