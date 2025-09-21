import {
	AudioPlayer,
	AudioPlayerStatus,
	createAudioPlayer,
	NoSubscriberBehavior,
	VoiceConnection,
} from '@discordjs/voice';
import type { GuildState, Song, LoopMode } from './types.js';
import { Logger } from './logger.js';

/**
 * Manages state for all guilds
 */
export class GuildStateManager {
	private readonly guildStates = new Map<string, GuildState>();
	private readonly maxTransmissionGap: number;
	private audioManager?: import('./audio-manager.js').AudioManager;

	constructor(maxTransmissionGap: number) {
		this.maxTransmissionGap = maxTransmissionGap;
	}

	/**
	 * Sets the audio manager reference for handling playback events
	 */
	public setAudioManager(audioManager: import('./audio-manager.js').AudioManager): void {
		this.audioManager = audioManager;
	}

	/**
	 * Gets or creates guild state
	 */
	public getGuildState(guildId: string): GuildState {
		let state = this.guildStates.get(guildId);
		if (!state) {
			state = this.createDefaultGuildState();
			this.guildStates.set(guildId, state);
			Logger.debug(`Created new guild state for ${guildId}`);
		}
		return state;
	}

	/**
	 * Gets the audio player for a guild, creating one if needed
	 */
	public getPlayer(guildId: string): AudioPlayer {
		const state = this.getGuildState(guildId);
		
		if (!state.player) {
			state.player = createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Play,
					maxMissedFrames: Math.round(this.maxTransmissionGap / 20),
				},
			});

			// Set up event listeners
			state.player.on('stateChange', (oldState, newState) => {
				if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
					Logger.info('Playback has stopped. Checking queue for next song.');
					// Use audio manager to play next song
					if (this.audioManager) {
						void this.audioManager.playNextSong(guildId);
					}
				}
			});

			state.player.on('error', (error) => {
				Logger.error(`Audio player error in guild ${guildId}`, error);
			});

			Logger.debug(`Created audio player for guild ${guildId}`);
		}

		return state.player;
	}

	/**
	 * Sets the voice connection for a guild
	 */
	public setConnection(guildId: string, connection: VoiceConnection): void {
		const state = this.getGuildState(guildId);
		state.connection = connection;
		Logger.debug(`Set voice connection for guild ${guildId}`);
	}

	/**
	 * Gets the voice connection for a guild
	 */
	public getConnection(guildId: string): VoiceConnection | undefined {
		const state = this.guildStates.get(guildId);
		return state?.connection;
	}

	/**
	 * Adds a song to the guild's queue
	 */
	public addToQueue(guildId: string, song: Song): void {
		const state = this.getGuildState(guildId);
		state.queue.push(song);
		Logger.debug(`Added song to queue for guild ${guildId}: ${song.title}`);
	}

	/**
	 * Adds multiple songs to the guild's queue
	 */
	public addMultipleToQueue(guildId: string, songs: Song[]): void {
		const state = this.getGuildState(guildId);
		state.queue.push(...songs);
		Logger.debug(`Added ${songs.length} songs to queue for guild ${guildId}`);
	}

	/**
	 * Gets the next song from the queue
	 */
	public getNextSong(guildId: string): Song | undefined {
		const state = this.guildStates.get(guildId);
		if (!state || state.queue.length === 0) {
			return undefined;
		}

		// Handle looping
		if (state.currentSong) {
			if (state.loopMode === 'song') {
				state.queue.unshift(state.currentSong);
			} else if (state.loopMode === 'queue') {
				state.queue.push(state.currentSong);
			}
		}

		const nextSong = state.queue.shift();
		if (nextSong) {
			state.currentSong = nextSong;
			Logger.debug(`Got next song for guild ${guildId}: ${nextSong.title}`);
		}

		return nextSong;
	}

	/**
	 * Gets the current song for a guild
	 */
	public getCurrentSong(guildId: string): Song | undefined {
		const state = this.guildStates.get(guildId);
		return state?.currentSong;
	}

	/**
	 * Gets the queue for a guild
	 */
	public getQueue(guildId: string): Song[] {
		const state = this.guildStates.get(guildId);
		return state?.queue || [];
	}

	/**
	 * Sets the volume for a guild
	 */
	public setVolume(guildId: string, volume: number): void {
		const state = this.getGuildState(guildId);
		state.volume = Math.max(0, Math.min(1, volume));
		Logger.debug(`Set volume for guild ${guildId}: ${state.volume}`);
	}

	/**
	 * Gets the volume for a guild
	 */
	public getVolume(guildId: string): number {
		const state = this.guildStates.get(guildId);
		return state?.volume ?? 1;
	}

	/**
	 * Sets the loop mode for a guild
	 */
	public setLoopMode(guildId: string, loopMode: LoopMode): void {
		const state = this.getGuildState(guildId);
		state.loopMode = loopMode;
		Logger.debug(`Set loop mode for guild ${guildId}: ${loopMode}`);
	}

	/**
	 * Gets the loop mode for a guild
	 */
	public getLoopMode(guildId: string): LoopMode {
		const state = this.guildStates.get(guildId);
		return state?.loopMode || 'off';
	}

	/**
	 * Clears all state for a guild (when leaving)
	 */
	public clearGuildState(guildId: string): void {
		const state = this.guildStates.get(guildId);
		if (state) {
			// Clean up connection
			if (state.connection) {
				state.connection.destroy();
			}
			
			// Stop player
			if (state.player) {
				state.player.stop(true);
			}

			this.guildStates.delete(guildId);
			Logger.debug(`Cleared state for guild ${guildId}`);
		}
	}

	/**
	 * Gets all currently playing video IDs (for cache management)
	 */
	public getCurrentlyPlayingVideoIds(): Set<string> {
		const videoIds = new Set<string>();
		
		for (const [, state] of this.guildStates) {
			if (state.currentSong) {
				try {
					// Extract video ID from URL - this is a simple implementation
					const url = state.currentSong.url;
					const match = url.match(/[?&]v=([^&]+)/);
					if (match?.[1]) {
						videoIds.add(match[1]);
					}
				} catch (error) {
					Logger.warn('Failed to extract video ID from URL', error);
				}
			}
		}

		return videoIds;
	}

	/**
	 * Checks if a guild has an active queue or is playing
	 */
	public hasActiveQueue(guildId: string): boolean {
		const state = this.guildStates.get(guildId);
		return !!(state && (state.currentSong || state.queue.length > 0));
	}

	private createDefaultGuildState(): GuildState {
		return {
			queue: [],
			volume: 1,
			loopMode: 'off',
		};
	}
}