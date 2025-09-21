import fs from 'fs';
import path from 'path';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import type { CacheConfig, CacheFile } from './types.js';
import { Logger } from './logger.js';

/**
 * Manages audio file caching and cleanup
 */
export class CacheManager {
	private readonly cacheDir: string;
	private readonly config: CacheConfig;
	private readonly cachingTasks = new Map<string, Promise<void>>();
	private maintenanceInterval?: NodeJS.Timeout | undefined;

	constructor(cacheDir: string, config: CacheConfig) {
		this.cacheDir = path.resolve(cacheDir);
		this.config = config;
		this.ensureCacheDirectoryExists();
	}

	private ensureCacheDirectoryExists(): void {
		try {
			if (!fs.existsSync(this.cacheDir)) {
				fs.mkdirSync(this.cacheDir, { recursive: true });
				Logger.info(`Created cache directory: ${this.cacheDir}`);
			}
		} catch (error) {
			Logger.error('Failed to create cache directory', error);
			throw new Error(`Failed to create cache directory: ${this.cacheDir}`);
		}
	}

	/**
	 * Starts periodic cache maintenance
	 */
	public startMaintenance(): void {
		if (this.maintenanceInterval) {
			return;
		}

		// Run maintenance immediately
		this.runMaintenance();

		// Schedule periodic maintenance
		this.maintenanceInterval = setInterval(() => {
			this.runMaintenance();
		}, this.config.maintenanceIntervalMs);

		Logger.info('Cache maintenance started');
	}

	/**
	 * Stops periodic cache maintenance
	 */
	public stopMaintenance(): void {
		if (this.maintenanceInterval) {
			clearInterval(this.maintenanceInterval);
			this.maintenanceInterval = undefined;
			Logger.info('Cache maintenance stopped');
		}
	}

	/**
	 * Gets the cached file path for a video ID
	 */
	public getCachedFilePath(videoId: string): string {
		return path.join(this.cacheDir, `${videoId}.ogg`);
	}

	/**
	 * Checks if a video is cached
	 */
	public isCached(videoId: string): boolean {
		const filePath = this.getCachedFilePath(videoId);
		return fs.existsSync(filePath);
	}

	/**
	 * Starts background caching for a video if not already cached or in progress
	 */
	public startBackgroundCaching(videoId: string, url: string): void {
		if (this.isCached(videoId) || this.cachingTasks.has(videoId)) {
			return;
		}

		const task = this.cacheVideo(videoId, url);
		this.cachingTasks.set(videoId, task);
	}

	/**
	 * Updates the access time of a cached file for LRU eviction
	 */
	public touchCachedFile(videoId: string): void {
		const filePath = this.getCachedFilePath(videoId);
		if (fs.existsSync(filePath)) {
			try {
				const now = new Date();
				fs.utimes(filePath, now, now, () => {});
			} catch (error) {
				Logger.warn('Failed to update cache file access time', error);
			}
		}
	}

	private async cacheVideo(videoId: string, url: string): Promise<void> {
		const cachedFilePath = this.getCachedFilePath(videoId);
		const tempFilePath = path.join(this.cacheDir, `${videoId}_temp.ogg`);

		try {
			const stream = ytdl(url, {
				liveBuffer: 25000,
				highWaterMark: 1024 * 1024 * 100,
				quality: 'highestaudio',
				filter: (format) => format.container === 'mp4',
			});

			await new Promise<void>((resolve, reject) => {
				ffmpeg(stream)
					.inputOptions(['-analyzeduration', '0'])
					.format('ogg')
					.audioCodec('libopus')
					.audioBitrate('128k')
					.on('error', (error: Error) => {
						Logger.error('FFmpeg cache error', error);
						this.cleanupTempFile(tempFilePath);
						reject(error);
					})
					.on('end', () => {
						fs.rename(tempFilePath, cachedFilePath, (err) => {
							if (err) {
								Logger.error('Error finalizing cache file', err);
								this.cleanupTempFile(tempFilePath);
								reject(err);
							} else {
								Logger.info(`Caching complete for ${videoId}`);
								resolve();
							}
						});
					})
					.save(tempFilePath);
			});
		} catch (error) {
			Logger.error('Background caching setup error', error);
			this.cleanupTempFile(tempFilePath);
			throw error;
		} finally {
			this.cachingTasks.delete(videoId);
		}
	}

