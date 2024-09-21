# Discord Radio Bot

A feature-rich Discord bot for playing music in voice channels, built with discord.js and @discordjs/voice. This bot serves as a proof-of-concept radio bot, capable of streaming audio from YouTube and managing a queue system.

## Features

- Play YouTube audio in Discord voice channels
- Queue system for multiple songs
- Skip current song
- View current queue
- Caching system for faster playback of previously played songs

## Commands

- `-play [YouTube URL or search query]`: Add a song or playlist to the queue and start playing if not already
- `-skip`: Skip the current song
- `-pause`: Pause the current song
- `-resume`: Resume the paused song
- `-volume [0-100]`: Set the volume of the bot
- `-loop [off/song/queue]`: Set the loop mode
- `-queue`: View the current song queue and loop mode
- `-leave`: Make the bot leave the voice channel

## Installation

1. Clone this repository
2. Install dependencies using Yarn:
   ```
   yarn install
   ```
3. Create a `config.json` file in the root directory with the following content:
   ```json
   {
     "token": "YOUR_DISCORD_BOT_TOKEN",
     "maxTransmissionGap": 5000
   }
   ```
4. Replace `YOUR_DISCORD_BOT_TOKEN` with your actual Discord bot token

## Usage

You can run the bot using one of the following commands:

- For development:
  ```
  yarn start
  ```
- For production:
  ```
  yarn prod
  ```

Make sure you have invited the bot to your Discord server and granted it necessary permissions.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
