# Transition Kit Plugin - Implementation Plan

## Core Architecture

### UI Layer
- **HTML/CSS Interface**: Based on mockup with preset selector and control panels
- **Event Handlers**: Connect UI interactions to ExtendScript functions
- **Parameter Management**: Track/validate user inputs before sending to AE
- **UI Reuse**: Leverage existing UI components and structure from airboard-plugin for consistency and faster development
- **Debug Panel**: Port over the existing debug panel from airboard-plugin for development troubleshooting

### ExtendScript Bridge
- **Command Dispatcher**: Routes UI actions to appropriate functions
- **Composition Analysis**: Detect active comp, dimensions, selected layers
- **Error Handling**: Validate operations and provide feedback

### Animation Engine
- **Controller Layer**: Empty shape layers as animation controllers
- **Keyframe Generation**: Position and opacity keyframes based on user settings
- **Expression Linking**: Connect layer opacity to controller sliders
- **Timeline Analysis**: Detect existing transitions for proper insertion

## Transition Logic Flow

### Unified Logic for Both "Add Exit" and "Add Enter":

1. **Check for Controller**: Search ALL layers in the composition for any existing TK_Transition controller
   - If NO controller exists → Create new controller and add transition at playhead position
   - If controller exists → Continue to step 2

2. **Check Playhead Position**: Is playhead over existing transition keyframes on the controller?
   - If NO (not over transition) → Add NEW transition at current playhead position
   - If YES (over existing transition) → Update/modify that existing transition

3. **Apply Transition Based on Button**:
   
   **For "Add Exit":**
   - If creating new transition: Add fade-out keyframes (0→150ms default)
   - If updating existing: Link selected layers' opacity to that transition's fade-out slider
   - Parent layers to controller
   - Apply opacity expression linking to appropriate slider
   
   **For "Add Enter":**
   - If creating new transition: Add fade-in keyframes (150→400ms default, starts after fade-out duration)
   - If updating existing: Link selected layers' opacity to that transition's fade-in slider
   - Parent layers to controller
   - Apply opacity expression linking to appropriate slider

### Key Behaviors:
- **Multiple Transitions**: Single controller can have multiple transitions at different timeline positions
- **Independent Operations**: Add Enter can be used before Add Exit (creates fade-in first)
- **Timeline Aware**: Each transition is tied to specific timeline position via keyframes
- **Layer Specific**: Only affects currently selected layers, not all layers in comp
- **Overlap Prevention**: System prevents adding transitions that would overlap with existing ones
- **Visual Markers**: Adds descriptive markers to help identify transitions

### Error Prevention
- **Overlapping Transitions**: Before adding a new transition, check if keyframes would overlap with existing transitions
- **Alert Message**: Show "Can't add overlapping transitions" if overlap detected
- **Safe Distance**: Transitions must not overlap in their keyframe ranges

### Visual Labeling System

#### Controller Layer
- **Name**: "Slide and fade - Controller" (instead of numbered naming)
- **Markers**: Add marker at start of each transition showing direction:
  - "Slide →" for right
  - "Slide ←" for left
  - "Slide ↑" for up
  - "Slide ↓" for down

#### Selected Layers
- **Exit Layers**: Add marker "Fade-out" when Add Exit is applied
- **Enter Layers**: Add marker "Fade-in" when Add Enter is applied
- **Marker Position**: Place at the time when the layer is parented to controller

## Slider Management

### Dynamic Slider Numbering
- Sliders are numbered based on transition count: T1, T2, T3, etc.
- Each transition gets two sliders:
  - `"T[n] Opacity 1"` - Fade out control (100→0)
  - `"T[n] Opacity 2"` - Fade in control (0→100)
- When adding new transition, increment transition number based on existing keyframes

### Slider Reuse Logic
- When playhead is over existing transition:
  - Reuse that transition's sliders for new layers
  - Apply appropriate expressions to link opacity
- Multiple layers can share same slider controls

### Transition Parameters

#### Slide Direction
- Direction arrows work as radio buttons (mutually exclusive selection)
- Options: Left, Right, Up, Down
- Default: Left
- Direction determines the end position of the slide animation

#### Timing (User Configurable)
- **Fade Out**: 0ms → [fadeOutDuration input] (default 150ms, linear)
- **Fade In**: [fadeOutDuration] → [fadeOutDuration + fadeInDuration] (default 150→400ms, linear)
- **Slide**: 0ms → 500ms with Easy Ease applied to position keyframes
- All values are read from UI inputs and can be changed by user

#### Slide Distance (User Configurable)
- **Distance**: [slideDistance input] pixels (default 200px)
- Input value is scale-aware based on composition width
- Reference: 200px at 786px width (2x resolution)
- Automatically scales proportionally for other composition sizes

#### Keyframe Easing
- Position keyframes: Apply Easy Ease directly to keyframes (not via expressions)
- Opacity keyframes: Linear by default (can be adjusted manually)

## Implementation Phases

### Phase 1: MVP
- Basic slide-in and fade transitions
- Single direction (left-right)
- Controller layer creation
- Basic parenting and expression linking
- Port and adapt relevant UI components from airboard-plugin
- Port documentation MD files from airboard-plugin (development, keyframe, production builds)

### Phase 2: Core Features
- Multiple slide directions
- Playhead position detection
- Controller reuse logic
- Scale-aware slide distances
- Basic validation and alerts
- Debug panel implementation from airboard-plugin
- GitHub backup and versioning based on airboard-plugin workflow

### Phase 3: Refinement
- Overlap parameter implementation
- Smart slider management for complex cases
- Improve UI feedback
- Performance optimizations
- Production build scripts adapted from airboard-plugin

### Phase 4: Advanced Features
- Blue diamond actions for individual parameters
- Additional transition types
- Easing presets
- Extended customization options

## Documentation & Knowledge Transfer

Port over and adapt the following MD files from airboard-plugin:
- **DEVELOPMENT.md**: Development environment setup and workflows
- **KEYFRAME_SYSTEM_SUMMARY.md**: Keyframe creation and management techniques
- **PRODUCTION_BUILD.md**: Build process for production releases
- **TECHNICAL_DOCS.md**: Technical architecture and implementation details
- **CLAUDE_CONTEXT.md**: Context for future development assistance
- Other relevant documentation files

This will ensure consistency in development practices and leverage existing knowledge on CEP plugin development, keyframe management, and After Effects integration.