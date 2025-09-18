# Delete Transition Feature Implementation Plan

This document outlines the plan for adding a "Delete Transition" feature to the Transition Kit plugin, allowing users to remove transitions from the timeline while maintaining animation integrity.

## 1. Core Feature Design

- **Button Location**: Add "Delete Transition" button to main UI panel below existing transition controls
- **Behavior**: Deletes the transition at current playhead position, adjusts subsequent transitions
- **Timeline Approach**: Keep subsequent transitions at their current timeline positions (no time shifting)
- **Scope**: Handle single transition deletion with proper cleanup and adjustment of all dependent elements

## 2. Transition Identification & Collection

- **Playhead Detection**: Leverage existing `findTransitionAtPlayhead()` function with floating-point tolerance
- **Complete Transition Mapping**: Create system to identify ALL elements of a transition:
  - Position keyframes (including all baked keyframes)
  - Slider effects and their keyframes
  - Opacity expressions on affected layers
  - Markers on controller and content layers

## 3. Position Recalculation System

- **Movement Analysis**: Calculate the total position delta contributed by the deleted transition
- **Keyframe Adjustment**: Apply inverse position delta to ALL keyframes of subsequent transitions
- **Baked Keyframe Handling**: Process every individual keyframe in complex animations, not just start/end
- **Spatial Integrity**: Preserve relative positions between keyframes and maintain animation paths
- **Multi-axis Support**: Handle x/y movement in all four directions (left/right/up/down)

## 4. Expression & Slider Management

- **Expression Collection**: Find all layers with opacity expressions linked to deleted transition sliders
- **Expression Remapping**: Update expression references to point to appropriate remaining sliders
- **Slider Renumbering**: Rename all sliders after deleted transition (e.g., T3→T2, T4→T3)
- **Slider Cleanup**: Remove slider effects associated with deleted transition
- **Orphaned Layer Handling**: Detect and fix any layers left without proper slider references

## 5. Layer Handling for Deleted Transitions

- **Visual Identification**:
  - Add "Removed -" prefix to layer names
  - Apply red label color to affected layers
  - Add marker to layers with text "Removed from transition"
- **Expression Handling**:
  - Remove opacity expressions that linked to deleted sliders
  - Reset opacity to 100% (or another configurable default)
  - Remove parenting relationship to controller layer
- **User Options**:
  - Leave layers intact but clearly marked for manual deletion
  - Don't automatically delete layers (too destructive)
  - Maintain their timeline position and content

## 6. Implementation Details

- **Target Context**: Only affect transitions after the deleted one, leave earlier transitions untouched
- **Undo Support**: Group all operations to enable single undo for entire deletion
- **Error Handling**: Detect and report issues if deletion can't be completed safely
- **Visual Feedback**: Show success/failure message after operation

## 7. Technical Approach

- **Step 1**: Identify transition at playhead position
- **Step 2**: Store position offset contributed by this transition
- **Step 3**: Collect all affected elements (keyframes, sliders, expressions)
- **Step 4**: Gather list of all subsequent transitions and their elements
- **Step 5**: Process layers affected by deletion (red labels, name prefixes)
- **Step 6**: Delete the target transition completely (keyframes, sliders)
- **Step 7**: Apply position adjustments to all subsequent transitions
- **Step 8**: Renumber and remap all sliders and expressions
- **Step 9**: Verify integrity of animation sequence

## 8. Usability Considerations

- **Selection Verification**: Confirm with user before deletion (optional alert)
- **Visual Indicator**: Highlight which transition will be deleted
- **Button State**: Only enable button when playhead is over an actual transition
- **Documentation**: Add help text explaining the feature's behavior

## 9. Testing Protocol

- **Test Cases**:
  - Delete single transition with simple keyframes
  - Delete transition with baked position curves
  - Delete transition with multiple layers bound to it
  - Delete transition from middle of complex sequence
  - Test on all direction types (left/right/up/down)
  - Verify behavior at 30fps vs 60fps timelines
  - Verify orphaned layer handling (visual marking, expression removal)

## 10. Implementation Challenges

- **Baked Keyframe Complexity**: Requires applying position offsets to potentially hundreds of keyframes
- **Expression Management**: Needs robust system to update all layer expression references
- **Controller Integrity**: Must maintain animation flow across sequence boundaries
- **Undo Safety**: Needs to handle complex multi-object changes in a single undo operation

This plan provides a comprehensive approach to implementing a robust "Delete Transition" feature that handles the complex interconnections in the transition system while maintaining animation integrity.