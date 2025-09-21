import {
	VoiceConnection,
	VoiceConnectionStatus,
	joinVoiceChannel,
	entersState,
} from '@discordjs/voice';
import type { VoiceBasedChannel, GuildMember } from 'discord.js';
import type { GuildStateManager } from './guild-state-manager.js';
import { Logger } from './logger.js';

/**
 * Manages voice connections for guilds
 */
export class VoiceConnectionManager {
	private readonly guildStateManager: GuildStateManager;

	constructor(guildStateManager: GuildStateManager) {
		this.guildStateManager = guildStateManager;
	}

	/**
	 * Connects to a voice channel
	 */
	public async connectToChannel(channel: VoiceBasedChannel): Promise<VoiceConnection> {
		try {
			const connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: channel.guild.id,
				adapterCreator: channel.guild.voiceAdapterCreator,
			});

			// Wait for the connection to be ready
			await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
			
			// Store the connection
			this.guildStateManager.setConnection(channel.guild.id, connection);
			
			// Set up connection event handlers
			this.setupConnectionEventHandlers(connection, channel.guild.id);

			Logger.info(`Connected to voice channel ${channel.name} in guild ${channel.guild.id}`);
			return connection;
		} catch (error) {
			Logger.error(`Failed to connect to voice channel ${channel.name}`, error);
			throw error;
		}
	}

	/**
	 * Disconnects from a voice channel
	 */
	public disconnectFromChannel(guildId: string): boolean {
		const connection = this.guildStateManager.getConnection(guildId);
		
		if (connection) {
			connection.destroy();
			this.guildStateManager.clearGuildState(guildId);
			Logger.info(`Disconnected from voice channel in guild ${guildId}`);
			return true;
		}

		return false;
	}

	/**
	 * Checks if the bot is connected to a voice channel in a guild
	 */
	public isConnected(guildId: string): boolean {
		const connection = this.guildStateManager.getConnection(guildId);
		return !!(connection && connection.state.status !== VoiceConnectionStatus.Disconnected);
	}

	/**
	 * Gets the current voice connection for a guild
	 */
	public getConnection(guildId: string): VoiceConnection | undefined {
		return this.guildStateManager.getConnection(guildId);
	}

	/**
	 * Checks if a user is in the same voice channel as the bot
	 */
	public isUserInSameChannel(member: GuildMember): boolean {
		const connection = this.guildStateManager.getConnection(member.guild.id);
		
		// If bot is not connected, allow the command
		if (!connection) {
			return true;
		}

		// Check if user is in the same channel as the bot
		return connection.joinConfig.channelId === member.voice.channelId;
	}

	/**
	 * Reconnects to a voice channel if disconnected
	 */
	public async ensureConnection(guildId: string, channel: VoiceBasedChannel): Promise<VoiceConnection> {
		const existingConnection = this.guildStateManager.getConnection(guildId);
		
		if (existingConnection && existingConnection.state.status !== VoiceConnectionStatus.Disconnected) {
			return existingConnection;
		}

		return await this.connectToChannel(channel);
	}

	private setupConnectionEventHandlers(connection: VoiceConnection, guildId: string): void {
		connection.on('stateChange', (oldState, newState) => {
			Logger.debug(`Voice connection state changed in guild ${guildId}: ${oldState.status} -> ${newState.status}`);
			
			if (newState.status === VoiceConnectionStatus.Disconnected) {
				Logger.info(`Voice connection disconnected in guild ${guildId}`);
				// Clean up guild state when disconnected
				this.guildStateManager.clearGuildState(guildId);
			}
		});

		connection.on('error', (error) => {
			Logger.error(`Voice connection error in guild ${guildId}`, error);
		});
	}
}