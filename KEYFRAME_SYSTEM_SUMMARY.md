# Transition Kit Keyframe System

This document outlines the keyframe system for the Transition Kit plugin, focusing on how transitions are created and managed in After Effects.

## Core Concepts

### 1. Controller Layer Architecture

The foundation of our transition system is the **controller layer** approach:

- **Empty shape layer** acts as the animation controller
- **Slider effects** on the controller manage opacity transitions
- **Position keyframes** handle slide movements
- **Parent relationship** ties content layers to the controller
- **Expressions** link layer opacity to controller sliders

This architecture allows for:
- Single-point control of complex animations
- Easy modification of transition timing
- Reuse of transition setups
- Clean timeline organization

### 2. Timeline-Aware Positioning

Transitions are created with awareness of the timeline position:

- **Playhead detection** identifies where to create/modify transitions
- **Temporary playhead movement** ensures proper parenting at correct times
- **Marker system** helps identify and track transition points

### 3. Scale-Aware Distance Calculation

To maintain consistent visual transitions across different composition sizes:

- **Reference width** of 786px (standard 2x mobile comp)
- **Proportional scaling** of slide distances
- **Automatic adjustment** based on composition dimensions

## Keyframe Creation Patterns

### Creating a New Transition

```javascript
function createTransitionController(comp, direction, fadeOutDuration, fadeInDuration, slideDistance) {
    // 1. Create empty shape layer
    var controller = comp.layers.addShape();
    controller.name = "TK_Transition_" + getNextTransitionIndex();
    
    // 2. Add sliders for opacity control
    var fadeOutEffect = controller.Effects.addProperty("ADBE Slider Control");
    fadeOutEffect.name = "T1 Opacity 1";
    var fadeInEffect = controller.Effects.addProperty("ADBE Slider Control");
    fadeInEffect.name = "T1 Opacity 2";
    
    // 3. Get current time for keyframe placement
    var currentTime = comp.time;
    
    // 4. Add opacity keyframes
    fadeOutEffect.property("Slider").setValueAtTime(currentTime, 100);
    fadeOutEffect.property("Slider").setValueAtTime(currentTime + fadeOutDuration, 0);
    
    fadeInEffect.property("Slider").setValueAtTime(currentTime, 0);
    fadeInEffect.property("Slider").setValueAtTime(currentTime + fadeInDuration, 100);
    
    // 5. Calculate slide distance based on composition size
    var scaledDistance = calculateSlideDistance(slideDistance, direction, comp.width);
    
    // 6. Add position keyframes based on direction
    var position = controller.transform.position;
    position.setValueAtTime(currentTime, [0, 0]);
    
    // Set end position based on direction
    var endPosition;
    switch(direction) {
        case "left":
            endPosition = [-scaledDistance, 0];
            break;
        case "right":
            endPosition = [scaledDistance, 0];
            break;
        case "up":
            endPosition = [0, -scaledDistance];
            break;
        case "down":
            endPosition = [0, scaledDistance];
            break;
    }
    
    position.setValueAtTime(currentTime + fadeOutDuration, endPosition);
    
    return controller;
}
```

### Adding Exit Animation to Layers

```javascript
function addExitToLayers(selectedLayers, controller, fadeOutSlider) {
    var originalTime = comp.time;
    
    try {
        // Temporarily move playhead to BEFORE slide begins
        comp.time = controller.transform.position.keyTime(1);
        
        // Parent layers and add opacity expressions
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // Parent to controller
            layer.parent = controller;
            
            // Add opacity expression
            var opacityExpression = 'thisComp.layer("' + controller.name + 
                                   '").effect("' + fadeOutSlider.name + '")("Slider")';
            layer.opacity.expression = opacityExpression;
        }
    } finally {
        // Always restore original time
        comp.time = originalTime;
    }
}
```

### Adding Enter Animation to Layers

```javascript
function addEnterToLayers(selectedLayers, controller, fadeInSlider) {
    var originalTime = comp.time;
    
    try {
        // Temporarily move playhead to AFTER slide completes
        comp.time = controller.transform.position.keyTime(2);
        
        // Parent layers and add opacity expressions
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // Parent to controller
            layer.parent = controller;
            
            // Add opacity expression
            var opacityExpression = 'thisComp.layer("' + controller.name + 
                                   '").effect("' + fadeInSlider.name + '")("Slider")';
            layer.opacity.expression = opacityExpression;
        }
    } finally {
        // Always restore original time
        comp.time = originalTime;
    }
}
```

## Handling Bidirectional Transitions

For cases where a transition point needs to support both forward and backward animation:

```javascript
function setupBidirectionalTransition(controller, existingFadeSliders) {
    // Add marker to indicate bidirectional capability
    var marker = new MarkerValue("Bidirectional");
    controller.marker.setValueAtTime(comp.time, marker);
    
    // Reuse existing sliders with inverted expressions
    // For layers going back, we'll use the inverse of the forward sliders
}
```

## Scale-Aware Distance Calculation

