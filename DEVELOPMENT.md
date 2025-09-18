# Transition Kit Plugin Development Guide

**Comprehensive technical documentation for developers working on the Transition Kit After Effects plugin**

## Environment Setup

### Critical: Development Environment Check

**ALWAYS verify your dev environment before starting work after context loss!**

#### Quick Dev Environment Verification
```bash
# 1. Check if dev extension exists
ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/transitionkit-dev"

# 2. Should show: transitionkit-dev -> /Users/jonas_naimark/Documents/transition-kit-plugin

# 3. Check manifest is in DEV mode
grep "com.transitionkit.panel.dev" ~/Documents/transition-kit-plugin/CSXS/manifest.xml

# 4. Should show: ExtensionBundleId="com.transitionkit.panel.dev"
```

#### Setting Up Development Environment

**Step 1: Fix Manifest (CRITICAL)**
```bash
cd ~/Documents/transition-kit-plugin
```

Edit `CSXS/manifest.xml` - Change these lines:
```xml
<!-- FROM (Production): -->
ExtensionBundleId="com.transitionkit.panel"
ExtensionBundleName="Transition Kit"
<Extension Id="com.transitionkit.panel" Version="1.0.0" />
<Extension Id="com.transitionkit.panel">
<Menu>Transition Kit</Menu>

<!-- TO (Development): -->
ExtensionBundleId="com.transitionkit.panel.dev"
ExtensionBundleName="Transition Kit Dev"
<Extension Id="com.transitionkit.panel.dev" Version="1.0.0" />
<Extension Id="com.transitionkit.panel.dev">
<Menu>Transition Kit Dev</Menu>
```

**Step 2: Enable CEP Debugging**
```bash
defaults write com.adobe.CSXS.9.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.10.plist PlayerDebugMode 1
defaults write com.adobe.CSXS.11.plist PlayerDebugMode 1
```

**Step 3: Create Development Symlink**
```bash
cd ~/Documents/transition-kit-plugin
./dev-sync.sh
```

**Step 4: Restart After Effects**
- Quit After Effects completely
- Wait 5 seconds
- Restart After Effects
- Look for "Transition Kit Dev" in Window > Extensions

#### Verifying Dev Environment is Working

When you open "Transition Kit Dev" you should see:
- ✅ **"Transition Kit [DEV MODE]"** in the header
- ✅ **🐛 Debug button** next to Transition Kit header
- ✅ **Debug panel appears** when clicking the debug button
- ✅ **File changes reflect immediately** (after AE restart)

#### Emergency Recovery Commands

If you lose your dev environment completely:
```bash
# 1. Restore from GitHub
cd ~/Documents
git clone https://github.com/jonasnaimark/TransitionKit.git transition-kit-plugin-recovery
cp -r transition-kit-plugin-recovery/* transition-kit-plugin/

# 2. Fix manifest for dev mode (see Step 1 above)

# 3. Recreate symlink
cd ~/Documents/transition-kit-plugin
./dev-sync.sh

# 4. Enable CEP debugging (see Step 2 above)

# 5. Restart After Effects
```

#### Key Files to Monitor

- **`CSXS/manifest.xml`** - Should contain `.dev` extensions IDs
- **`client/index.html`** - Should contain `[DEV MODE]` and debug button
- **Symlink** - Should exist at `~/Library/Application Support/Adobe/CEP/extensions/transitionkit-dev`

## Development Workflow

### Daily Development Workflow

#### Starting Development:
1. **Verify dev environment**: `ls -la "$HOME/Library/Application Support/Adobe/CEP/extensions/transitionkit-dev"`
2. **Check manifest is dev mode**: `grep "\.dev" ~/Documents/transition-kit-plugin/CSXS/manifest.xml`
3. **Open After Effects** → Window > Extensions → **"Transition Kit Dev"**

#### Making Changes:
1. **Edit files** in `~/Documents/transition-kit-plugin/`
2. **Save files**
3. **Restart After Effects** to see changes
4. **Use debug panel** to troubleshoot

#### Two Extension Versions
- **"Transition Kit"** = Production version (from installed ZXP)
- **"Transition Kit Dev"** = Development version (live files with [DEV MODE] indicator)

