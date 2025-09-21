#!/bin/bash

# Discord Radio Bot - Systemd Service Installation Script
# This script installs the Discord Radio Bot as a user systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -f "discord-radio-bot.service" ]; then
    print_error "This script must be run from the discord-radio-bot directory"
    print_error "Make sure you have the discord-radio-bot.service file in the current directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
    print_error "Yarn is not installed. Please install Yarn first."
    exit 1
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
    print_error "config.json not found. Please create it based on config.example.json"
    print_info "Copy config.example.json to config.json and add your Discord bot token"
    exit 1
fi

print_info "Starting Discord Radio Bot systemd service installation..."

# Install dependencies
print_info "Installing dependencies..."
yarn install

# Build the project
print_info "Building the project..."
yarn build

# Create systemd user directory if it doesn't exist
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

# Copy service file to systemd user directory
print_info "Installing systemd service file..."
cp discord-radio-bot.service "$SYSTEMD_USER_DIR/"

# Reload systemd daemon
print_info "Reloading systemd daemon..."
systemctl --user daemon-reload

# Enable the service
print_info "Enabling discord-radio-bot service..."
systemctl --user enable discord-radio-bot.service

# Enable linger for the user (allows services to start at boot without login)
print_info "Enabling user linger (allows service to start at boot)..."
sudo loginctl enable-linger "$USER" || print_warning "Could not enable linger. You may need to run: sudo loginctl enable-linger $USER"

print_info "Installation complete!"
echo
print_info "To start the service now:"
echo "  systemctl --user start discord-radio-bot"
echo
print_info "To check service status:"
echo "  systemctl --user status discord-radio-bot"
echo
print_info "To view logs:"
echo "  journalctl --user -u discord-radio-bot -f"
echo
print_info "To stop the service:"
echo "  systemctl --user stop discord-radio-bot"
echo
print_info "To disable auto-start:"
echo "  systemctl --user disable discord-radio-bot"
echo
print_info "The service is now configured to start automatically at system boot."