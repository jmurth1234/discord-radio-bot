#!/bin/bash

# Discord Radio Bot - Systemd Service Uninstallation Script
# This script removes the Discord Radio Bot systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_info "Uninstalling Discord Radio Bot systemd service..."

# Stop and disable the service if it's running
if systemctl --user is-active --quiet discord-radio-bot.service; then
    print_info "Stopping discord-radio-bot service..."
    systemctl --user stop discord-radio-bot.service
    print_success "Service stopped"
fi

if systemctl --user is-enabled --quiet discord-radio-bot.service; then
    print_info "Disabling discord-radio-bot service..."
    systemctl --user disable discord-radio-bot.service
    print_success "Service disabled"
fi

# Remove service file
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SYSTEMD_USER_DIR/discord-radio-bot.service"

if [ -f "$SERVICE_FILE" ]; then
    print_info "Removing service file..."
    rm "$SERVICE_FILE"
    print_success "Service file removed"
else
    print_warning "Service file not found at $SERVICE_FILE"
fi

# Reload systemd daemon
print_info "Reloading systemd daemon..."
systemctl --user daemon-reload

# Note about linger
print_info "Note: User linger was not disabled. If you want to disable it, run:"
print_info "  sudo loginctl disable-linger $USER"

print_success "Uninstallation complete!"
print_info "The Discord Radio Bot systemd service has been removed."
print_info "The bot files and configuration remain in the current directory."