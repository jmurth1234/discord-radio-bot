import { Client, Events, GatewayIntentBits } from 'discord.js';
import path from 'path';
import { ConfigManager } from './config.js';
import { Logger } from './logger.js';
import { CacheManager } from './cache-manager.js';
import { YouTubeService } from './youtube-service.js';
import { GuildStateManager } from './guild-state-manager.js';
import { VoiceConnectionManager } from './voice-connection-manager.js';
import { AudioManager } from './audio-manager.js';
import { CommandManager } from './commands/command-manager.js';
import { PlayCommand } from './commands/play-command.js';
import { SkipCommand, PauseCommand, ResumeCommand } from './commands/playback-commands.js';
import { VolumeCommand, LoopCommand } from './commands/settings-commands.js';
import { QueueCommand, LeaveCommand } from './commands/utility-commands.js';
import type { CacheConfig } from './types.js';

/**
 * Main bot class that orchestrates all components
 */
export class DiscordRadioBot {
	private readonly client: Client;
	private readonly configManager: ConfigManager;
	private readonly cacheManager: CacheManager;
	private readonly guildStateManager: GuildStateManager;
	private readonly voiceManager: VoiceConnectionManager;
	private readonly audioManager: AudioManager;
	private readonly commandManager: CommandManager;

	constructor() {
		this.configManager = new ConfigManager();
		const config = this.configManager.getConfig();

		// Initialize Discord client
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.MessageContent,
			],
		});

		// Initialize cache manager
		const cacheDir = path.resolve(__dirname, 'cache');
		const cacheConfig: CacheConfig = {
			maintenanceIntervalMs: 10 * 60 * 1000, // 10 minutes
			tempFileTtlMs: 30 * 60 * 1000, // 30 minutes
			maxCacheSizeBytes: Math.max(0, Math.floor(this.configManager.getMaxCacheSizeMB() * 1024 * 1024)),
		};
		this.cacheManager = new CacheManager(cacheDir, cacheConfig);

		// Initialize state and connection managers
		this.guildStateManager = new GuildStateManager(config.maxTransmissionGap);
		this.voiceManager = new VoiceConnectionManager(this.guildStateManager);

		// Initialize audio manager
		this.audioManager = new AudioManager(this.guildStateManager, this.cacheManager);
		
		// Set up circular reference for event handling
		this.guildStateManager.setAudioManager(this.audioManager);

		// Initialize command manager and register commands
		this.commandManager = new CommandManager('-', this.voiceManager);
		this.registerCommands();

		// Set up cache manager to get currently playing video IDs
		this.cacheManager.setCurrentlyInUseProvider(() => 
			this.guildStateManager.getCurrentlyPlayingVideoIds()
		);

		// Set up event handlers
		this.setupEventHandlers();
	}

	/**
	 * Starts the bot
	 */
	public async start(): Promise<void> {
		try {
			Logger.info('Starting Discord Radio Bot...');
			await this.client.login(this.configManager.getToken());
		} catch (error) {
			Logger.error('Failed to start bot', error);
			throw error;
		}
	}

	/**
	 * Stops the bot
	 */
	public async stop(): Promise<void> {
		Logger.info('Stopping Discord Radio Bot...');
		this.cacheManager.stopMaintenance();
		this.client.destroy();
	}

	private registerCommands(): void {
		// Register all commands
		this.commandManager.registerCommand(new PlayCommand(
			YouTubeService,
			this.voiceManager,
			this.guildStateManager,
			this.audioManager
		));
		
		this.commandManager.registerCommand(new SkipCommand(this.audioManager));
		this.commandManager.registerCommand(new PauseCommand(this.audioManager));
		this.commandManager.registerCommand(new ResumeCommand(this.audioManager));
		this.commandManager.registerCommand(new VolumeCommand(this.audioManager));
		this.commandManager.registerCommand(new LoopCommand(this.guildStateManager));
		this.commandManager.registerCommand(new QueueCommand(this.guildStateManager));
		this.commandManager.registerCommand(new LeaveCommand(this.voiceManager));

		Logger.info(`Registered ${this.commandManager.getCommands().size} commands`);
	}

	private setupEventHandlers(): void {
		this.client.on(Events.ClientReady, () => {
			Logger.info(`Bot ready! Logged in as ${this.client.user?.tag}`);
			
			// Start cache maintenance
			this.cacheManager.startMaintenance();
		});

		this.client.on(Events.MessageCreate, async (message) => {
			await this.commandManager.processMessage(message);
		});

		this.client.on('error', (error) => {
			Logger.error('Discord client error', error);
		});

		// Set up audio player state change handler
		this.setupAudioEventHandlers();
	}

	private setupAudioEventHandlers(): void {
		// We need to set up a way for the audio manager to trigger next song playback
		// This could be improved with an event system, but for now we'll handle it directly
		// The audio manager will need access to play next song when current song ends
	}
}