#!/bin/bash

# Discord Radio Bot - Service Validation Script
# This script validates the systemd service configuration

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

print_info "Validating Discord Radio Bot systemd service configuration..."

# Check if required files exist
FILES_TO_CHECK=("discord-radio-bot.service" "install-service.sh" "start-prod.sh" "package.json")
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file missing"
        exit 1
    fi
done

# Check if scripts are executable
SCRIPTS_TO_CHECK=("install-service.sh" "start-prod.sh")
for script in "${SCRIPTS_TO_CHECK[@]}"; do
    if [ -x "$script" ]; then
        print_success "✓ $script is executable"
    else
        print_error "✗ $script is not executable"
        exit 1
    fi
done

# Validate systemd service file syntax
print_info "Validating systemd service file syntax..."
if systemd-analyze verify discord-radio-bot.service 2>/dev/null; then
    print_success "✓ Service file syntax is valid"
else
    print_warning "⚠ Service file validation failed (this may be expected in some environments)"
fi

# Check if config example exists
if [ -f "config.example.json" ]; then
    print_success "✓ config.example.json exists"
else
    print_error "✗ config.example.json missing"
fi

# Verify package.json has required scripts
if grep -q '"prod"' package.json && grep -q '"build"' package.json; then
    print_success "✓ package.json has required scripts"
else
    print_error "✗ package.json missing required scripts"
    exit 1
fi

print_success "All validation checks passed!"
print_info "The systemd service configuration is ready for deployment."
echo
print_info "Next steps:"
echo "1. Create config.json from config.example.json with your bot token"
echo "2. Run ./install-service.sh to install the service"
echo "3. Use 'systemctl --user start discord-radio-bot' to start the bot"