#!/bin/bash

# Discord Radio Bot - Production Start Script
# This script ensures the bot runs with proper production settings

# Set environment variables for production
export NODE_ENV=production

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Check if the bot is built
if [ ! -f "dist/bot.js" ]; then
    echo "Bot not built. Building now..."
    yarn build
fi

# Start the bot
exec node dist/bot.js