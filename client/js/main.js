// Transition Kit - Client-side JavaScript
// Handles UI interactions and communicates with After Effects

// Initialize CSInterface
var csInterface = new CSInterface();
var extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

// Debug utilities for custom debug panel
var DEBUG = {
    log: function(msg, data) {
        var debugLog = document.getElementById('debug-log');
        if (debugLog) {
            var logEntry = document.createElement('div');
            logEntry.textContent = '🎬 ' + msg + (data ? ' | ' + data : '');
            logEntry.style.borderBottom = '1px solid #333';
            logEntry.style.padding = '2px 0';
            logEntry.style.color = '#4a90e2';
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    },
    error: function(msg, error) {
        var debugLog = document.getElementById('debug-log');
        if (debugLog) {
            var logEntry = document.createElement('div');
            logEntry.textContent = '❌ ' + msg + (error ? ' | ' + error : '');
            logEntry.style.borderBottom = '1px solid #333';
            logEntry.style.padding = '2px 0';
            logEntry.style.color = '#ff5555';
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    },
    info: function(msg, data) {
        var debugLog = document.getElementById('debug-log');
        if (debugLog) {
            var logEntry = document.createElement('div');
            logEntry.textContent = 'ℹ️ ' + msg + (data ? ' | ' + data : '');
            logEntry.style.borderBottom = '1px solid #333';
            logEntry.style.padding = '2px 0';
            logEntry.style.color = '#f39c12';
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    },
    warn: function(msg, data) {
        var debugLog = document.getElementById('debug-log');
        if (debugLog) {
            var logEntry = document.createElement('div');
            logEntry.textContent = '⚠️ ' + msg + (data ? ' | ' + data : '');
            logEntry.style.borderBottom = '1px solid #333';
            logEntry.style.padding = '2px 0';
            logEntry.style.color = '#ff9500';
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollhHeight;
        }
    }
};

// Direction management
var currentDirection = 'left'; // Default direction

// Initialize UI when panel loads
window.addEventListener('load', function() {
    // Direction button handlers - work as radio buttons
    var directionButtons = document.querySelectorAll('.direction-btn');
    
    directionButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            // Remove selected class from all buttons
            directionButtons.forEach(function(b) {
                b.classList.remove('selected');
            });
            
            // Add selected class to clicked button
            this.classList.add('selected');
            
            // Update current direction based on button
            if (this.id === 'slideLeft') {
                currentDirection = 'left';
            } else if (this.id === 'slideRight') {
                currentDirection = 'right';
            } else if (this.id === 'slideUp') {
                currentDirection = 'up';
            } else if (this.id === 'slideDown') {
                currentDirection = 'down';
            }
            
            DEBUG.log('Direction changed', currentDirection);
        });
    });
    
    // Add Exit button handler
    document.getElementById('addExit').addEventListener('click', function() {
        var params = {
            transitionType: document.getElementById('transitionType').value,
            fadeOutDelay: document.getElementById('fadeOutDelay').value,
            fadeOutDuration: document.getElementById('fadeOutDuration').value,
            fadeInDelay: document.getElementById('fadeInDelay').value,
            fadeInDuration: document.getElementById('fadeInDuration').value,
            slideDistance: document.getElementById('slideDistance').value,
            direction: currentDirection
        };
        
        DEBUG.log('Add Exit clicked', JSON.stringify(params));
        
        // Call ExtendScript function
        csInterface.evalScript('addExitTransition(' + JSON.stringify(params) + ')', function(result) {
            if (result) {
                var parts = result.split('|');
                var status = parts[0];
                
                if (status === 'error') {
                    DEBUG.error('Add Exit failed', parts[1]);
                    // Show additional debug info if available
                    for (var i = 2; i < parts.length; i++) {
                        if (parts[i]) DEBUG.info('Debug', parts[i]);
                    }
                } else {
                    DEBUG.log('Add Exit success', parts[1]);
                    // Show debug messages from ExtendScript
                    for (var i = 1; i < parts.length; i++) {
                        if (parts[i]) DEBUG.info('JSX', parts[i]);
                    }
                }
            }
        });
    });
    
    // Add Enter button handler
    document.getElementById('addEnter').addEventListener('click', function() {
        var params = {
            transitionType: document.getElementById('transitionType').value,
            fadeOutDelay: document.getElementById('fadeOutDelay').value,
            fadeOutDuration: document.getElementById('fadeOutDuration').value,
            fadeInDelay: document.getElementById('fadeInDelay').value,
            fadeInDuration: document.getElementById('fadeInDuration').value,
            slideDistance: document.getElementById('slideDistance').value,
            direction: currentDirection
        };
        
        DEBUG.log('Add Enter clicked', JSON.stringify(params));
        
        // Call ExtendScript function
        csInterface.evalScript('addEnterTransition(' + JSON.stringify(params) + ')', function(result) {
            if (result) {
                var parts = result.split('|');
                var status = parts[0];
                
                if (status === 'error') {
                    DEBUG.error('Add Enter failed', parts[1]);
                    // Show additional debug info if available
                    for (var i = 2; i < parts.length; i++) {
                        if (parts[i]) DEBUG.info('Debug', parts[i]);
                    }
                } else {
                    DEBUG.log('Add Enter success', parts[1]);
                    // Show debug messages from ExtendScript
                    for (var i = 1; i < parts.length; i++) {
                        if (parts[i]) DEBUG.info('JSX', parts[i]);
                    }
                }
            }
        });
    });
    
    // Add numeric input validation to all numeric inputs
    var numericInputs = document.querySelectorAll('.numeric-input');
    numericInputs.forEach(function(input) {
        input.addEventListener('input', function(e) {
            // Remove any non-numeric characters (except decimal point)
            var value = e.target.value.replace(/[^0-9.]/g, '');
            
            // Ensure only one decimal point
            var parts = value.split('.');
            if (parts.length > 2) {
                value = parts[0] + '.' + parts.slice(1).join('');
            }
            
            // Update the input value if it was modified
            if (e.target.value !== value) {
                e.target.value = value;
            }
        });
        
        // Prevent non-numeric keys (except navigation keys)
        input.addEventListener('keydown', function(e) {
            // Allow backspace, delete, tab, escape, enter, home, end, left, right
            if ([8, 9, 27, 13, 46, 35, 36, 37, 39].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) || 
                (e.keyCode === 67 && e.ctrlKey === true) || 
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            // Allow numbers and decimal point
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && 
                (e.keyCode < 96 || e.keyCode > 105) && 
                e.keyCode !== 190 && e.keyCode !== 110) {
                e.preventDefault();
            }
        });
    });
    
    // Global tooltip creation function (similar to AirBoard style)
    function createTooltip(element, text) {
        var tooltip = null;
        
        element.addEventListener('mouseenter', function() {
            tooltip = document.createElement('div');
            tooltip.textContent = text;
            tooltip.style.cssText = `
                position: fixed;
                background-color: #1a1a1a;
                color: #ffffff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 400;
                white-space: nowrap;
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
            `;
            
            document.body.appendChild(tooltip);
            
            var rect = element.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = (rect.bottom + 4) + 'px';
            
            setTimeout(() => tooltip.style.opacity = '1', 10);
        });
        
        element.addEventListener('mouseleave', function() {
            if (tooltip) {
                tooltip.style.opacity = '0';
                setTimeout(() => {
                    if (tooltip && tooltip.parentNode) {
                        tooltip.parentNode.removeChild(tooltip);
                    }
                    tooltip = null;
                }, 200);
            }
        });
    }
    
    // Setup tooltips for the 4 fade inputs
    createTooltip(document.getElementById('fadeOutDelay'), 'Delay');
    createTooltip(document.getElementById('fadeOutDuration'), 'Duration');
    createTooltip(document.getElementById('fadeInDelay'), 'Delay');
    createTooltip(document.getElementById('fadeInDuration'), 'Duration');
    
    DEBUG.log('Transition Kit initialized', 'v1.0.0');
});
