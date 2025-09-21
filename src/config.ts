import fs from 'fs';
import path from 'path';
import type { BotConfig } from './types.js';

/**
 * Validates and loads the bot configuration
 */
export class ConfigManager {
	private config: BotConfig;

	constructor(configPath = '../config.json') {
		this.config = this.loadConfig(configPath);
		this.validateConfig();
	}

	private loadConfig(configPath: string): BotConfig {
		try {
			const fullPath = path.resolve(__dirname, configPath);
			const configContent = fs.readFileSync(fullPath, 'utf8');
			return JSON.parse(configContent) as BotConfig;
		} catch (error) {
			throw new Error(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private validateConfig(): void {
		const errors: string[] = [];

		if (!this.config.token || typeof this.config.token !== 'string') {
			errors.push('token is required and must be a string');
		}

		if (typeof this.config.maxTransmissionGap !== 'number' || this.config.maxTransmissionGap < 0) {
			errors.push('maxTransmissionGap must be a positive number');
		}

		if (this.config.maxCacheSizeMB !== undefined && (typeof this.config.maxCacheSizeMB !== 'number' || this.config.maxCacheSizeMB < 0)) {
			errors.push('maxCacheSizeMB must be a positive number if provided');
		}

		if (errors.length > 0) {
			throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
		}
	}

	public getConfig(): Readonly<BotConfig> {
		return { ...this.config };
	}

	public getToken(): string {
		return this.config.token;
	}

	public getMaxTransmissionGap(): number {
		return this.config.maxTransmissionGap;
	}

	public getMaxCacheSizeMB(): number {
		return this.config.maxCacheSizeMB ?? 1024;
	}
}