### Critical Technical Patterns

#### The Scale-Aware System

**This is essential for the transitions to work correctly across compositions of different sizes.**

**The Problem:**
- Slide distances need to adapt to composition dimensions
- Default values work well at standard sizes but break at other scales
- We need consistent visual transitions regardless of comp size

**The Solution: Proportional Scaling Based on Composition Width**

```javascript
// Calculate slide distance based on composition width
function getScaledSlideDistance(baseDistance, compWidth) {
    // Reference width (786px at 2x)
    var referenceWidth = 786;
    
    // Scale the distance proportionally
    return baseDistance * (compWidth / referenceWidth);
}

// Usage example
var slideDistance = getScaledSlideDistance(200, comp.width);
```

#### Playhead Positioning System

**Essential for timeline-aware layer placement:**

```javascript
// Set layer start time to current playhead position
try {
    var playheadTime = comp.time;
    newLayer.startTime = playheadTime;
} catch(timeError) {
    $.writeln("Playhead positioning failed: " + timeError.toString());
}
```

### Adding New Features

#### Pattern for New Interactive Sections

**1. HTML Structure**
```html
<section class="section">
    <h2 class="section-header">Feature Name</h2>
    <div class="control-row">
        <select id="featureType" class="dropdown">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
        </select>
        <button id="addFeature" class="main-button">Add Feature</button>
    </div>
</section>
```

**2. JavaScript Event Handler**
```javascript
// Add Feature button handler
var addFeatureButton = document.getElementById('addFeature');
addFeatureButton.addEventListener('click', function() {
    console.log('Add Feature clicked');
    
    // Get selected feature type
    var featureType = document.getElementById('featureType').value;
    
    // Disable button while working
    addFeatureButton.disabled = true;
    addFeatureButton.textContent = 'Adding...';
    
    // Pass the extension path to the JSX
    var setPathScript = 'var extensionRoot = "' + extensionPath.replace(/\\/g, '\\\\') + '";';
    csInterface.evalScript(setPathScript);
    
    // Call the After Effects script
    var script = 'addFeatureFromPanel("' + featureType + '")';
    csInterface.evalScript(script, function(result) {
        // Re-enable button
        addFeatureButton.disabled = false;
        addFeatureButton.textContent = 'Add Feature';
    });
});
```

**3. ExtendScript Implementation**
```javascript
function addFeatureFromPanel(featureType) {
    try {
        // Get active composition
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error";
        }
        
        // Feature-specific implementation
        // ...
        
        return "success";
    } catch(e) {
        alert("Error adding feature: " + e.toString());
        return "error";
    }
}
```

### UI Development Guidelines

#### Unified CSS System

Use these classes for consistency:

```css
/* All sections use this */
.section {
    margin-bottom: 16px; 
    padding-bottom: 2px;
    border-bottom: 1px solid #3a3a3a;
}

/* All interactive rows use this */
.control-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    align-items: stretch;
}
```

#### Adding New Sections
1. **HTML**: Use `<section class="section">` wrapper
2. **Header**: Use `<h2 class="section-header">` for titles
3. **Controls**: Use `<div class="control-row">` for dropdowns + buttons
4. **Buttons**: Use `class="main-button"` for primary actions
5. **Dropdowns**: Use `class="dropdown"` for select elements

### Performance Optimizations

#### Controller Layer Management
- Store references to controller layers for reuse
- Use efficient lookups for timeline position detection
- Cache controller references when possible

#### Layer Operations
- Clear layer selections before operations
- Verify operations succeeded with appropriate checks
- Use try/catch blocks for non-critical operations
- Minimize After Effects API calls in loops

#### Error Handling
```javascript
// Always wrap AE operations in try/catch
try {
    // AE operation here
} catch(error) {
    $.writeln("Operation failed: " + error.toString());
    // Graceful fallback or user notification
}
```

### Git Protection for Dev Environment

When you push to GitHub, the build script temporarily changes the manifest to production mode, but this shouldn't affect your local dev files.

**Manual Protection Commands:**
```bash
# Before any git push, run:
cp CSXS/manifest.xml CSXS/manifest.xml.dev-backup

# After git push, restore dev mode:
cd ~/Documents/transition-kit-plugin
./dev-sync.sh
# Then fix manifest.xml if needed (see Step 1 above)
```

