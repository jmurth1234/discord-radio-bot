// Import additional modules
import {
	AudioPlayer,
	AudioPlayerStatus,
	AudioResource,
	NoSubscriberBehavior,
	StreamType,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import {
	Client,
	Events,
	GatewayIntentBits,
	GuildMember,
	User,
	type VoiceBasedChannel,
} from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import { Video, YouTube } from 'youtube-sr'; // Import for search and playlist support

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
const connections = new Map<string, any>();
const players = new Map<string, AudioPlayer>();
const queues = new Map<string, { url: string; requester: User; title: string }[]>();
const volumes = new Map<string, number>(); // Store volume levels per guild
const loopModes = new Map<string, 'off' | 'song' | 'queue'>(); // Loop mode per guild
const currentSongs = new Map<string, { url: string; requester: User; title: string }>(); // Currently playing song per guild

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
				void playNextSong(guildId);
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

async function playNextSong(guildId: string) {
	// Handle looping modes
	const loopMode = loopModes.get(guildId) || 'off';
	const currentSong = currentSongs.get(guildId);

	const queue = queues.get(guildId);
	if (!queue) {
		return;
	}

	if (currentSong) {
		if (loopMode === 'song' && currentSong) {
			queue.unshift(currentSong);
		} else if (loopMode === 'queue') {
			queue.push(currentSong);
		}
	}

	const song = queue.shift();

	if (!song) {
		return;
	}

	currentSongs.set(guildId, song);

	const videoID = ytdl.getVideoID(song.url);
	const cachedFilePath = path.join(cacheDir, `${videoID}.ogg`);

	const player = getPlayer(guildId);

	const connection = connections.get(guildId);
	if (connection) {
		connection.subscribe(player);
	}

	// Get the volume for the guild or default to 1 (100%)
	const volume = volumes.get(guildId) ?? 1;

	if (fs.existsSync(cachedFilePath)) {
		// Use the cached file
		const resource = createAudioResource(cachedFilePath, {
			inputType: StreamType.OggOpus,
			inlineVolume: true,
		});
		resource.volume?.setVolume(volume);
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
			// Output to file for caching
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
			inlineVolume: true,
		});
		resource.volume?.setVolume(volume);

		// Play the resource
		player.play(resource);
	}
}

async function searchYouTube(query: string): Promise<Video | null> {
	try {
		const results = await YouTube.search(query, { type: 'video' });
		return results[0] || null;
	} catch (error) {
		console.error('YouTube search error:', error);
		return null;
	}
}

async function getYouTubePlaylist(url: string): Promise<Video[]> {
	try {
		const playlist = await YouTube.getPlaylist(url);
		const videos = await playlist.fetch();
		return videos.videos;
	} catch (error) {
		console.error('YouTube playlist error:', error);
		return [];
	}
}

