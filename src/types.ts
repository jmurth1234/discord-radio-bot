import type { User } from 'discord.js';

/**
 * Configuration loaded from config.json
 */
export interface BotConfig {
	token: string;
	device?: string;
	type?: string;
	maxTransmissionGap: number;
	maxCacheSizeMB?: number;
}

/**
 * Represents a song in the queue
 */
export interface Song {
	url: string;
	requester: User;
	title: string;
}

/**
 * Loop modes available for playback
 */
export type LoopMode = 'off' | 'song' | 'queue';

/**
 * Cache file information
 */
export interface CacheFile {
	filePath: string;
	stat: import('fs').Stats;
	videoId: string | null;
}

/**
 * Cache maintenance configuration
 */
export interface CacheConfig {
	maintenanceIntervalMs: number;
	tempFileTtlMs: number;
	maxCacheSizeBytes: number;
}

/**
 * Guild-specific state
 */
export interface GuildState {
	connection?: any; // VoiceConnection type from @discordjs/voice
	player?: import('@discordjs/voice').AudioPlayer;
	queue: Song[];
	volume: number;
	loopMode: LoopMode;
	currentSong?: Song;
}

/**
 * Command context for handling commands
 */
export interface CommandContext {
	guildId: string;
	userId: string;
	channelId: string;
	args: string[];
	reply: (content: string) => Promise<void>;
}
