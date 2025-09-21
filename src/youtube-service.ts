import ytdl from '@distube/ytdl-core';
import { Video, YouTube } from 'youtube-sr';
import type { Song } from './types.js';
import { Logger } from './logger.js';
import type { User } from 'discord.js';

/**
 * Service for handling YouTube operations
 */
export class YouTubeService {
	/**
	 * Validates if a URL is a valid YouTube URL
	 */
	public static isValidUrl(url: string): boolean {
		return ytdl.validateURL(url);
	}

	/**
	 * Checks if a URL is a YouTube playlist
	 */
	public static isPlaylist(url: string): boolean {
		return YouTube.isPlaylist(url);
	}

	/**
	 * Extracts video ID from a YouTube URL
	 */
	public static getVideoId(url: string): string {
		return ytdl.getVideoID(url);
	}

	/**
	 * Searches YouTube for videos
	 */
	public static async searchVideos(query: string): Promise<Video | null> {
		try {
			const results = await YouTube.search(query, { type: 'video' });
			return results[0] || null;
		} catch (error) {
			Logger.error('YouTube search error', error);
			return null;
		}
	}

	/**
	 * Gets videos from a YouTube playlist
	 */
	public static async getPlaylistVideos(url: string): Promise<Video[]> {
		try {
			const playlist = await YouTube.getPlaylist(url);
			const videos = await playlist.fetch();
			return videos.videos;
		} catch (error) {
			Logger.error('YouTube playlist error', error);
			return [];
		}
	}

	/**
	 * Gets video information from a YouTube URL
	 */
	public static async getVideoInfo(url: string): Promise<{ title: string; id: string }> {
		try {
			const info = await ytdl.getInfo(url);
			return {
				title: info.videoDetails.title,
				id: info.videoDetails.videoId,
			};
		} catch (error) {
			Logger.error('Failed to get video info', error);
			throw new Error('Failed to get video information');
		}
	}

	/**
	 * Resolves a query (URL or search terms) to songs
	 */
	public static async resolveQuery(query: string, requester: User): Promise<Song[]> {
		const songs: Song[] = [];

		try {
			// Check if it's a playlist
			if (this.isPlaylist(query)) {
				const videos = await this.getPlaylistVideos(query);
				if (videos.length === 0) {
					throw new Error('No videos found in the playlist');
				}

				videos.forEach((video) => {
					songs.push({
						url: `https://www.youtube.com/watch?v=${video.id}`,
						requester,
						title: video.title || 'Unknown Title',
					});
				});

				Logger.info(`Resolved playlist with ${songs.length} songs`);
				return songs;
			}

			// Check if it's a direct YouTube URL
			if (this.isValidUrl(query)) {
				const info = await this.getVideoInfo(query);
				songs.push({
					url: query,
					requester,
					title: info.title,
				});

				Logger.info(`Resolved direct URL: ${info.title}`);
				return songs;
			}

			// Search YouTube for the query
			const video = await this.searchVideos(query);
			if (!video) {
				throw new Error('No results found on YouTube for your query');
			}

			songs.push({
				url: `https://www.youtube.com/watch?v=${video.id}`,
				requester,
				title: video.title || 'Unknown Title',
			});

			Logger.info(`Resolved search query "${query}" to: ${video.title}`);
			return songs;
		} catch (error) {
			Logger.error('Failed to resolve query', error);
			throw error;
		}
	}

	/**
	 * Creates a YouTube stream for playback
	 */
	public static createStream(url: string) {
		return ytdl(url, {
			liveBuffer: 25000,
			highWaterMark: 1024 * 1024 * 100,
			quality: 'highestaudio',
			filter: (format) => format.container === 'mp4',
		});
	}
}