function isUserInSameVoiceChannel(member: GuildMember): boolean {
	const guildId = member.guild.id;
	const connection = connections.get(guildId);

	if (!connection) return true;
	return connection.joinConfig.channelId === member.voice.channelId;
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
	if (message.author.bot) return;

	const prefix = '-';
	if (!message.content.startsWith(prefix)) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift()?.toLowerCase();

	// Check if the user is in the same voice channel as the bot
	if (
		['play', 'skip', 'pause', 'resume', 'volume', 'loop', 'leave'].includes(command!) &&
		!isUserInSameVoiceChannel(message.member!)
	) {
		await message.reply('You need to be in the same voice channel as the bot to use this command.');
		return;
	}

	if (command === 'play') {
		let query = args.join(' ');
		let url = '';
		let title = '';

		if (!query) {
			await message.reply('Please provide a URL or search terms to play!');
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

		// Check if the query is a YouTube playlist
		if (YouTube.isPlaylist(query)) {
			const videos = await getYouTubePlaylist(query);
			if (videos.length === 0) {
				await message.reply('No videos found in the playlist.');
				return;
			}

			// Get or create the queue for this guild
			let queue = queues.get(message.guild.id);
			if (!queue) {
				queue = [];
				queues.set(message.guild.id, queue);
			}

			// Add all videos to the queue
			videos.forEach((video) => {
				queue!.push({
					url: `https://www.youtube.com/watch?v=${video.id}`,
					requester: message.author,
					title: video.title || 'Unknown Title',
				});
			});

			await message.reply(`Added ${videos.length} songs from the playlist to the queue.`);

			const player = getPlayer(message.guild.id);
			connection.subscribe(player);

			// If the player is idle, start playing
			if (player.state.status === AudioPlayerStatus.Idle) {
				void playNextSong(message.guild.id);
			}
		} else {
			// Single video
			if (ytdl.validateURL(query)) {
				url = query;
				// Get video info for title
				const info = await ytdl.getInfo(url);
				title = info.videoDetails.title;
			} else {
				// Search YouTube for the query
				const video = await searchYouTube(query);
				if (video) {
					url = `https://www.youtube.com/watch?v=${video.id}`;
					title = video.title || 'Unknown Title';
				} else {
					await message.reply('No results found on YouTube for your query.');
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
			queue.push({ url, requester: message.author, title });

			await message.reply(`Added to queue: **${title}**`);

			const player = getPlayer(message.guild.id);
			connection.subscribe(player);

			// If the player is idle, start playing
			if (player.state.status === AudioPlayerStatus.Idle) {
				void playNextSong(message.guild.id);
			}
		}
	}

	if (command === 'skip') {
		const player = players.get(message.guild.id);
		if (player && player.state.status !== AudioPlayerStatus.Idle) {
			player.stop();
			await message.reply('Skipped the current song.');
		} else {
			await message.reply('No song is currently playing.');
		}
	}

	if (command === 'pause') {
		const player = players.get(message.guild.id);
		if (player && player.state.status === AudioPlayerStatus.Playing) {
			player.pause();
			await message.reply('Paused the current song.');
		} else {
			await message.reply('No song is currently playing.');
		}
	}

	if (command === 'resume') {
		const player = players.get(message.guild.id);
		if (player && player.state.status === AudioPlayerStatus.Paused) {
			player.unpause();
			await message.reply('Resumed the current song.');
		} else {
			await message.reply('No song is currently paused.');
		}
	}

	if (command === 'volume') {
		const volumeArg = args[0];
		if (!volumeArg) {
			await message.reply('Please provide a volume level between 0 and 100.');
			return;
		}

		const volume = parseInt(volumeArg, 10);
		if (isNaN(volume) || volume < 0 || volume > 100) {
			await message.reply('Volume must be a number between 0 and 100.');
			return;
		}

		volumes.set(message.guild.id, volume / 100);

		// If a song is currently playing, adjust its volume
		const player = players.get(message.guild.id);
		if (player && player.state.status !== AudioPlayerStatus.Idle) {
			const resource = player.state.resource as AudioResource;
			if (resource && resource.volume) {
				resource.volume.setVolume(volume / 100);
				await message.reply(`Volume set to ${volume}%.`);
			}
		} else {
			await message.reply(`Volume set to ${volume}%.`);
		}
	}

	if (command === 'loop') {
		const loopArg = args[0]?.toLowerCase();
		if (!loopArg || !['off', 'song', 'queue'].includes(loopArg)) {
			await message.reply('Please specify a loop mode: off, song, or queue.');
			return;
		}

		loopModes.set(message.guild.id, loopArg as 'off' | 'song' | 'queue');
		await message.reply(`Loop mode set to ${loopArg}.`);
	}

	if (command === 'queue') {
		const queue = queues.get(message.guild.id);
		if (queue && (queue.length > 0 || currentSongs.get(message.guild.id) !== undefined)) {
			const formatSong = (song: { title: string; requester: User }) => `**${song.title}** (requested by ${song.requester.username})`
			let queueString = `__Now Playing__ \n\n${formatSong(currentSongs.get(message.guild.id)!)}\n\n__Queue:__\n\n`;
			
			queueString += queue
				.slice(0, 10) // Limit to first 10 songs to prevent long messages
				.map(
					(song, index) => `${index + 1}. ${formatSong(song)}`
				)
				.join('\n');

			queueString += `\n\n__Loop Mode:__ ${loopModes.get(message.guild.id) || 'off'}`;

			await message.reply(queueString);
		} else {
			await message.reply('The queue is empty.');
		}
	}

	if (command === 'leave') {
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
