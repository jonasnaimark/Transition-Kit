#!/bin/bash
echo "🚀 Syncing Transition Kit to development environment..."

# Source directory
SOURCE_DIR="/Users/jonas_naimark/Documents/transition-kit-plugin"

# Development extension directory  
DEV_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/transitionkit-dev"

# Create the CEP extensions directory if it doesn't exist
mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"

# Remove existing symlink if it exists
if [ -L "$DEV_DIR" ]; then
    echo "Removing existing symlink..."
    rm "$DEV_DIR"
fi

# Create the symlink
echo "Creating development symlink..."
ln -sf "$SOURCE_DIR" "$DEV_DIR"

if [ $? -eq 0 ]; then
    echo "✅ Development environment ready!"
    echo "📁 Extension linked to: $DEV_DIR"
else
    echo "❌ Error: Failed to create symlink"
    exit 1
fi

# Enable CEP debugging
echo "Enabling CEP debug mode..."
defaults write com.adobe.CSXS.9.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.10.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.11.plist PlayerDebugMode 1

echo "✅ CEP debug mode enabled"
echo ""
echo "🔄 To test changes:"
echo "1. Make your code changes"
echo "2. Restart After Effects"
echo "3. Look for 'Transition Kit Dev' in Window > Extensions menu"
echo ""
echo "💡 No ZXP building needed during development!"