	private cleanupTempFile(tempFilePath: string): void {
		try {
			if (fs.existsSync(tempFilePath)) {
				fs.unlinkSync(tempFilePath);
			}
		} catch (error) {
			Logger.warn('Failed to cleanup temp file', error);
		}
	}

	private runMaintenance(): void {
		try {
			this.cleanupTempFiles();
		} catch (error) {
			Logger.error('Cache maintenance (temp) error', error);
		}

		try {
			this.enforceCacheSizeLimit();
		} catch (error) {
			Logger.error('Cache maintenance (size) error', error);
		}
	}

	private cleanupTempFiles(): void {
		const now = Date.now();
		const entries = fs.readdirSync(this.cacheDir);

		for (const entry of entries) {
			if (!entry.endsWith('_temp.ogg')) continue;

			const filePath = path.join(this.cacheDir, entry);
			const videoId = this.getVideoIdFromFilename(entry);

			// Skip active downloads
			if (videoId && this.cachingTasks.has(videoId)) continue;

			try {
				const stat = fs.statSync(filePath);
				if (now - stat.mtimeMs > this.config.tempFileTtlMs) {
					fs.unlinkSync(filePath);
					Logger.info(`Removed stale temp file ${entry}`);
				}
			} catch (error) {
				Logger.error('Error during temp cleanup', error);
			}
		}
	}

	private enforceCacheSizeLimit(): void {
		if (this.config.maxCacheSizeBytes <= 0) return;

		const entries = fs.readdirSync(this.cacheDir);
		const inUseIds = this.getCurrentlyInUseVideoIds();

		const cacheFiles = entries
			.filter((e) => e.endsWith('.ogg') && !e.endsWith('_temp.ogg'))
			.map((e) => {
				const filePath = path.join(this.cacheDir, e);
				try {
					const stat = fs.statSync(filePath);
					return {
						filePath,
						stat,
						videoId: this.getVideoIdFromFilename(e),
					} as CacheFile;
				} catch {
					return null;
				}
			})
			.filter((x): x is CacheFile => !!x);

		const totalBytes = cacheFiles.reduce((sum, f) => sum + f.stat.size, 0);
		if (totalBytes <= this.config.maxCacheSizeBytes) return;

		// Sort by mtime ascending (oldest first)
		cacheFiles.sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

		let bytesToFree = totalBytes - this.config.maxCacheSizeBytes;
		for (const file of cacheFiles) {
			if (bytesToFree <= 0) break;

			// Don't delete files currently in use or being cached
			if (file.videoId && (inUseIds.has(file.videoId) || this.cachingTasks.has(file.videoId))) {
				continue;
			}

			try {
				fs.unlinkSync(file.filePath);
				bytesToFree -= file.stat.size;
				Logger.info(`Deleted cached file to enforce size: ${path.basename(file.filePath)}`);
			} catch (error) {
				Logger.error('Error deleting cached file', error);
			}
		}
	}

	private getVideoIdFromFilename(filename: string): string | null {
		if (!filename.endsWith('.ogg')) return null;
		const base = path.basename(filename, '.ogg');
		const id = base.replace('_temp', '');
		// Basic validation for YouTube IDs (11 chars of allowed charset)
		return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
	}

	/**
	 * Sets a function to get currently in use video IDs
	 */
	public setCurrentlyInUseProvider(provider: () => Set<string>): void {
		this.getCurrentlyInUseVideoIds = provider;
	}

	private getCurrentlyInUseVideoIds(): Set<string> {
		// Default implementation - should be overridden by setCurrentlyInUseProvider
		return new Set<string>();
	}
}