## Debugging

### CRITICAL: Plugin Debug System

**NEVER use After Effects' built-in debugging tools - they don't work with our plugin!**

#### What DOESN'T Work
```javascript
// WRONG - This goes to ExtendScript console which is not accessible
$.writeln("Debug message");
console.log("Debug message"); // JavaScript only, not ExtendScript
alert("Debug message"); // Intrusive and blocks workflow
```

#### What DOES Work - Our Plugin Debug System

**Step 1: Using the Plugin Debug Panel**
1. **Click the 🐛 Debug button** in the header section
2. **Debug panel opens** as floating overlay in top-right corner
3. **All debug messages appear here** - this is the ONLY place to see ExtendScript debug output

**Step 2: ExtendScript Debug Messages (jsx/main.jsx)**
```javascript
// CORRECT - Use our DEBUG_JSX system
DEBUG_JSX.log("Function called with params: " + param1);
DEBUG_JSX.error("Something failed", error);
DEBUG_JSX.info("Status update", data);
```

**Step 3: Making Functions Debug-Ready**
```javascript
// Pattern for new functions that need debugging
function yourNewFunction(param1, param2) {
    try {
        // Clear previous debug messages
        DEBUG_JSX.clear();
        
        DEBUG_JSX.log("yourNewFunction called with: " + param1 + ", " + param2);
        
        // Your function logic here
        // More DEBUG_JSX.log() calls as needed
        
        // Include debug messages in result
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|result_data|" + debugMessages.join("|");
        
    } catch(e) {
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + e.toString() + "|" + debugMessages.join("|");
    }
}
```

#### Debug Panel Features
- **🎬 Color-coded messages** - Blue for functions, red for errors
- **📋 Copy button** - Copies all debug text to clipboard
- **🗑️ Clear button** - Clears all messages
- **❌ Close button** - Closes the debug panel
- **📜 Auto-scroll** - Always shows latest messages
- **📝 Selectable text** - Click and drag to select specific messages

#### Common Debugging Workflows

**New Feature Development:**
1. Open 🐛 Debug panel
2. Clear existing messages
3. Add `DEBUG_JSX.log()` calls in your ExtendScript function
4. Test the feature
5. Read debug messages to understand execution flow

**Bug Investigation:**
1. Open 🐛 Debug panel
2. Clear messages
3. Reproduce the bug
4. Read debug output to identify where it fails
5. Copy messages for documentation

#### Why This System Exists

**After Effects ExtendScript runs in isolation** - there's no accessible console, no browser dev tools, no way to see debug output. Our debug panel is the ONLY way to see what's happening in ExtendScript functions.

## Version Management

### Version Number Format

We follow Semantic Versioning 2.0.0: **MAJOR.MINOR.PATCH**

```
1.0.0
│ │ └── PATCH: Bug fixes, minor improvements
│ └──── MINOR: New features, backward compatible
└────── MAJOR: Breaking changes, major features
```

### Version Increment Rules

**PATCH Version (x.x.X)** - Increment when:
- Fixing bugs
- Minor performance improvements
- Typo corrections
- Small UI adjustments
- Documentation fixes

**MINOR Version (x.X.x)** - Increment when:
- Adding new features
- Adding new transition presets
- Adding new transition parameters
- Non-breaking improvements

**MAJOR Version (X.x.x)** - Increment when:
- Breaking API changes
- Major UI overhaul
- Removing features
- Changing core functionality

### Files to Update

When updating versions, update these files:

1. **CSXS/manifest.xml**
```xml
ExtensionBundleVersion="1.0.0"
```

2. **jsx/main.jsx**
```javascript
var PLUGIN_VERSION = "1.0.0";
```

3. **CHANGELOG.md**
```markdown
## [1.0.0] - 2024-01-15
### Added
- Initial release
```

### ZXP Build Policy

**⚠️ IMPORTANT: NEVER build ZXP files automatically!**
- **ALWAYS ask the user first** before building any ZXP files
- ZXP builds should only happen when explicitly requested by the user
- Do not proactively create ZXP files during development or git operations