```javascript
function calculateSlideDistance(baseDistance, direction, compWidth) {
    // Standard reference width (2x mobile = 786px)
    var referenceWidth = 786;
    
    // Calculate scale factor
    var scaleFactor = compWidth / referenceWidth;
    
    // Scale the distance proportionally
    var scaledDistance = baseDistance * scaleFactor;
    
    return scaledDistance;
}
```

## Timeline Position Detection

To find if the playhead is over an existing transition:

```javascript
function findTransitionAtPlayhead(comp, tolerance) {
    tolerance = tolerance || 0.1; // Default tolerance of 0.1 seconds
    
    // Get current time
    var currentTime = comp.time;
    
    // Look for controller layers
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layers[i];
        
        // Skip if not a controller layer
        if (layer.name.indexOf("TK_Transition_") !== 0) continue;
        
        // Check position keyframes
        if (layer.transform.position.numKeys >= 2) {
            for (var k = 1; k <= layer.transform.position.numKeys; k++) {
                var keyTime = layer.transform.position.keyTime(k);
                
                // If playhead is near this keyframe
                if (Math.abs(keyTime - currentTime) <= tolerance) {
                    return {
                        controller: layer,
                        keyIndex: k,
                        keyTime: keyTime
                    };
                }
            }
        }
    }
    
    // No transition found at playhead
    return null;
}
```

## Best Practices

1. **Always restore playhead position** after temporary movements
2. **Use try/finally blocks** to ensure cleanup even if errors occur
3. **Verify layer selections** before applying transitions
4. **Use neutral slider naming** that doesn't depend on direction
5. **Cache controller references** when possible for performance
6. **Add markers with metadata** to help identify transition points
7. **Scale distances proportionally** based on composition dimensions
8. **Validate parameters** before creating keyframes

## Exact Transition Boundary Detection

### The Problem

Initially, the system used simplistic approaches to detect transitions:

1. **Keyframe-pair assumption**: Assumed transitions were defined by pairs of position keyframes (start, end)
2. **Full keyframe range**: Treated all position keyframes as "one big transition" (e.g., 0.67s to 3.43s)
3. **5-frame tolerance**: Used a 5-frame stability check that created fuzziness in the system

**Issues this caused:**
- Playhead detection was inaccurate when slides had baked keyframes
- Overlap detection failed with complex position animations
- Parenting happened at wrong times (too early or too late)
- System couldn't distinguish between actual movement and static periods

### The Solution: Frame-Perfect Boundary Detection

```javascript
// Find exact transition boundaries by detecting when position values start and stop changing
function findExactTransitionBounds(positionProperty) {
    if (positionProperty.numKeys < 2) {
        var time = positionProperty.keyTime(positionProperty.numKeys || 1);
        return { startTime: time, endTime: time };
    }
    
    var comp = app.project.activeItem;
    var frameRate = comp.frameRate;
    var frameDuration = 1 / frameRate;
    var tolerance = 0.001; // Pixel tolerance for detecting movement
    
    var keyStartTime = positionProperty.keyTime(1);
    var keyEndTime = positionProperty.keyTime(positionProperty.numKeys);
    
    var transitionStart = null;
    var transitionEnd = null;
    var previousPos = null;
    
    // Sample frame by frame to find exact start and end
    for (var time = keyStartTime; time <= keyEndTime; time += frameDuration) {
        var currentPos = positionProperty.valueAtTime(time, false);
        
        if (previousPos !== null) {
            // Check if position changed from previous frame
            var xDiff = Math.abs(currentPos[0] - previousPos[0]);
            var yDiff = Math.abs(currentPos[1] - previousPos[1]);
            var hasMovement = (xDiff > tolerance || yDiff > tolerance);
            
            // Find transition start (first frame with movement)
            if (transitionStart === null && hasMovement) {
                transitionStart = time - frameDuration;
            }
            
            // Update transition end (last frame with movement)
            if (hasMovement) {
                transitionEnd = time;
            }
        }
        
        previousPos = currentPos;
    }
    
    return { startTime: transitionStart, endTime: transitionEnd };
}
```

### Key Features

1. **Frame-by-frame sampling**: Checks position values at every frame
2. **0.001 pixel tolerance**: Ignores floating-point noise while catching real movement
3. **Exact start detection**: First frame where position differs from previous frame  
4. **Exact end detection**: Last frame where position differs from next frame
5. **Handles baked keyframes**: Works with any number of intermediate keyframes

### Integration Throughout System

This exact boundary detection is now used in:

1. **`findTransitionAtPlayhead()`**: Precise playhead-over-transition detection
2. **`checkForOverlap()`**: Accurate overlap prevention using real animation bounds
3. **`addEnterToLayers()`**: Parenting fade-in layers at exact end of movement
4. **All transition timing**: Based on actual animation boundaries, not keyframe existence

### Benefits

- **Frame-perfect accuracy**: No fuzziness in transition detection
- **Handles complex animations**: Works with baked keyframes, easing, etc.
- **Precise overlap detection**: Prevents conflicts only during actual movement periods
- **Correct parenting timing**: Layers positioned exactly where slide ends
- **Robust to different animation styles**: Works regardless of keyframe density

By following these patterns consistently, we maintain a reliable and flexible transition system that works across different composition sizes and supports complex animation sequences.