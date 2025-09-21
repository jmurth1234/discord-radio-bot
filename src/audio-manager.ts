import { AudioResource, createAudioResource, StreamType, AudioPlayerStatus } from '@discordjs/voice';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import type { Song } from './types.js';
import { Logger } from './logger.js';
import { YouTubeService } from './youtube-service.js';
import type { GuildStateManager } from './guild-state-manager.js';
import type { CacheManager } from './cache-manager.js';

/**
 * Manages audio playback and streaming
 */
export class AudioManager {
	private readonly guildStateManager: GuildStateManager;
	private readonly cacheManager: CacheManager;

	constructor(guildStateManager: GuildStateManager, cacheManager: CacheManager) {
		this.guildStateManager = guildStateManager;
		this.cacheManager = cacheManager;
		this.setupPlayerEventHandlers();
	}

	/**
	 * Sets up event handlers for all audio players
	 */
	private setupPlayerEventHandlers(): void {
		// We'll need to set up event handlers when players are created
		// This is handled in the guild state manager's getPlayer method
	}

	/**
	 * Starts playing the next song in the queue
	 */
	public async playNextSong(guildId: string): Promise<void> {
		const song = this.guildStateManager.getNextSong(guildId);
		if (!song) {
			Logger.debug(`No more songs in queue for guild ${guildId}`);
			return;
		}

		const player = this.guildStateManager.getPlayer(guildId);
		const connection = this.guildStateManager.getConnection(guildId);

		if (!connection) {
			Logger.error(`No voice connection for guild ${guildId}`);
			return;
		}

		// Subscribe the connection to the player
		connection.subscribe(player);

		try {
			await this.playSong(guildId, song);
		} catch (error) {
			Logger.error(`Failed to play song in guild ${guildId}`, error);
			// Try to play the next song
			void this.playNextSong(guildId);
		}
	}

	/**
	 * Skips the current song
	 */
	public skipCurrentSong(guildId: string): boolean {
		const player = this.guildStateManager.getPlayer(guildId);

		if (player.state.status !== AudioPlayerStatus.Idle) {
			player.stop(true);
			Logger.info(`Skipped song in guild ${guildId}`);
			return true;
		}

		return false;
	}

	/**
	 * Pauses playback
	 */
	public pausePlayback(guildId: string): boolean {
		const player = this.guildStateManager.getPlayer(guildId);

		if (player.state.status === AudioPlayerStatus.Playing) {
			player.pause();
			Logger.info(`Paused playback in guild ${guildId}`);
			return true;
		}

		return false;
	}

	/**
	 * Resumes playback
	 */
	public resumePlayback(guildId: string): boolean {
		const player = this.guildStateManager.getPlayer(guildId);

		if (player.state.status === AudioPlayerStatus.Paused) {
			player.unpause();
			Logger.info(`Resumed playback in guild ${guildId}`);
			return true;
		}

		return false;
	}

	/**
	 * Sets the volume for current and future playback
	 */
	public setVolume(guildId: string, volume: number): boolean {
		this.guildStateManager.setVolume(guildId, volume);

		// Apply to current playback if active
		const player = this.guildStateManager.getPlayer(guildId);
		if (player.state.status !== AudioPlayerStatus.Idle && 'resource' in player.state) {
			const resource = player.state.resource as AudioResource;
			if (resource?.volume) {
				resource.volume.setVolume(volume);
				Logger.info(`Applied volume ${volume} to current playback in guild ${guildId}`);
				return true;
			}
		}

		Logger.info(`Set volume ${volume} for guild ${guildId}`);
		return false; // No current playback to apply to
	}

	/**
	 * Gets the playback status for a guild
	 */
	public getPlaybackStatus(guildId: string): AudioPlayerStatus {
		const player = this.guildStateManager.getPlayer(guildId);
		return player.state.status;
	}

	private async playSong(guildId: string, song: Song): Promise<void> {
		const videoId = YouTubeService.getVideoId(song.url);
		const volume = this.guildStateManager.getVolume(guildId);
		const player = this.guildStateManager.getPlayer(guildId);

		Logger.info(`Playing song in guild ${guildId}: ${song.title}`);

		// Check if we have a cached version
		if (this.cacheManager.isCached(videoId)) {
			await this.playFromCache(player, videoId, volume);
		} else {
			await this.playFromStream(player, song.url, videoId, volume);
		}
	}

	private async playFromCache(player: any, videoId: string, volume: number): Promise<void> {
		const cachedFilePath = this.cacheManager.getCachedFilePath(videoId);

		try {
			const resource = createAudioResource(cachedFilePath, {
				inputType: StreamType.OggOpus,
				inlineVolume: true,
			});

			resource.volume?.setVolume(volume);
			player.play(resource);

			// Update cache access time for LRU eviction
			this.cacheManager.touchCachedFile(videoId);

			Logger.debug(`Playing from cache: ${videoId}`);
		} catch (error) {
			Logger.error('Failed to play from cache', error);
			throw error;
		}
	}

	private async playFromStream(player: any, url: string, videoId: string, volume: number): Promise<void> {
		// Start background caching
		this.cacheManager.startBackgroundCaching(videoId, url);

		try {
			const liveStream = YouTubeService.createStream(url);
			const playbackOutput = new PassThrough();

			// Set up FFmpeg processing
			const ffmpegProcess = ffmpeg(liveStream)
				.inputOptions(['-analyzeduration', '0'])
				.format('ogg')
				.audioCodec('libopus')
				.audioBitrate('128k');

			// Handle FFmpeg events
			ffmpegProcess.on('error', (error: Error) => {
				Logger.error('FFmpeg playback error', error);
				playbackOutput.destroy();
				throw error;
			});

			// Pipe to output stream
			ffmpegProcess.pipe(playbackOutput, { end: true });

			// Create audio resource and play
			const resource = createAudioResource(playbackOutput, {
				inputType: StreamType.OggOpus,
				inlineVolume: true,
			});

			resource.volume?.setVolume(volume);
			player.play(resource);

			Logger.debug(`Playing from stream: ${videoId}`);
		} catch (error) {
			Logger.error('Failed to play from stream', error);
			throw error;
		}
	}
}