### Production vs Development ZXP

**Production ZXP** (`TransitionKit-v1.0.0.zxp`) - For sharing:
```bash
# Use the production build script (RECOMMENDED for sharing)
./build-latest.sh

# This automatically:
# - Removes [DEV MODE] markers from HTML
# - Removes debug button from production build
# - Converts com.transitionkit.panel.dev → com.transitionkit.panel
# - Changes "Transition Kit Dev" → "Transition Kit"
```

**Development ZXP** (`TransitionKit_v1.0.0.zxp`) - For testing:
```bash
# Manual dev build (for testing only)
rm -rf temp-package && mkdir temp-package
cp -r CSXS client jsx assets temp-package/
./ZXPSignCmd -sign temp-package dist/TransitionKit_v1.0.0.zxp new-cert.p12 mypassword
rm -rf temp-package
```

| Feature | Development ZXP | Production ZXP |
|---------|-----------------|----------------|
| **Extension Name** | "Transition Kit Dev" | "Transition Kit" |
| **Extension ID** | com.transitionkit.panel.dev | com.transitionkit.panel |
| **Debug Button** | ✅ Visible | ❌ Removed |
| **[DEV MODE] Labels** | ✅ Shown | ❌ Removed |
| **Intended Use** | Testing/Development | Public Sharing |

### Git Workflow and Version Updates

**Required Main Branch Push Checklist:**

1. **Update manifest.xml version** (increment MAJOR.MINOR.PATCH)
2. **Update CHANGELOG.md** with new version entry and detailed changes
3. **Build new ZXP** with incremented version number (if requested)
4. **Test functionality** (if applicable)
5. **Commit with version number** in commit message
6. **Push to main branch**

**CHANGELOG.md Update Format:**
```markdown
## [X.X.X] - YYYY-MM-DD ✨ **CURRENT RELEASE**
### ✨ Added
- New features and functionality

### 🎨 UI Improvements  
- Interface and design changes

### 🔧 Technical Details
- Implementation details and technical changes
- Associated with TransitionKit_vX.X.X.zxp
```

## Common Pitfalls to Avoid

### 1. Timeline Position Detection Issues
- **DON'T** rely solely on layer names for finding transitions
- **DON'T** assume keyframe times are exact matches (use tolerances)
- **DO** implement proper playhead position verification

### 2. Layer Parenting Problems
- **DON'T** parent layers at incorrect times
- **DON'T** forget to restore playhead positions after moves
- **DO** use the temporary playhead positioning pattern

### 3. UI Consistency Issues
- **DON'T** create custom CSS classes for spacing
- **DON'T** use different HTML structures for similar features
- **DO** follow the unified `.section` and `.control-row` pattern

### 4. Opacity Expression Management
- **DON'T** create expressions that are hard to invert
- **DON'T** name sliders with directional terminology
- **DO** use neutral naming and handle direction in expressions

## Testing Guidelines

### Manual Testing Checklist
1. **Fresh AE Project**: Test with completely new projects
2. **Multiple Transitions**: Add several exit/enter transitions in sequence
3. **Different Compositions**: Test with various composition sizes
4. **Playhead Positions**: Test at various timeline positions
5. **Error Conditions**: Test with no composition selected and no layers selected
6. **Performance**: Check for UI freezes or delays

### Regression Testing
- **Transition Creation**: Verify transitions are created correctly
- **Playhead Awareness**: Confirm playhead positioning works
- **Layer Parenting**: Ensure layers parent at correct times
- **UI Responsiveness**: Ensure buttons re-enable after operations

## Reference Materials

### ExtendScript Documentation
- [Adobe After Effects Scripting Guide](https://ae-scripting.docsforadobe.dev/)
- [ExtendScript API Reference](https://extendscript.docsforadobe.dev/)

### CEP Framework
- [Adobe CEP Documentation](https://github.com/Adobe-CEP/CEP-Resources)
- [CSInterface API](https://github.com/Adobe-CEP/CEP-Resources/tree/master/CEP_9.x)

---

**Remember: The timeline position detection and playhead manipulation system is critical for proper transitions. When in doubt, follow the established patterns exactly.**