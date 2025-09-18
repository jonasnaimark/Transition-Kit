# Transition Kit Plugin Changelog

All notable changes to the Transition Kit plugin will be documented in this file.

## [1.1.0] - 2025-09-18 ✨ **CURRENT RELEASE**

### ✨ Major New Features
- **Automatic Missing Marker Detection** - When adding layers to transitions, the system now automatically detects if those layers are part of other transitions elsewhere on the timeline and adds appropriate markers for all relevant transitions
- **Smart Controller Positioning** - Controller layers now position correctly below selected layers instead of above them
- **Enhanced Layer Management** - Improved layer parenting and expression linking system

### 🔧 Technical Improvements  
- Added `addMissingTransitionMarkers()` function that scans for cross-transition layer relationships
- Fixed controller positioning logic to account for layer index shifts after creation
- Enhanced transition detection with precise movement analysis
- Improved debug logging for better troubleshooting
- Added comprehensive transition delete/insert planning documentation

### 🐛 Bug Fixes
- Fixed controller layer appearing above selected layers instead of below
- Resolved expression linking issues when layers span multiple transitions
- Improved timeline position detection accuracy with floating-point tolerance

## [1.0.0] - 2025-09-16

### ✨ Added
- Initial project setup with core functionality
- Slide-in and fade transition support
- Direction controls (left, right, up, down)
- Configurable fade durations
- Scale-aware transition distances
- Debug panel for development

### 🎨 UI Features
- Transition type selection dropdown
- Add Exit and Add Enter buttons
- Duration input fields with adjustment controls
- Direction selection buttons
- Scale transition controls
- Effect toggle options

### 🔧 Technical Implementation
- Controller layer system for transitions
- Timeline position detection
- Scale-aware distance calculation
- Expression-based opacity control
- Layer parenting architecture