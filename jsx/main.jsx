// Transition Kit - ExtendScript for After Effects
// Main script file that handles all After Effects operations

// Global variable to store extension path (set by the panel)
var extensionRoot = "";

// Plugin version
var PLUGIN_VERSION = "1.0.0";

// Debug utilities for ExtendScript
var DEBUG_JSX = {
    messages: [],
    log: function(message, data) {
        var logMsg = "TransitionKit: " + message + (data ? " | " + data : "");
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    error: function(message, error) {
        var logMsg = "❌ TransitionKit Error: " + message + " | " + error.toString();
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    info: function(message, data) {
        var logMsg = "ℹ️ TransitionKit Info: " + message + (data ? " | " + data : "");
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    clear: function() {
        this.messages = [];
    },
    getMessages: function() {
        return this.messages.slice(); // Return a copy
    },
    // Helper function to format time as milliseconds for debug output
    formatTime: function(seconds) {
        return Math.round(seconds * 1000) + "ms";
    }
};

// Helper function to convert ms/frames to seconds for AE timeline
function timeToSeconds(timeValue) {
    // If already a number, assume it's seconds
    if (typeof timeValue === 'number') {
        return timeValue;
    }
    
    // Convert string (e.g., "150ms" or "10f") to seconds
    if (typeof timeValue === 'string') {
        // Extract number and unit
        var matches = timeValue.match(/^(\d+(?:\.\d+)?)(ms|s|f)$/);
        if (matches) {
            var value = parseFloat(matches[1]);
            var unit = matches[2];
            
            switch(unit) {
                case 'ms': 
                    return value / 1000;
                case 's': 
                    return value;
                case 'f': 
                    // Convert frames to seconds based on comp frameRate
                    // Default to 30fps if comp not available
                    var frameRate = app.project.activeItem ? app.project.activeItem.frameRate : 30;
                    return value / frameRate;
            }
        }
    }
    
    // Default fallback (return as is)
    return timeValue;
}

// Calculate scale-aware slide distance based on composition size
function calculateSlideDistance(baseDistance, direction, compWidth) {
    // Default reference width (2x resolution = 786px width)
    var referenceWidth = 786;
    
    // Default distance if no width provided
    if (!compWidth) return baseDistance;
    
    // Calculate scale factor
    var scaleFactor = compWidth / referenceWidth;
    
    // Scale the distance proportionally
    return baseDistance * scaleFactor;
}

// Find any existing controller in the composition
function findExistingController(comp) {
    for (var i = 1; i <= comp.numLayers; i++) {
        var layer = comp.layers[i];
        if (layer.name === "Slide and fade - Controller") {
            return layer;
        }
    }
    return null;
}

// Get the next transition index for a controller (T1, T2, T3...)
function getNextTransitionNumber(controller) {
    var maxNum = 0;
    
    // Check all effects on controller to find highest T number for slider naming
    if (controller.Effects && controller.Effects.numProperties > 0) {
        for (var i = 1; i <= controller.Effects.numProperties; i++) {
            var effect = controller.Effects.property(i);
            var match = effect.name.match(/Transition (\d+) - Opacity/);
            if (match) {
                var num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            }
        }
    }
    
    return maxNum + 1;
}

// Get the next opacity number for a specific transition (Opacity 1, Opacity 2, etc.)
function getNextOpacityNumber(controller, transitionNumber) {
    var maxOpacityNum = 0;
    
    // Check all effects on controller to find highest opacity number for this specific transition
    if (controller.Effects && controller.Effects.numProperties > 0) {
        for (var i = 1; i <= controller.Effects.numProperties; i++) {
            var effect = controller.Effects.property(i);
            var match = effect.name.match(new RegExp("Transition " + transitionNumber + " - Opacity (\\d+)"));
            if (match) {
                var opacityNum = parseInt(match[1]);
                if (opacityNum > maxOpacityNum) maxOpacityNum = opacityNum;
            }
        }
    }
    
    return maxOpacityNum + 1;
}

// Find or create a transition controller
function getOrCreateTransitionController(comp, transitionType, params) {
    try {
        DEBUG_JSX.log("Checking for existing controller in comp");
        
        // First, check if ANY controller exists in the composition
        var controller = findExistingController(comp);
        
        if (controller) {
            DEBUG_JSX.log("Found existing controller: " + controller.name);
            
            // Check if playhead is over an existing transition
            var transitionInfo = findTransitionAtPlayhead(comp, controller);
            
            if (transitionInfo) {
                DEBUG_JSX.log("Playhead is over existing transition T" + transitionInfo.transitionNumber);
                return {
                    controller: controller,
                    isNew: false,
                    transitionNumber: transitionInfo.transitionNumber,
                    updateExisting: true,
                    transitionStart: transitionInfo.startTime,
                    transitionEnd: transitionInfo.endTime
                };
            } else {
                // Not over existing transition, will add new transition
                var newTransitionNum = getNextTransitionNumber(controller);
                DEBUG_JSX.log("Adding new transition T" + newTransitionNum + " at current time");
                return {
                    controller: controller,
                    isNew: false,
                    transitionNumber: newTransitionNum,
                    updateExisting: false
                };
            }
        }
        
        // No existing controller found, create a new one
        DEBUG_JSX.log("Creating new transition controller");
        
        // FIRST: Get selected layer indices BEFORE creating controller (so indices don't shift)
        var selectedLayerIndices = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layers[i].selected) {
                selectedLayerIndices.push(i);
            }
        }
        
        // Find the bottommost selected layer (highest original index)
        var bottomMostOriginalIndex = 0;
        for (var s = 0; s < selectedLayerIndices.length; s++) {
            if (selectedLayerIndices[s] > bottomMostOriginalIndex) {
                bottomMostOriginalIndex = selectedLayerIndices[s];
            }
        }
        
        // Create empty shape layer (adds at top by default, shifting all other layers down by 1)
        controller = comp.layers.addShape();
        controller.name = "Slide and fade - Controller";
        
        if (selectedLayerIndices.length > 0) {
            // We want controller to be just below the original selected layer position
            // So if layer 2 was selected, controller should go to position 3
            var targetIndex = bottomMostOriginalIndex + 1;
            
            // Clamp to valid range
            if (targetIndex > comp.numLayers) {
                targetIndex = comp.numLayers; // Will be at bottom
            }
            
            // Move controller to target position using correct AE methods
            if (targetIndex <= comp.numLayers) {
                controller.moveBefore(comp.layers[targetIndex]);
            } else {
                controller.moveAfter(comp.layers[comp.numLayers]);
            }
            
            DEBUG_JSX.log("Controller positioned at index " + controller.index + " (below original selected layer " + bottomMostOriginalIndex + ")");
        } else {
            DEBUG_JSX.log("Controller created: " + controller.name + " at index " + controller.index + " (no positioning - no selected layers)");
        }
        
        return {
            controller: controller,
            isNew: true,
            transitionNumber: 1,
            updateExisting: false
        };
    } catch(e) {
        DEBUG_JSX.error("Error creating transition controller", e);
        throw e;
    }
}

// Get next controller index for naming
function getNextControllerIndex(comp) {
    var index = 1;
    var namePattern = /TK_Transition_(\d+)/;
    
    // Scan all layers to find highest index
    for (var i = 1; i <= comp.numLayers; i++) {
        var match = comp.layers[i].name.match(namePattern);
        if (match && parseInt(match[1]) >= index) {
            index = parseInt(match[1]) + 1;
        }
    }
    
    return index;
}

// Find if playhead is over an existing transition on a specific controller
function findTransitionAtPlayhead(comp, controller, tolerance) {
    var currentTime = comp.time;
    DEBUG_JSX.log("findTransitionAtPlayhead: currentTime=" + currentTime);
    
    // Check position keyframes to find transitions
    var position = controller.property("Transform").property("Position");
    if (position.numKeys >= 2) {
        DEBUG_JSX.log("Found " + position.numKeys + " position keyframes");
        
        // Find all distinct transitions
        var allTransitions = findAllTransitions(position);
        
        // Check which transition the playhead is over
        for (var i = 0; i < allTransitions.length; i++) {
            var transition = allTransitions[i];
            DEBUG_JSX.log("Checking T" + transition.transitionNumber + " transition: " + transition.startTime + " to " + transition.endTime);
            
            // Use tolerance for floating-point precision issues
            var playheadTolerance = 0.001; // 1ms tolerance
            if (currentTime >= (transition.startTime - playheadTolerance) && currentTime <= (transition.endTime + playheadTolerance)) {
                DEBUG_JSX.log("✓ Playhead IS within T" + transition.transitionNumber + " transition bounds (with tolerance)");
                return {
                    transitionNumber: transition.transitionNumber,
                    startTime: transition.startTime,
                    endTime: transition.endTime
                };
            }
        }
        
        DEBUG_JSX.log("✗ Playhead NOT within any transition bounds");
    }
    
    DEBUG_JSX.log("Playhead is not over any existing transition");
    return null;
}

// Check if new transition would overlap with existing ones
function checkForOverlap(controller, startTime, endTime) {
    var position = controller.transform.position;
    
    if (position.numKeys >= 2) {
        // Get all discrete transitions to check against each one individually
        var allTransitions = findAllTransitions(position);
        
        DEBUG_JSX.log("Checking overlap: new transition " + startTime + "-" + endTime + " vs " + allTransitions.length + " existing transitions");
        
        // Check if the new transition would overlap with any existing transition
        for (var i = 0; i < allTransitions.length; i++) {
            var existing = allTransitions[i];
            DEBUG_JSX.log("Checking against T" + (i+1) + " transition: " + existing.startTime + "-" + existing.endTime);
            
            if ((startTime >= existing.startTime && startTime <= existing.endTime) ||
                (endTime >= existing.startTime && endTime <= existing.endTime) ||
                (startTime <= existing.startTime && endTime >= existing.endTime)) {
                DEBUG_JSX.log("Overlap detected with T" + (i+1) + " transition");
                return true; // Overlap detected
            }
        }
    }
    
    DEBUG_JSX.log("No overlap detected");
    return false; // No overlap
}

// Check if selected layers already have existing fade markers within the current transition timeframe
function checkForExistingFadeMarkers(selectedLayers, transitionType, controller, currentTime) {
    // First, find the current transition timeframe if playhead is over one
    var transitionStart = null;
    var transitionEnd = null;
    
    if (controller) {
        var position = controller.transform.position;
        
        // Find which transition the playhead is over
        for (var k = 1; k < position.numKeys; k += 2) {
            var existingStart = position.keyTime(k);
            var existingEnd = position.keyTime(k + 1);
            
            // Check if playhead is within this transition
            if (currentTime >= existingStart && currentTime <= existingEnd) {
                transitionStart = existingStart;
                transitionEnd = existingEnd;
                DEBUG_JSX.log("Playhead is within transition from " + DEBUG_JSX.formatTime(transitionStart) + " to " + DEBUG_JSX.formatTime(transitionEnd));
                break;
            }
        }
    }
    
    // If not over a transition, no need to check for conflicts
    if (transitionStart === null) {
        DEBUG_JSX.log("Playhead not over existing transition - no marker conflict check needed");
        return false;
    }
    
    var currentMarkerPrefix;
    if (transitionType === "fadeOut") {
        currentMarkerPrefix = "Fade Out";
    } else if (transitionType === "fadeIn") {
        currentMarkerPrefix = "Fade In";
    }
    
    // Check each selected layer for existing fade markers within this transition timeframe
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        
        // Check all markers on this layer
        if (layer.marker && layer.marker.numKeys > 0) {
            for (var m = 1; m <= layer.marker.numKeys; m++) {
                var markerTime = layer.marker.keyTime(m);
                var marker = layer.marker.keyValue(m);
                var markerComment = marker.comment;
                
                // Check if this marker is within the current transition timeframe
                if (markerTime >= transitionStart && markerTime <= transitionEnd) {
                    // Check if this marker is a fade marker (either Fade In or Fade Out)
                    if (markerComment.indexOf("Fade Out") === 0 || markerComment.indexOf("Fade In") === 0) {
                        var existingType = markerComment.indexOf("Fade Out") === 0 ? "fadeOut" : "fadeIn";
                        var existingTypeName = existingType === "fadeOut" ? "Fade Out" : "Fade In";
                        var currentTypeName = transitionType === "fadeOut" ? "Fade Out" : "Fade In";
                        
                        DEBUG_JSX.log("Found existing fade marker within transition on layer: " + layer.name + " - " + markerComment + " at " + markerTime);
                        
                        if (existingType === transitionType) {
                            // Same type - definitely can't add
                            DEBUG_JSX.log("Cannot add " + currentTypeName + " - layer already has " + existingTypeName + " marker in this transition");
                            return true;
                        } else {
                            // Different type - also can't add (layer should only have one fade type per transition)
                            DEBUG_JSX.log("Cannot add " + currentTypeName + " - layer already has " + existingTypeName + " marker in this transition");
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false; // No existing fade markers found within current transition
}

// Analyze keyframes to determine if they represent fade-out or fade-in pattern
function analyzeKeyframePattern(sliderProp, transitionStart, transitionEnd) {
    var keyframesInTransition = [];
    
    // Collect all keyframes within the transition timeframe
    for (var k = 1; k <= sliderProp.numKeys; k++) {
        var keyTime = sliderProp.keyTime(k);
        if (keyTime >= transitionStart && keyTime <= transitionEnd) {
            var keyValue = sliderProp.keyValue(k);
            keyframesInTransition.push({time: keyTime, value: keyValue});
        }
    }
    
    // Sort keyframes by time
    keyframesInTransition.sort(function(a, b) { return a.time - b.time; });
    
    if (keyframesInTransition.length < 2) {
        return null; // Need at least 2 keyframes to determine pattern
    }
    
    var firstKey = keyframesInTransition[0];
    var lastKey = keyframesInTransition[keyframesInTransition.length - 1];
    
    // Fade-out pattern: starts high (near 100) and ends low (near 0)
    if (firstKey.value >= 90 && lastKey.value <= 10) {
        return "fadeOut";
    }
    
    // Fade-in pattern: starts low (near 0) and ends high (near 100)  
    if (firstKey.value <= 10 && lastKey.value >= 90) {
        return "fadeIn";
    }
    
    return null; // Unrecognized pattern
}

// Find any existing slider with keyframes in the transition timeframe
function findSliderForTransition(controller, transitionStart, transitionEnd) {
    DEBUG_JSX.log("findSliderForTransition called with timeframe: " + DEBUG_JSX.formatTime(transitionStart) + " to " + DEBUG_JSX.formatTime(transitionEnd));
    
    if (!controller.Effects) {
        DEBUG_JSX.log("No Effects found on controller");
        return null;
    }
    
    DEBUG_JSX.log("Checking " + controller.Effects.numProperties + " effects on controller");
    
    for (var s = 1; s <= controller.Effects.numProperties; s++) {
        var effect = controller.Effects.property(s);
        DEBUG_JSX.log("Effect " + s + ": " + effect.name + " (matchName: " + effect.matchName + ")");
        
        if (effect.matchName === "ADBE Slider Control") {
            var sliderProp = effect.property(1);
            DEBUG_JSX.log("Slider " + effect.name + " has " + sliderProp.numKeys + " keyframes");
            
            // Check if this slider has keyframes in the transition timeframe
            for (var k = 1; k <= sliderProp.numKeys; k++) {
                var keyTime = sliderProp.keyTime(k);
                DEBUG_JSX.log("  Key " + k + " at time " + DEBUG_JSX.formatTime(keyTime) + " (checking if >= " + DEBUG_JSX.formatTime(transitionStart) + " and <= " + DEBUG_JSX.formatTime(transitionEnd) + ")");
                
                if (keyTime >= transitionStart && keyTime <= transitionEnd) {
                    DEBUG_JSX.log("FOUND MATCH: slider " + effect.name + " has keyframe at " + DEBUG_JSX.formatTime(keyTime) + " within transition timeframe");
                    return effect.name;
                }
            }
            DEBUG_JSX.log("Slider " + effect.name + " has no keyframes in transition timeframe");
        }
    }
    
    DEBUG_JSX.log("No slider found with keyframes in transition timeframe " + transitionStart + "-" + transitionEnd);
    return null; // No slider found with keyframes in this transition
}

// Find existing slider by checking keyframe colors within the specific transition timeframe
function findSliderForTransitionByType(controller, transitionNumber, transitionType, transitionStartTime, transitionEndTime) {
    DEBUG_JSX.log("findSliderForTransitionByType: looking for " + transitionType + " slider with colored keyframes in T" + transitionNumber + " timeframe (" + DEBUG_JSX.formatTime(transitionStartTime) + " to " + DEBUG_JSX.formatTime(transitionEndTime) + ")");
    
    if (!controller.Effects) return null;
    
    // Look through ALL sliders to find ones with keyframes in this transition's timeframe
    for (var s = 1; s <= controller.Effects.numProperties; s++) {
        var effect = controller.Effects.property(s);
        if (effect.matchName === "ADBE Slider Control" && effect.name.indexOf("- Opacity") !== -1) {
            var sliderProp = effect.property(1);
            DEBUG_JSX.log("Checking slider: " + effect.name + " with " + sliderProp.numKeys + " keyframes");
            
            if (sliderProp.numKeys >= 2) {
                // Check if this slider has keyframes within the transition timeframe
                var hasKeysInTransition = false;
                var colorInTransition = null;
                
                for (var k = 1; k <= sliderProp.numKeys; k++) {
                    var keyTime = sliderProp.keyTime(k);
                    if (keyTime >= transitionStartTime && keyTime <= transitionEndTime) {
                        hasKeysInTransition = true;
                        var keyColor = getKeyframeColor(sliderProp, k);
                        if (keyColor === 9) { // Green = fade-out
                            colorInTransition = "fadeOut";
                            DEBUG_JSX.log("  Found green keyframe at " + DEBUG_JSX.formatTime(keyTime) + " (fade-out)");
                        } else if (keyColor === 8) { // Blue = fade-out
                            colorInTransition = "fadeOut";
                            DEBUG_JSX.log("  Found blue keyframe at " + DEBUG_JSX.formatTime(keyTime) + " (fade-out)");
                        } else if (keyColor === 10) { // Purple = fade-in
                            colorInTransition = "fadeIn";
                            DEBUG_JSX.log("  Found purple keyframe at " + DEBUG_JSX.formatTime(keyTime) + " (fade-in)");
                        }
                    }
                }
                
                if (hasKeysInTransition && colorInTransition === transitionType) {
                    DEBUG_JSX.log("✓ Found " + transitionType + " slider by color in transition timeframe: " + effect.name);
                    return effect.name;
                }
                
                if (hasKeysInTransition) {
                    DEBUG_JSX.log("  Slider has keyframes in transition but wrong type: " + colorInTransition + " (looking for: " + transitionType + ")");
                }
            }
        }
    }
    
    DEBUG_JSX.log("No " + transitionType + " slider found with colored keyframes in transition timeframe");
    return null;
}

// Find all transitions using precise movement detection with 4 decimal precision
function findAllTransitions(positionProperty) {
    if (positionProperty.numKeys < 2) {
        var time = positionProperty.keyTime(positionProperty.numKeys || 1);
        return [{ startTime: time, endTime: time, transitionNumber: 1 }];
    }
    
    var comp = app.project.activeItem;
    var frameRate = comp.frameRate;
    var frameDuration = 1 / frameRate;
    var tolerance = 0.0001; // 4 decimal precision for tiny AE movements
    var gapThreshold = 0.1; // 0.1 second gap indicates separate transitions
    
    var keyStartTime = positionProperty.keyTime(1);
    var keyEndTime = positionProperty.keyTime(positionProperty.numKeys);
    
    DEBUG_JSX.log("Finding transitions with precise movement detection between " + DEBUG_JSX.formatTime(keyStartTime) + " and " + DEBUG_JSX.formatTime(keyEndTime) + " (tolerance: " + tolerance + " pixels)");
    
    var transitions = [];
    var currentTransitionStart = null;
    var currentTransitionEnd = null;
    var previousPos = null;
    var lastMovementTime = null;
    
    // Sample frame by frame to find transitions and gaps with high precision
    for (var time = keyStartTime; time <= keyEndTime; time += frameDuration) {
        var currentPos = positionProperty.valueAtTime(time, false);
        
        if (previousPos !== null) {
            // Check if position changed from previous frame with 4 decimal precision
            var xDiff = Math.abs(currentPos[0] - previousPos[0]);
            var yDiff = Math.abs(currentPos[1] - previousPos[1]);
            var hasMovement = (xDiff > tolerance || yDiff > tolerance);
            
            if (hasMovement) {
                // If we haven't started a transition yet, start one
                if (currentTransitionStart === null) {
                    currentTransitionStart = time - frameDuration;
                    DEBUG_JSX.log("New transition starts at " + DEBUG_JSX.formatTime(currentTransitionStart) + " (first movement detected)");
                }
                // If there's been a significant gap since last movement, start new transition
                else if (lastMovementTime !== null && (time - lastMovementTime) > gapThreshold) {
                    // End previous transition
                    currentTransitionEnd = lastMovementTime;
                    transitions.push({
                        startTime: currentTransitionStart,
                        endTime: currentTransitionEnd,
                        transitionNumber: transitions.length + 1
                    });
                    DEBUG_JSX.log("Transition " + transitions.length + " ends at " + DEBUG_JSX.formatTime(currentTransitionEnd) + " (gap detected)");
                    
                    // Start new transition
                    currentTransitionStart = time - frameDuration;
                    DEBUG_JSX.log("New transition starts at " + DEBUG_JSX.formatTime(currentTransitionStart) + " (after gap)");
                }
                
                lastMovementTime = time;
            }
        }
        
        previousPos = currentPos;
    }
    
    // End the final transition at the last detected movement
    if (currentTransitionStart !== null) {
        currentTransitionEnd = lastMovementTime || keyEndTime;
        transitions.push({
            startTime: currentTransitionStart,
            endTime: currentTransitionEnd,
            transitionNumber: transitions.length + 1
        });
        DEBUG_JSX.log("Final transition " + transitions.length + " ends at " + DEBUG_JSX.formatTime(currentTransitionEnd) + " (last movement detected)");
    }
    
    // Fallback if no transitions detected
    if (transitions.length === 0) {
        transitions.push({
            startTime: keyStartTime,
            endTime: keyEndTime,
            transitionNumber: 1
        });
        DEBUG_JSX.log("No movement detected, using full keyframe range as T1");
    }
    
    DEBUG_JSX.log("Found " + transitions.length + " distinct transitions with precise detection");
    return transitions;
}

// Find exact transition boundaries using precise movement detection
function findExactTransitionBounds(positionProperty) {
    if (positionProperty.numKeys < 2) {
        var time = positionProperty.keyTime(positionProperty.numKeys || 1);
        return { startTime: time, endTime: time };
    }
    
    var comp = app.project.activeItem;
    var frameRate = comp.frameRate;
    var frameDuration = 1 / frameRate;
    var tolerance = 0.0001; // 4 decimal precision for tiny AE movements
    
    var keyStartTime = positionProperty.keyTime(1);
    var keyEndTime = positionProperty.keyTime(positionProperty.numKeys);
    
    DEBUG_JSX.log("Finding exact transition bounds with precise detection between " + DEBUG_JSX.formatTime(keyStartTime) + " and " + DEBUG_JSX.formatTime(keyEndTime) + " (tolerance: " + tolerance + " pixels)");
    
    var transitionStart = null;
    var transitionEnd = null;
    var previousPos = null;
    
    // Sample frame by frame to find exact start and end with high precision
    for (var time = keyStartTime; time <= keyEndTime; time += frameDuration) {
        var currentPos = positionProperty.valueAtTime(time, false);
        
        if (previousPos !== null) {
            // Check if position changed from previous frame with 4 decimal precision
            var xDiff = Math.abs(currentPos[0] - previousPos[0]);
            var yDiff = Math.abs(currentPos[1] - previousPos[1]);
            var hasMovement = (xDiff > tolerance || yDiff > tolerance);
            
            // Find transition start (first frame with movement)
            if (transitionStart === null && hasMovement) {
                transitionStart = time - frameDuration; // Movement started at previous frame
                DEBUG_JSX.log("Transition starts at " + DEBUG_JSX.formatTime(transitionStart) + " (first movement detected)");
            }
            
            // Update transition end (last frame with movement)
            if (hasMovement) {
                transitionEnd = time;
            }
        }
        
        previousPos = currentPos;
    }
    
    // Fallback to keyframe bounds if no movement detected
    if (transitionStart === null) {
        transitionStart = keyStartTime;
        DEBUG_JSX.log("No movement detected, using first keyframe as start: " + DEBUG_JSX.formatTime(transitionStart));
    }
    if (transitionEnd === null) {
        transitionEnd = keyEndTime;
        DEBUG_JSX.log("No movement detected, using last keyframe as end: " + DEBUG_JSX.formatTime(transitionEnd));
    }
    
    DEBUG_JSX.log("Exact transition bounds: " + DEBUG_JSX.formatTime(transitionStart) + " to " + DEBUG_JSX.formatTime(transitionEnd));
    return { startTime: transitionStart, endTime: transitionEnd };
}

// Create or update transition with keyframes
function createOrUpdateTransition(controller, comp, params, transitionNumber, isNewTransition, selectedLayers, transitionType) {
    try {
        DEBUG_JSX.log("createOrUpdateTransition start - T" + transitionNumber + ", isNew: " + isNewTransition);
        
        var currentTime = comp.time;
        var fadeOutDelay = parseFloat(params.fadeOutDelay) / 1000; // Convert ms to seconds
        var fadeOutDuration = parseFloat(params.fadeOutDuration) / 1000;
        var fadeInDelay = parseFloat(params.fadeInDelay) / 1000;
        var fadeInDuration = parseFloat(params.fadeInDuration) / 1000;
        var slideDistance = parseFloat(params.slideDistance);
        var positionDuration = 0.5; // 500ms for slide
        
        // Calculate actual start and end times for fade out and fade in
        var fadeOutStartTime = currentTime + fadeOutDelay;
        var fadeOutEndTime = fadeOutStartTime + fadeOutDuration;
        var fadeInStartTime = currentTime + fadeInDelay;
        var fadeInEndTime = fadeInStartTime + fadeInDuration;
        
        DEBUG_JSX.log("Timing - fadeOut: " + DEBUG_JSX.formatTime(fadeOutStartTime) + " to " + DEBUG_JSX.formatTime(fadeOutEndTime) + ", fadeIn: " + DEBUG_JSX.formatTime(fadeInStartTime) + " to " + DEBUG_JSX.formatTime(fadeInEndTime) + ", slide: " + slideDistance + "px");
        
        // Only check for duplicates if we're updating an existing transition (playhead over transition)
        // For new transitions, allow layers to be added even if they have existing fade animations
        if (!isNewTransition) {
            DEBUG_JSX.log("Checking for duplicate transition types within existing transition for " + selectedLayers.length + " selected layers");
            
            // Find the current transition timeframe
            var position = controller.transform.position;
            var allTransitions = findAllTransitions(position);
            var currentTransition = null;
            
            // Find which transition the playhead is over
            for (var t = 0; t < allTransitions.length; t++) {
                if (allTransitions[t].transitionNumber === transitionNumber) {
                    currentTransition = allTransitions[t];
                    break;
                }
            }
            
            if (currentTransition) {
                DEBUG_JSX.log("Playhead is over T" + transitionNumber + " transition (" + DEBUG_JSX.formatTime(currentTransition.startTime) + " to " + DEBUG_JSX.formatTime(currentTransition.endTime) + ")");
                
                // Check if any selected layers already have the SAME transition type within this specific transition
                for (var i = 0; i < selectedLayers.length; i++) {
                    var layer = selectedLayers[i];
                    
                    // Check if layer has markers within this transition timeframe that conflict
                    if (layer.marker && layer.marker.numKeys > 0) {
                        for (var m = 1; m <= layer.marker.numKeys; m++) {
                            var markerTime = layer.marker.keyTime(m);
                            var marker = layer.marker.keyValue(m);
                            var markerComment = marker.comment;
                            
                            // Check if marker is within current transition timeframe
                            if (markerTime >= currentTransition.startTime && markerTime <= currentTransition.endTime) {
                                var existingType = null;
                                if (markerComment.indexOf("Fade Out") !== -1) {
                                    existingType = "fadeOut";
                                } else if (markerComment.indexOf("Fade In") !== -1) {
                                    existingType = "fadeIn";
                                }
                                
                                if (existingType === transitionType) {
                                    DEBUG_JSX.log("ERROR: Layer " + layer.name + " already has " + transitionType + " marker in this transition");
                                    alert("Layer '" + layer.name + "' already has a " + (transitionType === "fadeOut" ? "fade-out" : "fade-in") + " transition at this timeline position. Cannot add duplicate transition types.");
                                    throw new Error("Duplicate " + transitionType + " in current transition");
                                }
                            }
                        }
                    }
                }
            }
        } else {
            DEBUG_JSX.log("Creating new transition - no duplicate check needed");
        }
        
        // Check for overlap if creating new transition
        if (isNewTransition && controller.transform.position.numKeys > 0) {
            var transitionEnd = currentTime + positionDuration;
            if (checkForOverlap(controller, currentTime, transitionEnd)) {
                alert("Can't add overlapping transitions");
                throw new Error("Overlap detected");
            }
        }
        
        // Scale slide distance based on comp width
        slideDistance = calculateSlideDistance(slideDistance, params.direction, comp.width);
        
        // Determine the next available opacity number for this transition
        var nextOpacityNum = getNextOpacityNumber(controller, transitionNumber);
        
        // Slider names for this transition - both will use the same number for now
        var fadeOutSliderName = "Transition " + transitionNumber + " - Opacity " + nextOpacityNum;
        var fadeInSliderName = "Transition " + transitionNumber + " - Opacity " + nextOpacityNum;
        
        DEBUG_JSX.log("Next opacity number for T" + transitionNumber + ": " + nextOpacityNum + " (slider name: Transition " + transitionNumber + " - Opacity " + nextOpacityNum + ")");
        
        if (isNewTransition) {
            DEBUG_JSX.log("Creating new transition sliders and keyframes");
            
            // Check if any selected layers already have existing sliders we can reuse
            var existingSlider = null;
            
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var existingOut = getExistingSliderFromExpression(layer, controller, "fadeOut");
                var existingIn = getExistingSliderFromExpression(layer, controller, "fadeIn");
                
                // If the layer has any existing slider (fade out or fade in), reuse it for both
                if (existingOut) {
                    existingSlider = existingOut;
                    break;
                } else if (existingIn) {
                    existingSlider = existingIn;
                    break;
                }
            }
            
            if (existingSlider) {
                // Reuse the existing slider for both fade out and fade in
                fadeOutSliderName = existingSlider;
                fadeInSliderName = existingSlider;
                DEBUG_JSX.log("Reusing existing slider for both fade out and fade in: " + existingSlider);
            } else {
                // No existing slider found, create only the slider needed for this transition type
                DEBUG_JSX.log("Creating new slider for transition type: " + transitionType);
                
                var newSliderName = transitionType === "fadeOut" ? fadeOutSliderName : fadeInSliderName;
                var newEffect = controller.Effects.addProperty("ADBE Slider Control");
                newEffect.name = newSliderName;
                
                // Update slider names for return values
                if (transitionType === "fadeOut") {
                    fadeOutSliderName = newSliderName;
                    fadeInSliderName = newSliderName; // Use same slider for consistency
                } else {
                    fadeInSliderName = newSliderName;
                    fadeOutSliderName = newSliderName; // Use same slider for consistency
                }
            }
            
            DEBUG_JSX.log("Setting opacity keyframes on sliders");
            
            if (existingSlider) {
                // Using existing slider - add keyframes for this transition type only
                var sliderEffect = controller.effect(existingSlider);
                var sliderProp = sliderEffect.property(1);
                
                DEBUG_JSX.log("Adding keyframes to existing slider: " + existingSlider + " for transition type: " + transitionType);
                
                if (transitionType === "fadeOut") {
                    // Only add fade out keyframes
                    sliderProp.setValueAtTime(fadeOutStartTime, 100);
                    sliderProp.setValueAtTime(fadeOutEndTime, 0);
                    
                    // Color fade-out keyframes blue
                    var keyIndex1 = sliderProp.nearestKeyIndex(fadeOutStartTime);
                    var keyIndex2 = sliderProp.nearestKeyIndex(fadeOutEndTime);
                    setKeyframeColor(sliderProp, keyIndex1, 8); // Blue
                    setKeyframeColor(sliderProp, keyIndex2, 8); // Blue
                } else if (transitionType === "fadeIn") {
                    // Only add fade in keyframes
                    sliderProp.setValueAtTime(fadeInStartTime, 0);
                    sliderProp.setValueAtTime(fadeInEndTime, 100);
                    
                    // Color fade-in keyframes purple
                    var keyIndex1 = sliderProp.nearestKeyIndex(fadeInStartTime);
                    var keyIndex2 = sliderProp.nearestKeyIndex(fadeInEndTime);
                    setKeyframeColor(sliderProp, keyIndex1, 10); // Purple
                    setKeyframeColor(sliderProp, keyIndex2, 10); // Purple
                } else {
                    // Default: add both (for backward compatibility)
                    sliderProp.setValueAtTime(fadeOutStartTime, 100);
                    sliderProp.setValueAtTime(fadeOutEndTime, 0);
                    sliderProp.setValueAtTime(fadeInStartTime, 0);
                    sliderProp.setValueAtTime(fadeInEndTime, 100);
                    
                    // Color mixed keyframes - first pair blue (fade-out), second pair purple (fade-in)
                    setKeyframeColor(sliderProp, 1, 8); // Blue
                    setKeyframeColor(sliderProp, 2, 8); // Blue  
                    setKeyframeColor(sliderProp, 3, 10); // Purple
                    setKeyframeColor(sliderProp, 4, 10); // Purple
                }
            } else {
                // Using new slider - set up keyframes for the specific transition type
                var sliderEffect = controller.effect(transitionType === "fadeOut" ? fadeOutSliderName : fadeInSliderName);
                var sliderProp = sliderEffect.property(1);
                
                if (transitionType === "fadeOut") {
                    DEBUG_JSX.log("Setting fade out slider keyframes");
                    sliderProp.setValueAtTime(fadeOutStartTime, 100);
                    sliderProp.setValueAtTime(fadeOutEndTime, 0);
                    
                    // Color fade-out keyframes blue
                    setKeyframeColor(sliderProp, 1, 8); // Blue
                    setKeyframeColor(sliderProp, 2, 8); // Blue
                } else if (transitionType === "fadeIn") {
                    DEBUG_JSX.log("Setting fade in slider keyframes");
                    sliderProp.setValueAtTime(fadeInStartTime, 0);
                    sliderProp.setValueAtTime(fadeInEndTime, 100);
                    
                    // Color fade-in keyframes purple
                    setKeyframeColor(sliderProp, 1, 10); // Purple
                    setKeyframeColor(sliderProp, 2, 10); // Purple
                }
            }
        } else {
            // Updating existing transition - need to add keyframes too
            DEBUG_JSX.log("Adding keyframes for existing transition");
            
            // Find the actual start and end time of the current transition using exact bounds detection
            var position = controller.transform.position;
            var allTransitions = findAllTransitions(position);
            var targetTransition = null;
            
            // Find the transition that matches our transition number
            for (var i = 0; i < allTransitions.length; i++) {
                if (allTransitions[i].transitionNumber === transitionNumber) {
                    targetTransition = allTransitions[i];
                    break;
                }
            }
            
            var transitionStartTime, transitionEndTime;
            if (targetTransition) {
                transitionStartTime = targetTransition.startTime;
                transitionEndTime = targetTransition.endTime;
                DEBUG_JSX.log("Found T" + transitionNumber + " transition bounds: " + DEBUG_JSX.formatTime(transitionStartTime) + " to " + DEBUG_JSX.formatTime(transitionEndTime));
            } else {
                // Fallback to current time if transition not found
                transitionStartTime = currentTime;
                transitionEndTime = currentTime;
                DEBUG_JSX.log("Could not find T" + transitionNumber + " transition bounds, using current time: " + DEBUG_JSX.formatTime(currentTime));
            }
            
            // Debug: Log all existing sliders on the controller
            DEBUG_JSX.log("Existing sliders on controller:");
            if (controller.Effects) {
                for (var debugS = 1; debugS <= controller.Effects.numProperties; debugS++) {
                    var debugEffect = controller.Effects.property(debugS);
                    if (debugEffect.matchName === "ADBE Slider Control") {
                        var debugSliderProp = debugEffect.property(1);
                        DEBUG_JSX.log("  - " + debugEffect.name + " (keys: " + debugSliderProp.numKeys + ")");
                    }
                }
            }
            
            // Check if any selected layer already has a slider expression - if so, add keyframes to that existing slider
            var existingSliderName = null;
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var existingFadeOutSlider = getExistingSliderFromExpression(layer, controller, "fadeOut");
                var existingFadeInSlider = getExistingSliderFromExpression(layer, controller, "fadeIn");
                var existingSlider = existingFadeOutSlider || existingFadeInSlider;
                
                if (existingSlider) {
                    existingSliderName = existingSlider;
                    DEBUG_JSX.log("Found layer " + layer.name + " already linked to slider: " + existingSlider);
                    break;
                }
            }
            
            if (existingSliderName) {
                // Add keyframes to the existing slider that the layer is already linked to
                DEBUG_JSX.log("Adding " + transitionType + " keyframes to existing slider: " + existingSliderName);
                
                var existingEffect = controller.effect(existingSliderName);
                var existingSliderProp = existingEffect.property(1);
                
                if (transitionType === "fadeOut") {
                    // Add fade out keyframes
                    var existingFadeOutStart = transitionStartTime + fadeOutDelay;
                    var existingFadeOutEnd = existingFadeOutStart + fadeOutDuration;
                    existingSliderProp.setValueAtTime(existingFadeOutStart, 100);
                    existingSliderProp.setValueAtTime(existingFadeOutEnd, 0);
                    
                    // Color the keyframes blue for fade-out
                    var keyIndex1 = existingSliderProp.nearestKeyIndex(existingFadeOutStart);
                    var keyIndex2 = existingSliderProp.nearestKeyIndex(existingFadeOutEnd);
                    setKeyframeColor(existingSliderProp, keyIndex1, 8); // Blue
                    setKeyframeColor(existingSliderProp, keyIndex2, 8); // Blue
                    
                    DEBUG_JSX.log("Added fade-out keyframes (blue) to " + existingSliderName + " from " + DEBUG_JSX.formatTime(existingFadeOutStart) + " to " + DEBUG_JSX.formatTime(existingFadeOutEnd));
                } else if (transitionType === "fadeIn") {
                    // Add fade in keyframes
                    var existingFadeInStart = transitionStartTime + fadeInDelay;
                    var existingFadeInEnd = existingFadeInStart + fadeInDuration;
                    existingSliderProp.setValueAtTime(existingFadeInStart, 0);
                    existingSliderProp.setValueAtTime(existingFadeInEnd, 100);
                    
                    // Color the keyframes purple for fade-in
                    var keyIndex1 = existingSliderProp.nearestKeyIndex(existingFadeInStart);
                    var keyIndex2 = existingSliderProp.nearestKeyIndex(existingFadeInEnd);
                    setKeyframeColor(existingSliderProp, keyIndex1, 10); // Purple
                    setKeyframeColor(existingSliderProp, keyIndex2, 10); // Purple
                    
                    DEBUG_JSX.log("Added fade-in keyframes (purple) to " + existingSliderName + " from " + DEBUG_JSX.formatTime(existingFadeInStart) + " to " + DEBUG_JSX.formatTime(existingFadeInEnd));
                }
                
                // Use the existing slider for both return values
                fadeOutSliderName = existingSliderName;
                fadeInSliderName = existingSliderName;
            } else {
                // No existing slider linked to selected layers - look for existing slider for THIS specific transition
                DEBUG_JSX.log("No layers linked to sliders - looking for existing slider for T" + transitionNumber + " " + transitionType);
                
                var existingSlider = findSliderForTransitionByType(controller, transitionNumber, transitionType, transitionStartTime, transitionEndTime);
                
                if (existingSlider) {
                    // Found existing slider with the right pattern - just link to it, don't add new keyframes
                    DEBUG_JSX.log("Found existing " + transitionType + " slider: " + existingSlider + " - will link layer to it");
                    
                    // Use the existing slider for both return values
                    if (transitionType === "fadeOut") {
                        fadeOutSliderName = existingSlider;
                        fadeInSliderName = existingSlider; // Use same slider for consistency
                    } else {
                        fadeInSliderName = existingSlider;
                        fadeOutSliderName = existingSlider; // Use same slider for consistency
                    }
                } else {
                    // No existing slider found - create new slider and add keyframes
                    DEBUG_JSX.log("No existing " + transitionType + " slider found - creating new slider");
                    
                    var newSliderName = transitionType === "fadeOut" ? fadeOutSliderName : fadeInSliderName;
                    var newEffect = controller.Effects.addProperty("ADBE Slider Control");
                    newEffect.name = newSliderName;
                    
                    var newSliderProp = newEffect.property(1);
                    
                    if (transitionType === "fadeOut") {
                        // Add fade out keyframes starting at the transition start time
                        var newFadeOutStart = transitionStartTime + fadeOutDelay;
                        var newFadeOutEnd = newFadeOutStart + fadeOutDuration;
                        newSliderProp.setValueAtTime(newFadeOutStart, 100);
                        newSliderProp.setValueAtTime(newFadeOutEnd, 0);
                        
                        // Color the keyframes blue for fade-out
                        setKeyframeColor(newSliderProp, 1, 8); // Blue
                        setKeyframeColor(newSliderProp, 2, 8); // Blue
                        
                        DEBUG_JSX.log("Created new fade-out slider (blue) " + newSliderName + " with keyframes from " + DEBUG_JSX.formatTime(newFadeOutStart) + " to " + DEBUG_JSX.formatTime(newFadeOutEnd));
                    } else if (transitionType === "fadeIn") {
                        // Add fade in keyframes
                        var newFadeInStart = transitionStartTime + fadeInDelay;
                        var newFadeInEnd = newFadeInStart + fadeInDuration;
                        newSliderProp.setValueAtTime(newFadeInStart, 0);
                        newSliderProp.setValueAtTime(newFadeInEnd, 100);
                        
                        // Color the keyframes purple for fade-in
                        setKeyframeColor(newSliderProp, 1, 10); // Purple
                        setKeyframeColor(newSliderProp, 2, 10); // Purple
                        
                        DEBUG_JSX.log("Created new fade-in slider (purple) " + newSliderName + " with keyframes from " + DEBUG_JSX.formatTime(newFadeInStart) + " to " + DEBUG_JSX.formatTime(newFadeInEnd));
                    }
                    
                    // Update the slider names for the return value
                    if (transitionType === "fadeOut") {
                        fadeOutSliderName = newSliderName;
                    } else {
                        fadeInSliderName = newSliderName;
                    }
                }
            }
        }
        
        // Add position keyframes only for new transitions
        if (isNewTransition) {
            DEBUG_JSX.log("Setting position keyframes");
            var position = controller.transform.position;
            var currentPos = position.value;
            
            // Set first keyframe
            position.setValueAtTime(currentTime, currentPos);
            DEBUG_JSX.log("First position keyframe set");
            
            // No longer adding slide direction markers
        
            // Set end position based on direction
            var endPosition;
            switch(params.direction) {
                case "left":
                    endPosition = [currentPos[0] - slideDistance, currentPos[1]];
                    break;
                case "right":
                    endPosition = [currentPos[0] + slideDistance, currentPos[1]];
                    break;
                case "up":
                    endPosition = [currentPos[0], currentPos[1] - slideDistance];
                    break;
                case "down":
                    endPosition = [currentPos[0], currentPos[1] + slideDistance];
                    break;
                default:
                    endPosition = [currentPos[0] - slideDistance, currentPos[1]];
            }
            
            // Set second keyframe
            position.setValueAtTime(currentTime + positionDuration, endPosition);
            DEBUG_JSX.log("End position keyframe set");
        }
        
        DEBUG_JSX.log("Transition creation complete");
        return {
            fadeOutSliderName: fadeOutSliderName,
            fadeInSliderName: fadeInSliderName
        };
    } catch(e) {
        DEBUG_JSX.error("Error in createOrUpdateTransition", e.toString());
        throw e;
    }
}

// Helper function to set keyframe colors for identification
function setKeyframeColor(property, keyIndex, colorIndex) {
    try {
        // After Effects keyframe label colors:
        // 0 = None, 1 = Red, 2 = Yellow, 3 = Aqua, 4 = Pink, 5 = Lavender, 6 = Peach, 7 = Sea Foam, 8 = Blue, 9 = Green, 10 = Purple, 11 = Orange, 12 = Brown, 13 = Fuchsia, 14 = Cyan, 15 = Sandstone, 16 = Dark Green
        
        // Use the correct ExtendScript method
        property.setLabelAtKey(keyIndex, colorIndex);
        DEBUG_JSX.log("Set keyframe " + keyIndex + " to color " + colorIndex);
    } catch(e) {
        DEBUG_JSX.error("Error setting keyframe color", e.toString());
    }
}

// Helper function to get keyframe color
function getKeyframeColor(property, keyIndex) {
    try {
        // Use the correct ExtendScript method
        return property.keyLabel(keyIndex);
    } catch(e) {
        DEBUG_JSX.error("Error getting keyframe color", e.toString());
        return 0; // Default to no color
    }
}

// Helper function to detect slider type by keyframe colors
function detectSliderTypeByColor(sliderProperty) {
    try {
        if (sliderProperty.numKeys < 2) return null;
        
        // Check the first few keyframes for color labels
        for (var k = 1; k <= Math.min(sliderProperty.numKeys, 4); k++) {
            var color = getKeyframeColor(sliderProperty, k);
            DEBUG_JSX.log("Keyframe " + k + " has color: " + color);
            
            if (color === 8) { // Blue = fade-out
                DEBUG_JSX.log("Detected fade-out by blue color on keyframe " + k);
                return "fadeOut";
            } else if (color === 10) { // Purple = fade-in
                DEBUG_JSX.log("Detected fade-in by purple color on keyframe " + k);
                return "fadeIn";
            }
        }
        
        DEBUG_JSX.log("No color labels found for fade detection");
        return null; // No color labels found
    } catch(e) {
        DEBUG_JSX.error("Error detecting slider type by color", e.toString());
        return null;
    }
}

// Helper function to extract slider name from opacity expression
function getExistingSliderFromExpression(layer, controller, type) {
    // type: "fadeOut" or "fadeIn"
    try {
        var expression = layer.opacity.expression;
        if (!expression) return null;
        
        // Look for pattern: thisComp.layer("controller").effect("sliderName")("Slider")
        var controllerName = controller.name;
        var regex;
        
        if (type === "fadeOut") {
            // Look for Transition [number] - Opacity 1 pattern
            regex = new RegExp('effect\\("(Transition \\d+ - Opacity 1)"\\)');
        } else {
            // Look for Transition [number] - Opacity 2 pattern  
            regex = new RegExp('effect\\("(Transition \\d+ - Opacity 2)"\\)');
        }
        
        var match = expression.match(regex);
        if (match && expression.indexOf(controllerName) !== -1) {
            DEBUG_JSX.log("Found existing " + type + " slider: " + match[1] + " for layer " + layer.name);
            return match[1];
        }
        
        return null;
    } catch(e) {
        DEBUG_JSX.error("Error extracting slider from expression", e.toString());
        return null;
    }
}

// Find all layers in the composition that are linked to a specific slider
function findAllLayersLinkedToSlider(comp, controller, sliderName) {
    var linkedLayers = [];
    
    try {
        DEBUG_JSX.log("Finding all layers linked to slider: " + sliderName);
        
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layers[i];
            
            // Skip the controller layer itself
            if (layer === controller) continue;
            
            // Check if this layer has an opacity expression
            if (layer.opacity.expression) {
                var expression = layer.opacity.expression;
                
                // Check if the expression references our specific slider
                if (expression.indexOf(controller.name) !== -1 && expression.indexOf(sliderName) !== -1) {
                    linkedLayers.push(layer);
                    DEBUG_JSX.log("Found layer linked to " + sliderName + ": " + layer.name);
                }
            }
        }
        
        DEBUG_JSX.log("Found " + linkedLayers.length + " layers linked to " + sliderName);
        return linkedLayers;
    } catch(e) {
        DEBUG_JSX.error("Error finding layers linked to slider", e.toString());
        return [];
    }
}

// Analyze position keyframes to determine movement direction
function getTransitionDirection(controller, transitionStartTime, transitionEndTime) {
    try {
        var position = controller.transform.position;
        
        if (position.numKeys < 2) {
            DEBUG_JSX.log("Not enough position keyframes to determine direction, defaulting to left");
            return "left";
        }
        
        // Get position values at the start and end of the transition
        var startPos = position.valueAtTime(transitionStartTime, false);
        var endPos = position.valueAtTime(transitionEndTime, false);
        
        var deltaX = endPos[0] - startPos[0];
        var deltaY = endPos[1] - startPos[1];
        
        DEBUG_JSX.log("Position analysis: start=[" + startPos[0] + "," + startPos[1] + "] end=[" + endPos[0] + "," + endPos[1] + "] delta=[" + deltaX + "," + deltaY + "]");
        
        // Determine primary movement direction based on larger delta
        var absX = Math.abs(deltaX);
        var absY = Math.abs(deltaY);
        
        var direction;
        if (absX > absY) {
            // Horizontal movement is dominant
            direction = deltaX > 0 ? "right" : "left";
        } else {
            // Vertical movement is dominant
            direction = deltaY > 0 ? "down" : "up";
        }
        
        DEBUG_JSX.log("Detected transition direction: " + direction + " (deltaX=" + deltaX + ", deltaY=" + deltaY + ")");
        return direction;
        
    } catch(e) {
        DEBUG_JSX.error("Error analyzing transition direction", e.toString());
        return "left"; // Default fallback
    }
}

// Add exit animation to layers
function addExitToLayers(selectedLayers, controller, fadeOutSliderName, comp, transitionNumber, isNewTransition, params) {
    DEBUG_JSX.log("addExitToLayers called with " + selectedLayers.length + " layers, transition " + transitionNumber + ", isNew: " + isNewTransition);
    var originalTime = comp.time;
    
    try {
        var parentTime, markerTime, targetTransition;
        var actualDirection = params.direction; // Default to UI selection
        
        if (isNewTransition) {
            // For new transitions, use current playhead time
            parentTime = originalTime;
            markerTime = originalTime;
            DEBUG_JSX.log("New transition - using playhead time: " + DEBUG_JSX.formatTime(originalTime));
        } else {
            // For existing transitions, find the correct transition bounds
            var position = controller.transform.position;
            var allTransitions = findAllTransitions(position);
            targetTransition = null;
            
            // Find the transition that matches our transition number
            for (var i = 0; i < allTransitions.length; i++) {
                if (allTransitions[i].transitionNumber === transitionNumber) {
                    targetTransition = allTransitions[i];
                    break;
                }
            }
            
            if (targetTransition) {
                parentTime = targetTransition.startTime;
                markerTime = targetTransition.startTime;
                // For existing transitions, analyze the actual position keyframes for direction
                actualDirection = getTransitionDirection(controller, targetTransition.startTime, targetTransition.endTime);
                DEBUG_JSX.log("Existing T" + transitionNumber + " transition bounds: " + DEBUG_JSX.formatTime(targetTransition.startTime) + " to " + DEBUG_JSX.formatTime(targetTransition.endTime) + ", direction: " + actualDirection);
            } else {
                // Fallback to playhead time
                parentTime = originalTime;
                markerTime = originalTime;
                DEBUG_JSX.log("Could not find T" + transitionNumber + " transition, using playhead time");
            }
        }
        
        DEBUG_JSX.log("Using parentTime: " + DEBUG_JSX.formatTime(parentTime) + ", markerTime: " + DEBUG_JSX.formatTime(markerTime));
        comp.time = parentTime;
        
        // Parent layers and add opacity expressions
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            DEBUG_JSX.log("Processing layer: " + layer.name);
            
            // Parent to controller at this time position
            layer.parent = controller;
            DEBUG_JSX.log("Parented " + layer.name + " to controller");
            
            // Add marker to layer at the actual fade-out start time (accounting for delay)
            var directionArrow = "";
            switch(actualDirection) {
                case "left": directionArrow = "← "; break;
                case "right": directionArrow = "→ "; break;
                case "up": directionArrow = "↑ "; break;
                case "down": directionArrow = "↓ "; break;
                default: directionArrow = "← "; break;
            }
            var marker = new MarkerValue(directionArrow + "Fade Out");
            var fadeOutDelaySeconds = parseFloat(params.fadeOutDelay) / 1000;
            var fadeOutMarkerTime = markerTime + fadeOutDelaySeconds;
            layer.marker.setValueAtTime(fadeOutMarkerTime, marker);
            DEBUG_JSX.log("Added Fade Out marker to " + layer.name + " at " + DEBUG_JSX.formatTime(fadeOutMarkerTime) + " (transition start + " + DEBUG_JSX.formatTime(fadeOutDelaySeconds) + " delay) with direction: " + params.direction);
            
            // Check if layer already has ANY slider expression (fade out or fade in)
            var existingFadeOutSlider = getExistingSliderFromExpression(layer, controller, "fadeOut");
            var existingFadeInSlider = getExistingSliderFromExpression(layer, controller, "fadeIn");
            var existingSlider = existingFadeOutSlider || existingFadeInSlider;
            
            if (existingSlider) {
                DEBUG_JSX.log("Layer " + layer.name + " already linked to slider: " + existingSlider + " - no new expression needed");
                // Layer already has opacity expression - keyframes were added during createOrUpdateTransition
            } else {
                // Use the fadeOutSliderName that was already determined by createOrUpdateTransition
                var sliderToUse = fadeOutSliderName;
                DEBUG_JSX.log("Using fadeOutSliderName from createOrUpdateTransition: " + sliderToUse);
                
                // Add opacity expression using the correct slider
                var opacityExpression = 'thisComp.layer("' + controller.name + 
                                       '").effect("' + sliderToUse + '")("Slider")';
                layer.opacity.expression = opacityExpression;
                DEBUG_JSX.log("Added opacity expression to " + layer.name + " using slider: " + sliderToUse);
            }
        }
        
        // Find all other layers linked to the slider we added keyframes to and add markers to them too
        var allLinkedLayers = findAllLayersLinkedToSlider(comp, controller, fadeOutSliderName);
        DEBUG_JSX.log("Adding markers to " + allLinkedLayers.length + " other layers linked to " + fadeOutSliderName);
        
        for (var j = 0; j < allLinkedLayers.length; j++) {
            var linkedLayer = allLinkedLayers[j];
            
            // Skip layers that were already processed in the main loop
            var alreadyProcessed = false;
            for (var k = 0; k < selectedLayers.length; k++) {
                if (linkedLayer === selectedLayers[k]) {
                    alreadyProcessed = true;
                    break;
                }
            }
            
            if (!alreadyProcessed) {
                // Add marker to this linked layer at the actual fade-out start time (accounting for delay)
                var directionArrow = "";
                switch(actualDirection) {
                    case "left": directionArrow = "← "; break;
                    case "right": directionArrow = "→ "; break;
                    case "up": directionArrow = "↑ "; break;
                    case "down": directionArrow = "↓ "; break;
                    default: directionArrow = "← "; break;
                }
                var marker = new MarkerValue(directionArrow + "Fade Out");
                var fadeOutDelaySeconds = parseFloat(params.fadeOutDelay) / 1000;
                var fadeOutMarkerTime = markerTime + fadeOutDelaySeconds;
                linkedLayer.marker.setValueAtTime(fadeOutMarkerTime, marker);
                DEBUG_JSX.log("Added Fade Out marker to linked layer " + linkedLayer.name + " at " + DEBUG_JSX.formatTime(fadeOutMarkerTime) + " (transition start + " + DEBUG_JSX.formatTime(fadeOutDelaySeconds) + " delay, was already linked to " + fadeOutSliderName + ")");
            }
        }
        
    } catch(e) {
        DEBUG_JSX.error("Error in addExitToLayers", e.toString());
        throw e;
    } finally {
        // Always restore original time
        comp.time = originalTime;
        DEBUG_JSX.log("Restored playhead to " + originalTime);
    }
}

// Add enter animation to layers
function addEnterToLayers(selectedLayers, controller, fadeInSliderName, comp, transitionNumber, isNewTransition, params) {
    DEBUG_JSX.log("addEnterToLayers called with " + selectedLayers.length + " layers, transition " + transitionNumber + ", isNew: " + isNewTransition);
    var originalTime = comp.time;
    
    try {
        // Find the actual slider being used (might be different from fadeInSliderName if reusing existing)
        var actualSliderName = fadeInSliderName;
        
        // For T2+ transitions, don't fall back to existing T1 sliders from other transitions
        // Only use the fadeInSliderName that was correctly determined by createOrUpdateTransition
        if (transitionNumber > 1) {
            DEBUG_JSX.log("T" + transitionNumber + " transition - using determined fadeInSliderName: " + fadeInSliderName);
            actualSliderName = fadeInSliderName;
        } else {
            // For T1 transitions, check if any selected layer has an existing slider we should use
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var existingFadeOutSlider = getExistingSliderFromExpression(layer, controller, "fadeOut");
                var existingFadeInSlider = getExistingSliderFromExpression(layer, controller, "fadeIn");
                var existingSlider = existingFadeOutSlider || existingFadeInSlider;
                
                if (existingSlider) {
                    actualSliderName = existingSlider;
                    DEBUG_JSX.log("T1 transition - using actual slider name: " + actualSliderName + " instead of " + fadeInSliderName);
                    break;
                }
            }
        }
        
        // Find the slider effect
        var fadeInEffect = controller.effect(actualSliderName);
        if (!fadeInEffect) {
            DEBUG_JSX.error("Could not find slider effect: " + actualSliderName);
            throw new Error("Slider effect not found: " + actualSliderName);
        }
        
        var fadeInSlider = fadeInEffect.property(1);
        
        // Get the start time of the fade-in (first keyframe of fade-in slider)
        var fadeInStartTime = fadeInSlider.numKeys >= 1 ? fadeInSlider.keyTime(1) : comp.time;
        
        // Find the exact bounds of the specific transition we're working with
        var targetTransition = null;
        
        if (isNewTransition) {
            // For new transitions, use current time as the transition bounds
            var currentTime = comp.time;
            var positionDuration = 0.5; // 500ms for slide
            targetTransition = { 
                startTime: currentTime, 
                endTime: currentTime + positionDuration 
            };
            DEBUG_JSX.log("New transition T" + transitionNumber + " bounds: " + DEBUG_JSX.formatTime(targetTransition.startTime) + " to " + DEBUG_JSX.formatTime(targetTransition.endTime));
        } else {
            // For existing transitions, find the specific transition by number
            var position = controller.transform.position;
            var allTransitions = findAllTransitions(position);
            
            // Find the transition that matches our transition number
            for (var i = 0; i < allTransitions.length; i++) {
                if (allTransitions[i].transitionNumber === transitionNumber) {
                    targetTransition = allTransitions[i];
                    break;
                }
            }
            
            // Fallback to overall bounds if specific transition not found
            if (!targetTransition) {
                var bounds = findExactTransitionBounds(position);
                targetTransition = { startTime: bounds.startTime, endTime: bounds.endTime };
            }
        }
        
        // Determine the correct direction for the marker
        var actualDirection = params.direction; // Default to UI selection for new transitions
        if (!isNewTransition && targetTransition) {
            // For existing transitions, analyze the actual position keyframes
            actualDirection = getTransitionDirection(controller, targetTransition.startTime, targetTransition.endTime);
            DEBUG_JSX.log("Using analyzed direction '" + actualDirection + "' instead of UI direction '" + params.direction + "' for existing transition");
        }
        
        // For fade-in layers, parent at the END of the specific transition
        var parentTime = targetTransition.endTime;
        
        DEBUG_JSX.log("T" + transitionNumber + " transition: " + targetTransition.startTime + " to " + targetTransition.endTime + ", parenting fade-in at exact end: " + parentTime);
        comp.time = parentTime;
        
        // Parent layers and add opacity expressions
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            
            // Parent to controller at this time position
            layer.parent = controller;
            
            // Add marker at the START of the fade-in animation (transition start + fade out duration) with direction arrow
            var directionArrow = "";
            switch(actualDirection) {
                case "left": directionArrow = "← "; break;
                case "right": directionArrow = "→ "; break;
                case "up": directionArrow = "↑ "; break;
                case "down": directionArrow = "↓ "; break;
                default: directionArrow = "← "; break;
            }
            var marker = new MarkerValue(directionArrow + "Fade In");
            var fadeInDelayMs = parseFloat(params.fadeInDelay);
            var markerTime = targetTransition.startTime + (fadeInDelayMs / 1000); // Start of fade in
            layer.marker.setValueAtTime(markerTime, marker);
            DEBUG_JSX.log("Added Fade In marker to " + layer.name + " at " + DEBUG_JSX.formatTime(markerTime) + " with direction: " + params.direction + " (transitionStart=" + DEBUG_JSX.formatTime(targetTransition.startTime) + " + fadeInDelay=" + DEBUG_JSX.formatTime(fadeInDelayMs / 1000) + ")");
            
            // Check if layer already has ANY slider expression (fade out or fade in)
            var existingFadeOutSlider = getExistingSliderFromExpression(layer, controller, "fadeOut");
            var existingFadeInSlider = getExistingSliderFromExpression(layer, controller, "fadeIn");
            var existingSlider = existingFadeOutSlider || existingFadeInSlider;
            
            if (existingSlider) {
                DEBUG_JSX.log("Layer " + layer.name + " already linked to slider: " + existingSlider + " - no new keyframes or expression needed");
                // Layer already has opacity expression - keyframes were already added during createOrUpdateTransition
                // No need to add new keyframes or change expression
            } else {
                // Use the fadeInSliderName that was already determined by createOrUpdateTransition
                var sliderToUse = fadeInSliderName;
                DEBUG_JSX.log("Using fadeInSliderName from createOrUpdateTransition: " + sliderToUse);
                
                // Add opacity expression using the correct slider
                var opacityExpression = 'thisComp.layer("' + controller.name + 
                                       '").effect("' + sliderToUse + '")("Slider")';
                layer.opacity.expression = opacityExpression;
                DEBUG_JSX.log("Added opacity expression to " + layer.name + " using slider: " + sliderToUse);
            }
        }
        
        // Find all other layers linked to the slider we added keyframes to and add markers to them too
        var allLinkedLayers = findAllLayersLinkedToSlider(comp, controller, actualSliderName);
        DEBUG_JSX.log("Adding markers to " + allLinkedLayers.length + " other layers linked to " + actualSliderName);
        
        for (var j = 0; j < allLinkedLayers.length; j++) {
            var linkedLayer = allLinkedLayers[j];
            
            // Skip layers that were already processed in the main loop
            var alreadyProcessed = false;
            for (var k = 0; k < selectedLayers.length; k++) {
                if (linkedLayer === selectedLayers[k]) {
                    alreadyProcessed = true;
                    break;
                }
            }
            
            if (!alreadyProcessed) {
                // Add marker to this linked layer at the START of the fade-in animation
                var directionArrow = "";
                switch(actualDirection) {
                    case "left": directionArrow = "← "; break;
                    case "right": directionArrow = "→ "; break;
                    case "up": directionArrow = "↑ "; break;
                    case "down": directionArrow = "↓ "; break;
                    default: directionArrow = "← "; break;
                }
                var marker = new MarkerValue(directionArrow + "Fade In");
                var fadeInDelayMs = parseFloat(params.fadeInDelay);
                var markerTime = targetTransition.startTime + (fadeInDelayMs / 1000); // Start of fade in
                linkedLayer.marker.setValueAtTime(markerTime, marker);
                DEBUG_JSX.log("Added Fade In marker to linked layer " + linkedLayer.name + " at " + DEBUG_JSX.formatTime(markerTime) + " (was already linked to " + actualSliderName + ")");
            }
        }
        
    } finally {
        // Always restore original time
        comp.time = originalTime;
    }
}

