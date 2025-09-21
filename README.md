# Discord Radio Bot

A feature-rich Discord bot for playing music in voice channels, built with discord.js and @discordjs/voice. This bot serves as a proof-of-concept radio bot, capable of streaming audio from YouTube and managing a queue system.

## Features

- Play YouTube audio in Discord voice channels
- Queue system for multiple songs
- Skip current song
- View current queue
- Caching system for faster playback of previously played songs
  - Background caching separate from live playback
  - Periodic cleanup of stale temp files
  - Configurable cache size cap via `maxCacheSizeMB` (default 1024 MB)

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
   	"maxTransmissionGap": 5000,
   	"maxCacheSizeMB": 1024
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

## Production Deployment with Systemd

For production deployment, you can set up the bot as a systemd user service that will automatically start on system boot.

### Prerequisites

- Node.js and Yarn installed
- Systemd (available on most Linux distributions)
- Proper `config.json` file with your Discord bot token

### Installation

1. **Clone and setup the bot** (if not already done):

   ```bash
   git clone https://github.com/jmurth1234/discord-radio-bot.git
   cd discord-radio-bot
   cp config.example.json config.json
   # Edit config.json and add your Discord bot token
   ```

2. **Run the installation script**:

   ```bash
   ./install-service.sh
   ```

   This script will:

   - Install dependencies and build the project
   - Install the systemd service file
   - Enable the service for automatic startup
   - Configure user linger for boot-time startup

### Service Management

After installation, you can manage the bot service with these commands:

- **Start the service**:

  ```bash
  systemctl --user start discord-radio-bot
  ```

- **Stop the service**:

  ```bash
  systemctl --user stop discord-radio-bot
  ```

- **Check service status**:

  ```bash
  systemctl --user status discord-radio-bot
  ```

- **View logs**:

  ```bash
  journalctl --user -u discord-radio-bot -f
  ```

- **Restart the service**:

  ```bash
  systemctl --user restart discord-radio-bot
  ```

- **Disable auto-start**:
  ```bash
  systemctl --user disable discord-radio-bot
  ```

### Service Features

- **Automatic startup**: The bot will start automatically when the system boots
- **Auto-restart**: If the bot crashes, it will automatically restart after 10 seconds
- **Logging**: All output is logged to the system journal
- **Security**: Runs with restricted permissions for enhanced security
- **User-level**: Installed as a user service, no root privileges required

### Manual Installation

If you prefer to install the systemd service manually:

1. **Build the project**:

   ```bash
   yarn install --production
   yarn build
   ```

2. **Create systemd user directory**:

   ```bash
   mkdir -p ~/.config/systemd/user
   ```

3. **Copy the service file**:

   ```bash
   cp discord-radio-bot.service ~/.config/systemd/user/
   ```

4. **Enable and start the service**:

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable discord-radio-bot.service
   systemctl --user start discord-radio-bot.service
   ```

5. **Enable user linger** (for auto-start at boot):
   ```bash
   sudo loginctl enable-linger $USER
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
