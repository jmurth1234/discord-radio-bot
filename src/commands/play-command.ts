import type { GuildMember } from 'discord.js';
import { BaseCommand } from './base-command.js';
import type { CommandContext } from '../types.js';
import type { YouTubeService } from '../youtube-service.js';
import type { VoiceConnectionManager } from '../voice-connection-manager.js';
import type { GuildStateManager } from '../guild-state-manager.js';
import type { AudioManager } from '../audio-manager.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { Logger } from '../logger.js';

export class PlayCommand extends BaseCommand {
	public readonly name = 'play';
	public readonly description = 'Play a song from YouTube URL or search terms';
	public override readonly requiresVoiceChannel = true;
	public override readonly requiresSameVoiceChannel = true;

	constructor(
		private readonly youtubeService: typeof YouTubeService,
		private readonly voiceManager: VoiceConnectionManager,
		private readonly guildStateManager: GuildStateManager,
		private readonly audioManager: AudioManager
	) {
		super();
	}

	public async execute(context: CommandContext): Promise<void> {
		const query = context.args.join(' ');
		if (!query) {
			await context.reply('Please provide a URL or search terms to play!');
			return;
		}

		// This will be passed from the message handler
		const member = context as any as { member: GuildMember };
		const voiceChannel = member.member.voice.channel;
		
		if (!voiceChannel) {
			await context.reply('You need to be in a voice channel to play music!');
			return;
		}

		try {
			// Ensure we're connected to the voice channel
			await this.voiceManager.ensureConnection(context.guildId, voiceChannel);

			// Resolve the query to songs
			const songs = await this.youtubeService.resolveQuery(query, member.member.user);

			if (songs.length === 0) {
				await context.reply('No songs found for your query.');
				return;
			}

			// Add songs to queue
			if (songs.length === 1) {
				const song = songs[0];
				if (song) {
					this.guildStateManager.addToQueue(context.guildId, song);
					await context.reply(`Added to queue: **${song.title}**`);
				}
			} else {
				this.guildStateManager.addMultipleToQueue(context.guildId, songs);
				await context.reply(`Added ${songs.length} songs from the playlist to the queue.`);
			}

			// Start playing if not already playing
			const playbackStatus = this.audioManager.getPlaybackStatus(context.guildId);
			if (playbackStatus === AudioPlayerStatus.Idle) {
				await this.audioManager.playNextSong(context.guildId);
			}

		} catch (error) {
			Logger.error(`Play command failed for guild ${context.guildId}`, error);
			await context.reply(`Failed to play: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}