// Main function called from the panel to add an exit transition
function addExitTransition(params) {
    try {
        DEBUG_JSX.clear();
        DEBUG_JSX.log("addExitTransition called with params", JSON.stringify(params));
        
        // Check active composition
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error|No composition selected";
        }
        
        // Check selected layers
        var selectedLayers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layers[i].selected) {
                selectedLayers.push(comp.layers[i]);
            }
        }
        
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer.");
            return "error|No layers selected";
        }
        
        // Begin undo group
        app.beginUndoGroup("Add Exit Transition");
        
        try {
            // Get or create controller
            var result = getOrCreateTransitionController(comp, params.transitionType, params);
            var controller = result.controller;
            
            if (!controller) {
                throw new Error("Failed to create transition controller");
            }
            
            // Check if selected layers already have fade markers within the current transition
            if (checkForExistingFadeMarkers(selectedLayers, "fadeOut", controller, comp.time)) {
                alert("Can't add overlapping transitions - selected layers already have fade markers in this transition");
                throw new Error("Existing fade markers detected in current transition");
            }
            
            // Create or update the transition
            var sliderInfo = createOrUpdateTransition(
                controller, 
                comp, 
                params, 
                result.transitionNumber, 
                !result.updateExisting,
                selectedLayers,
                "fadeOut"
            );
            
            // Add exit animation to selected layers
            DEBUG_JSX.log("Adding exit animation to " + selectedLayers.length + " layers");
            addExitToLayers(selectedLayers, controller, sliderInfo.fadeOutSliderName, comp, result.transitionNumber, !result.updateExisting, params);
            
            DEBUG_JSX.log("Exit transition added successfully");
            
        } finally {
            app.endUndoGroup();
        }
        
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + debugMessages.join("|");
        
    } catch(e) {
        var errorMsg = e.toString();
        DEBUG_JSX.error("Error in addExitTransition", errorMsg);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + errorMsg + "|" + debugMessages.join("|");
    }
}

