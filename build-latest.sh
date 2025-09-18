#!/bin/bash

# Transition Kit Plugin Production Build Script
# Creates a production ZXP file for distribution

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Define paths and filenames
PLUGIN_DIR="$HOME/Documents/transition-kit-plugin"
TEMP_DIR="$PLUGIN_DIR/temp-package"
DIST_DIR="$PLUGIN_DIR/dist"
TIMESTAMP=$(date "+%Y%m%d")
VERSION=$(grep "ExtensionBundleVersion" "$PLUGIN_DIR/CSXS/manifest.xml" | sed -E 's/.*ExtensionBundleVersion="([0-9.]+)".*/\1/')
OUTPUT_FILE="TransitionKit-v$VERSION.zxp"

# Check for certificate
if [ ! -f "$PLUGIN_DIR/new-cert.p12" ]; then
    echo -e "${RED}ERROR: Certificate not found at $PLUGIN_DIR/new-cert.p12${NC}"
    exit 1
fi

# Create directories if they don't exist
mkdir -p "$TEMP_DIR"
mkdir -p "$DIST_DIR"

echo -e "${YELLOW}Starting production build for Transition Kit v$VERSION...${NC}"

# 1. Copy files to temp directory
echo "Copying files to temporary directory..."
cp -r "$PLUGIN_DIR/CSXS" "$PLUGIN_DIR/client" "$PLUGIN_DIR/jsx" "$PLUGIN_DIR/assets" "$TEMP_DIR/"

# 2. Update manifest for production
echo "Converting manifest to production mode..."
sed -i '' 's/com\.transitionkit\.panel\.dev/com.transitionkit.panel/g' "$TEMP_DIR/CSXS/manifest.xml"
sed -i '' 's/Transition Kit Dev/Transition Kit/g' "$TEMP_DIR/CSXS/manifest.xml"

# 3. Remove [DEV MODE] and debug button from HTML
echo "Removing development markers from HTML..."
sed -i '' 's/\[DEV MODE\]//g' "$TEMP_DIR/client/index.html"
sed -i '' '/<button.*debug-btn.*>.*<\/button>/d' "$TEMP_DIR/client/index.html"

# 4. Package as ZXP
echo "Creating ZXP package..."
"$PLUGIN_DIR/ZXPSignCmd" -sign "$TEMP_DIR" "$DIST_DIR/$OUTPUT_FILE" new-cert.p12 "password" 

# Check if packaging was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Production build successful!${NC}"
    echo -e "ZXP file created: ${GREEN}$DIST_DIR/$OUTPUT_FILE${NC}"
else
    echo -e "${RED}❌ Build failed. Check errors above.${NC}"
    exit 1
fi

# 5. Clean up
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Build process completed!${NC}"