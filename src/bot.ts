import { PassThrough } from 'stream';
import {
	NoSubscriberBehavior,
	StreamType,
	createAudioPlayer,
	entersState,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	joinVoiceChannel,
	createAudioResource,
	AudioPlayer,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import { GatewayIntentBits } from 'discord-api-types/v10';
import { Client, type VoiceBasedChannel, Events, User } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { token, maxTransmissionGap } = require('../config.json') as {
	token: string;
	device: string;
	type: string;
	maxTransmissionGap: number;
};

// Create cache directory if it doesn't exist
const cacheDir = path.resolve(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
	fs.mkdirSync(cacheDir);
}

// Maps to store per-guild connections, players, and queues
const connections = new Map();
const players = new Map<string, AudioPlayer>();
const queues = new Map<string, { url: string; requester: User }[]>();

function getPlayer(guildId: string) {
	let player = players.get(guildId);
	if (!player) {
		player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play,
				maxMissedFrames: Math.round(maxTransmissionGap / 20),
			},
		});

		player.on('stateChange', (oldState, newState) => {
			if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
				console.log('Playback has stopped. Checking queue for next song.');
				playNextSong(guildId);
			}
		});

		player.on('error', (error) => {
			console.error(`Error: ${error.message} with resource`, error.resource);
		});

		players.set(guildId, player);
	}

	return player;
}

async function connectToChannel(channel: VoiceBasedChannel) {
	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
		connections.set(channel.guild.id, connection);
		return connection;
	} catch (error) {
		connection.destroy();
		throw error;
	}
}

function playNextSong(guildId: string) {
	const queue = queues.get(guildId);
	if (!queue || queue.length === 0) {
		return;
	}

	const song = queue.shift();
	if (!song) {
		return;
	}

	const videoID = ytdl.getVideoID(song.url);
	const cachedFilePath = path.join(cacheDir, `${videoID}.ogg`);

	const player = getPlayer(guildId);

	const connection = connections.get(guildId);
	if (connection) {
		connection.subscribe(player);
	}

	if (fs.existsSync(cachedFilePath)) {
		// Use the cached file
		const resource = createAudioResource(cachedFilePath, {
			inputType: StreamType.OggOpus,
		});
		player.play(resource);
	} else {
		// Download and cache the file while streaming to the player
		const stream = ytdl(song.url, {
			liveBuffer: 25000,
			highWaterMark: 1024 * 1024 * 100,
			quality: 'highestaudio',
			filter: (format) => format.container === 'mp4',
		});

		const inputStream = new PassThrough();
		stream.pipe(inputStream);

		stream.on('error', (error) => {
			console.error('yt-dlp error:', error);
			player.stop();
		});

		const transcodedStream = new PassThrough();

		// Prepare to write to file
		const tempFilePath = path.join(cacheDir, `${videoID}_temp.ogg`);

		// Setup ffmpeg with multiple outputs
		ffmpeg(inputStream)
			.inputOptions(['-analyzeduration', '0'])
			.format('ogg')
			.audioCodec('libopus')
			.audioBitrate('128k')
			// Output to the transcodedStream for immediate playback
			.output(transcodedStream)
			// Output to fileStream for caching
			.output(tempFilePath)
			.on('start', (commandLine) => {
				console.log('Spawned FFmpeg with command: ' + commandLine);
			})
			.on('error', (error) => {
				console.error('FFmpeg error:', error);
				player.stop();
			})
			.on('end', () => {
				// Rename temp file to cached file
				fs.rename(tempFilePath, cachedFilePath, (err) => {
					if (err) {
						console.error('Error renaming temp file:', err);
					} else {
						console.log('Caching complete');
					}
				});
			})
			.run();

		// Handle transcoded stream errors
		transcodedStream.on('error', (error) => {
			console.error('Transcoded stream error:', error);
			player.stop();
		});

		// Create the audio resource from the transcoded stream
		const resource = createAudioResource(transcodedStream, {
			inputType: StreamType.OggOpus,
		});

		// Play the resource
		player.play(resource);
	}
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent,
	],
});

client.on(Events.ClientReady, () => {
	console.log('discord.js client is ready!');
});

client.on(Events.MessageCreate, async (message) => {
	if (!message.guild) return;

	if (message.content.startsWith('-play')) {
		const args = message.content.split(' ');
		const url = args[1];

		if (!url) {
			await message.reply('Please provide a URL to play!');
			return;
		}

		if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
			await message.reply('Only YouTube is supported at the moment!');
			return;
		}

		const voiceChannel = message.member?.voice.channel;
		if (!voiceChannel) {
			await message.reply('You need to be in a voice channel to play music!');
			return;
		}

		// Join the voice channel if not already connected
		let connection = connections.get(message.guild.id);
		if (!connection || connection.state.status === VoiceConnectionStatus.Disconnected) {
			try {
				connection = await connectToChannel(voiceChannel);
			} catch (error) {
				console.error(error);
				await message.reply('Failed to join the voice channel.');
				return;
			}
		}

		// Get or create the queue for this guild
		let queue = queues.get(message.guild.id);
		if (!queue) {
			queue = [];
			queues.set(message.guild.id, queue);
		}

		// Add the song to the queue
		queue.push({ url, requester: message.author });

		await message.reply(`Added to queue: ${url}`);

		const player = getPlayer(message.guild.id);
		connection.subscribe(player);

		// If the player is idle, start playing
		if (player.state.status === AudioPlayerStatus.Idle) {
			playNextSong(message.guild.id);
		}
	}

	if (message.content === '-skip') {
		const player = players.get(message.guild.id);
		if (player && player.state.status !== AudioPlayerStatus.Idle) {
			player.stop();
			await message.reply('Skipped the current song.');
		} else {
			await message.reply('No song is currently playing.');
		}
	}

	if (message.content === '-queue') {
		const queue = queues.get(message.guild.id);
		if (queue && queue.length > 0) {
			const queueString = queue
				.map((song, index) => `${index + 1}. ${song.url} (requested by ${song.requester.username})`)
				.join('\n');
			await message.reply(`Current queue:\n${queueString}`);
		} else {
			await message.reply('The queue is empty.');
		}
	}

	if (message.content === '-leave') {
		const connection = connections.get(message.guild.id);
		if (connection) {
			connection.destroy();
			connections.delete(message.guild.id);
			players.delete(message.guild.id);
			queues.delete(message.guild.id);
			await message.reply('Left the voice channel.');
		} else {
			await message.reply('I am not in a voice channel.');
		}
	}
});

void client.login(token);