// Main function called from the panel to add an enter transition
function addEnterTransition(params) {
    try {
        DEBUG_JSX.clear();
        DEBUG_JSX.log("addEnterTransition called with params", JSON.stringify(params));
        
        // Check active composition
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return "error|No composition selected";
        }
        
        // Check selected layers
        var selectedLayers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layers[i].selected) {
                selectedLayers.push(comp.layers[i]);
            }
        }
        
        if (selectedLayers.length === 0) {
            alert("Please select at least one layer.");
            return "error|No layers selected";
        }
        
        // Begin undo group
        app.beginUndoGroup("Add Enter Transition");
        
        try {
            // Get or create controller (same logic as exit)
            var result = getOrCreateTransitionController(comp, params.transitionType, params);
            var controller = result.controller;
            
            if (!controller) {
                throw new Error("Failed to create transition controller");
            }
            
            // Check if selected layers already have fade markers within the current transition
            if (checkForExistingFadeMarkers(selectedLayers, "fadeIn", controller, comp.time)) {
                alert("Can't add overlapping transitions - selected layers already have fade markers in this transition");
                throw new Error("Existing fade markers detected in current transition");
            }
            
            // Create or update the transition
            var sliderInfo = createOrUpdateTransition(
                controller, 
                comp, 
                params, 
                result.transitionNumber, 
                !result.updateExisting,
                selectedLayers,
                "fadeIn"
            );
            
            // Add enter animation to selected layers
            DEBUG_JSX.log("Adding enter animation to " + selectedLayers.length + " layers");
            addEnterToLayers(selectedLayers, controller, sliderInfo.fadeInSliderName, comp, result.transitionNumber, !result.updateExisting, params);
            
            DEBUG_JSX.log("Enter transition added successfully");
            
        } finally {
            app.endUndoGroup();
        }
        
        var debugMessages = DEBUG_JSX.getMessages();
        return "success|" + debugMessages.join("|");
        
    } catch(e) {
        var errorMsg = e.toString();
        DEBUG_JSX.error("Error in addEnterTransition", errorMsg);
        var debugMessages = DEBUG_JSX.getMessages();
        return "error|" + errorMsg + "|" + debugMessages.join("|");
    }
}

// Return plugin version for UI display
function getPluginVersion() {
    return PLUGIN_VERSION;
}