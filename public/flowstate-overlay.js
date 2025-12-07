/**
 * FlowState Browser Overlay
 * 
 * Add this to any page: <script src="http://localhost:3001/flowstate-overlay.js"></script>
 * Or use the bookmarklet version
 * 
 * Click the 🌊 button to enter FlowState mode
 * Hover elements to highlight them
 * Click to analyze and heal
 */

(function() {
  'use strict';
  
  const API_BASE = 'http://localhost:3001';
  
  // Prevent double injection
  if (window.__flowstateLoaded) return;
  window.__flowstateLoaded = true;
  
  // State
  let isActive = false;
  let selectedElement = null;
  let selectedElements = []; // Multi-select support
  let hoveredElement = null;
  let defects = [];
  let originalStyles = new Map();
  let variationStyles = [];
  let currentVariation = -1; // -1 = original

  // ==========================================================================
  // CONSOLE ERROR CAPTURE - For debugging broken pages
  // ==========================================================================
  let capturedErrors = [];
  let consoleCapture = {
    errors: [],
    warnings: [],
    logs: []
  };
  let originalConsole = {
    error: console.error,
    warn: console.warn,
    log: console.log
  };

  // Intercept console methods to capture errors
  function setupConsoleCapture() {
    console.error = function(...args) {
      consoleCapture.errors.push({
        timestamp: new Date().toISOString(),
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
        stack: new Error().stack
      });
      originalConsole.error.apply(console, args);
      updateErrorBadge();
    };

    console.warn = function(...args) {
      consoleCapture.warnings.push({
        timestamp: new Date().toISOString(),
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
      });
      originalConsole.warn.apply(console, args);
      updateErrorBadge();
    };
  }

  // Capture unhandled errors
  function setupErrorListeners() {
    window.addEventListener('error', function(event) {
      capturedErrors.push({
        type: 'error',
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
      updateErrorBadge();
    });

    window.addEventListener('unhandledrejection', function(event) {
      capturedErrors.push({
        type: 'promise',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString()
      });
      updateErrorBadge();
    });
  }

  function updateErrorBadge() {
    const totalErrors = capturedErrors.length + consoleCapture.errors.length;
    const badge = document.getElementById('flowstate-error-badge');
    if (badge) {
      if (totalErrors > 0) {
        badge.textContent = totalErrors > 99 ? '99+' : totalErrors;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function getAllErrors() {
    return {
      uncaught: capturedErrors,
      console: consoleCapture.errors,
      warnings: consoleCapture.warnings,
      total: capturedErrors.length + consoleCapture.errors.length
    };
  }

  function clearCapturedErrors() {
    capturedErrors = [];
    consoleCapture = { errors: [], warnings: [], logs: [] };
    updateErrorBadge();
  }

  // Initialize error capture immediately
  setupConsoleCapture();
  setupErrorListeners();

  // ==========================================================================
  // DEMO FAILSAFE MODE - Press Ctrl+Shift+D to toggle
  // Uses cached "perfect" responses if API fails during demo
  // ==========================================================================
  let demoMode = false;
  const DEMO_CACHED_RESPONSES = {
    // Cached defects for ugly buttons
    button: [
      { issue: 'Button padding is too small for comfortable touch targets', expected: 'padding: 14px 24px', why: 'Touch targets should be at least 44x44px for accessibility', autoFix: { padding: '14px 24px' } },
      { issue: 'Border radius inconsistent with other UI elements', expected: 'border-radius: 8px', why: 'Consistent border-radius creates visual harmony', autoFix: { borderRadius: '8px' } },
      { issue: 'Low color contrast reduces readability', expected: 'background: #D4FF00; color: #0A0A0B', why: 'WCAG requires 4.5:1 contrast ratio for text', autoFix: { background: '#D4FF00', color: '#0A0A0B' } },
      { issue: 'Font size too small for primary CTA', expected: 'font-size: 15px; font-weight: 600', why: 'Primary actions should be visually prominent', autoFix: { fontSize: '15px', fontWeight: '600' } }
    ],
    // Cached defects for generic elements
    generic: [
      { issue: 'Inconsistent spacing creates visual imbalance', expected: 'Use consistent padding: 16px', why: 'Consistent spacing improves visual hierarchy' },
      { issue: 'Element lacks visual hierarchy', expected: 'Add visual weight through color or size', why: 'Users should immediately understand importance' }
    ],
    // Cached image generation result - use a URL for demo
    image: {
      success: true,
      mimeType: 'image/jpeg',
      // Use a URL to a neon cityscape for impressive demo
      image: 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF8WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4xLWMwMDAgNzkuZWRhMmIzZmFjLCAyMDIxLzExLzE3LTE3OjIzOjE5ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4B//79/Pv6+fj39vX08/Lx8O/u7ezr6uno5+bl5OPi4eDf3t3c29rZ2NfW1dTT0tHQz87NzMvKycjHxsXEw8LBwL++vby7urm4t7a1tLOysbCvrq2sq6qpqKempaSjoqGgn56dnJuamZiXlpWUk5KRkI+OjYyLiomIh4aFhIOCgYB/fn18e3p5eHd2dXRzcnFwb25tbGtqaWhnZmVkY2JhYF9eXVxbWllYV1ZVVFNSUVBPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAAAh+QQAAAAAACwAAAAAZABkAAAI/wABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkyhTqlzJsqXLlzBjypxJs6bNmzhz6tzJs6fPn0CDCh1KtKjRo0iTKl3KtKnTp1CjSp1KtarVq1izat3KtavXr2DDih1LtqzZs2jTql3Ltq3bt3Djyp1Lt67du3jz6t3Lt6/fv4ADCx5MuLDhw4gTK17MuLHjx5AjS55MubLly5gza97MubPnz6BDix5NurTp06hTq17NurXr17Bjy55Nu7bt27hz697Nu7fv38CDCx9OvLjx48iTK1/OvLnz59CjS59Ovbr169iza9/Ovbv37+DDi/8fT768+fPo06tfz769+/fw48ufT7++/fv48+vfz7+///8ABijggAQWaOCBCCao4IIMNujggxBGKOGEFFZo4YUYZqjhhhx26OGHIIYo4ogklmjiiSimqOKKLLbo4NFFHPHFGDjmqOOOPPbo449ABmnEEEMsoUSSPxwxJJNINunkk0JKGSWWSTYJZZZUdjmllFlqmWWYWn5ZJplprmnlmmeiyWabb5IJp5xz0oknnXvamSeeevLp56B+BgooooYiuiijjT7KqKOOPuqopJFOSumlmFaq6aaWcqqpp5mGKuqopI56aqmmqsqqqquyOuqrrMbqKqyzyurrr7D+Kmywwwz/O2yxxx7r7LHEJsvssck2C220007rbLTYUovtttx6y+234H4b7rjilkvuueeqm+667Lrr7rvwvgtvvPTWS++9+Oarr7789uvvvwD3K/DABBds8MEJK8wwwgEvDHHDEkc8ccQVT3xxxhRv3PHGH3888sgjh1xyySejnLLKK7Pc8sotv9xyyzPDHPPLNM9sM84567wzzz37/DPQQAs9dNFCH130z0gnjfTSTDf9dNJSR031005TnfXVUme9NddeZ/111mGL/TXZZYd9Nttpe62222izzfbccs+dd91451033XvnjbfffOs9+OCB/234328n/vfijyveuOSLT174/+SXN97545RTnrnlmGuu+eacb45555uHTnrooo9ueummn4566puvzvrrsMcu++ywz0577bLf/jrutu+uu+69/9577r4Lf/vwvxOPe/HGH29878oXv7zzys8e/fPUN/88989Tn/313Hc/Pfjbe28++eCTXz755qOf/vnrp88+++27H/387s8v//zyz0///Pbfr//9/OOvv/789////wAAAAAAAA=='
    }
  };

  function toggleDemoMode() {
    demoMode = !demoMode;
    console.log(`%c[FlowState] Demo Mode: ${demoMode ? 'ON - Using cached responses' : 'OFF - Live API'}`,
      `color: ${demoMode ? '#D4FF00' : '#EF4444'}; font-weight: bold; font-size: 14px;`);

    // Show visual indicator
    const existing = document.getElementById('flowstate-demo-indicator');
    if (existing) existing.remove();

    if (demoMode) {
      const indicator = document.createElement('div');
      indicator.id = 'flowstate-demo-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(90deg, #818CF8, #D4FF00);
        color: #0A0A0B;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        z-index: 2147483647;
        font-family: 'Outfit', system-ui, sans-serif;
      `;
      indicator.textContent = 'DEMO MODE';
      document.body.appendChild(indicator);
    }
  }

  // Listen for Ctrl+Shift+D to toggle demo mode
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      toggleDemoMode();
    }
  });
  
  // Annotation State
  let annotationMode = false;
  let currentTool = 'select';
  let isDrawing = false;
  let annotations = [];
  let currentAnnotation = null;
  let ctx = null;
  
  // Voice State
  let isRecording = false;
  let recognition = null;
  let voiceTranscriptText = '';
  let voiceInstructions = []; // Stored voice commands
  
  // Optimization State
  let analysisCache = new Map(); // Cache element analyses
  let undoStack = []; // Track changes for undo
  let pageDesignSystem = null; // Detected design patterns
  let allChanges = []; // Track all applied changes for export
  
  // Smart Features State
  let systemInstructions = loadSystemInstructions(); // User-defined rules
  let changeHistory = []; // Full trace history
  let manualEditMode = false;
  let similarElements = []; // Elements similar to selected
  
  // =========================================================================
  // STYLES
  // =========================================================================
  
  const styles = document.createElement('style');
  styles.id = 'flowstate-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    
    #flowstate-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #D4FF00 0%, #B8E600 100%);
      border: none;
      cursor: pointer;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(212, 255, 0, 0.3), 0 2px 8px rgba(0,0,0,0.2);
      z-index: 2147483646;
      transition: all 0.2s ease;
      font-family: 'Outfit', system-ui, sans-serif;
    }
    
    #flowstate-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 32px rgba(212, 255, 0, 0.4), 0 4px 12px rgba(0,0,0,0.2);
    }
    
    #flowstate-fab.active {
      background: linear-gradient(135deg, #0A0A0B 0%, #1a1a2e 100%);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 0 2px #D4FF00;
    }
    
    #flowstate-fab.active::after {
      content: '✕';
      color: #D4FF00;
    }
    
    #flowstate-fab:not(.active)::after {
      content: '🌊';
    }
    
    .flowstate-highlight {
      outline: 2px solid #D4FF00 !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }
    
    .flowstate-selected {
      outline: 3px solid #D4FF00 !important;
      outline-offset: 2px !important;
      animation: flowstate-pulse 1.5s ease-in-out infinite !important;
    }
    
    @keyframes flowstate-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(212, 255, 0, 0.4); }
      50% { box-shadow: 0 0 0 10px rgba(212, 255, 0, 0); }
    }
    
    .flowstate-tooltip {
      position: fixed;
      background: #0A0A0B;
      color: #FAFAFA;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #27272A;
      pointer-events: none;
      z-index: 2147483645;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .flowstate-tooltip .tag {
      color: #D4FF00;
    }
    
    .flowstate-tooltip .dims {
      color: #71717A;
      margin-left: 8px;
    }
    
    #flowstate-panel {
      position: fixed;
      bottom: 24px;
      right: 96px;
      width: 460px;
      max-height: 70vh;
      background: #0A0A0B;
      border: 1px solid #27272A;
      border-radius: 16px;
      font-family: 'Outfit', system-ui, sans-serif;
      color: #FAFAFA;
      z-index: 2147483645;
      overflow: hidden;
      display: none;
      flex-direction: column;
      box-shadow: 0 8px 48px rgba(0,0,0,0.5);
      transition: all 0.3s ease;
    }

    #flowstate-panel.visible {
      display: flex;
      animation: flowstate-slideIn 0.2s ease;
    }

    /* Expanded Workspace Mode - leaves ~460px for page context */
    #flowstate-panel.expanded {
      width: calc(100vw - 500px);
      max-width: 900px;
      height: calc(100vh - 100px);
      max-height: calc(100vh - 100px);
      bottom: 50px;
      right: 24px;
    }

    #flowstate-panel.expanded .flowstate-panel-body {
      flex: 1;
      overflow-y: auto;
    }

    /* When expanded, push page content left to show context */
    body.flowstate-workspace-mode {
      margin-right: calc(100vw - 480px) !important;
      max-width: 460px !important;
      transition: margin-right 0.3s ease, max-width 0.3s ease;
    }

    /* Header action buttons */
    .flowstate-header-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .flowstate-header-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid #3F3F46;
      background: #27272A;
      color: #A1A1AA;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .flowstate-header-btn:hover {
      background: #3F3F46;
      color: #FAFAFA;
      border-color: #52525B;
    }

    .flowstate-header-btn.active {
      background: #D4FF00;
      color: #0A0A0B;
      border-color: #D4FF00;
    }

    .flowstate-header-btn.restart:hover {
      background: #EF4444;
      border-color: #EF4444;
      color: #FAFAFA;
    }

    /* Debug Button with Error Badge */
    .flowstate-debug-btn-wrapper {
      position: relative;
      display: inline-flex;
    }

    .flowstate-error-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 16px;
      height: 16px;
      background: #EF4444;
      color: #FAFAFA;
      font-size: 10px;
      font-weight: 700;
      border-radius: 50%;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      z-index: 10;
      animation: flowstate-pulse 2s infinite;
    }

    @keyframes flowstate-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .flowstate-header-btn.debug:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: #EF4444;
      color: #EF4444;
    }

    /* Debug Mode Panel */
    .flowstate-debug-mode {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .flowstate-debug-header {
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
      border-bottom: 1px solid rgba(239, 68, 68, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .flowstate-debug-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .flowstate-debug-badge {
      padding: 3px 8px;
      background: rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: #EF4444;
    }

    .flowstate-debug-count {
      color: #A1A1AA;
      font-size: 12px;
    }

    .flowstate-debug-actions {
      display: flex;
      gap: 8px;
    }

    .flowstate-debug-clear {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid #3F3F46;
      border-radius: 4px;
      color: #A1A1AA;
      font-size: 11px;
      cursor: pointer;
      font-family: inherit;
    }

    .flowstate-debug-clear:hover {
      border-color: #EF4444;
      color: #EF4444;
    }

    .flowstate-debug-back {
      padding: 4px 10px;
      background: transparent;
      border: 1px solid #3F3F46;
      border-radius: 4px;
      color: #FAFAFA;
      font-size: 11px;
      cursor: pointer;
      font-family: inherit;
    }

    .flowstate-debug-back:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .flowstate-error-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .flowstate-error-empty {
      text-align: center;
      padding: 40px 20px;
      color: #71717A;
    }

    .flowstate-error-empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }

    .flowstate-error-item {
      background: #18181B;
      border: 1px solid #27272A;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .flowstate-error-item.error {
      border-left: 3px solid #EF4444;
    }

    .flowstate-error-item.warning {
      border-left: 3px solid #F59E0B;
    }

    .flowstate-error-item.promise {
      border-left: 3px solid #8B5CF6;
    }

    .flowstate-error-type {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .flowstate-error-type.error {
      background: rgba(239, 68, 68, 0.2);
      color: #EF4444;
    }

    .flowstate-error-type.warning {
      background: rgba(245, 158, 11, 0.2);
      color: #F59E0B;
    }

    .flowstate-error-type.promise {
      background: rgba(139, 92, 246, 0.2);
      color: #8B5CF6;
    }

    .flowstate-error-message {
      font-size: 12px;
      color: #FAFAFA;
      margin-bottom: 8px;
      word-break: break-word;
    }

    .flowstate-error-source {
      font-size: 10px;
      color: #71717A;
      font-family: 'JetBrains Mono', monospace;
    }

    .flowstate-error-stack {
      margin-top: 8px;
      padding: 8px;
      background: #0A0A0B;
      border-radius: 4px;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: #71717A;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 100px;
      overflow-y: auto;
      display: none;
    }

    .flowstate-error-item:hover .flowstate-error-stack {
      display: block;
    }

    .flowstate-debug-analyze {
      margin: 12px;
      padding: 12px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(239, 68, 68, 0.1) 100%);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 8px;
    }

    .flowstate-debug-analyze-btn {
      width: 100%;
      padding: 10px 16px;
      background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
      border: none;
      border-radius: 6px;
      color: #FAFAFA;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }

    .flowstate-debug-analyze-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .flowstate-debug-analyze-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    @keyframes flowstate-slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .flowstate-panel-header {
      padding: 16px;
      border-bottom: 1px solid #27272A;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #111113;
    }
    
    .flowstate-panel-title {
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .flowstate-panel-title .icon {
      font-size: 16px;
    }
    
    .flowstate-element-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #D4FF00;
      background: rgba(212, 255, 0, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
    }
    
    .flowstate-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }
    
    .flowstate-status {
      text-align: center;
      padding: 24px;
      color: #71717A;
      font-size: 13px;
    }
    
    .flowstate-status .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #27272A;
      border-top-color: #D4FF00;
      border-radius: 50%;
      animation: flowstate-spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    
    @keyframes flowstate-spin {
      to { transform: rotate(360deg); }
    }
    
    .flowstate-defect {
      background: #111113;
      border: 1px solid #27272A;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .flowstate-defect:hover {
      border-color: #D4FF00;
      background: rgba(212, 255, 0, 0.05);
    }
    
    .flowstate-defect-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .flowstate-checkbox {
      width: 16px;
      height: 16px;
      border: 1px solid #3F3F46;
      border-radius: 4px;
      background: #050506;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    
    .flowstate-checkbox.checked {
      background: #D4FF00;
      border-color: #D4FF00;
    }
    
    .flowstate-checkbox.checked::after {
      content: '✓';
      font-size: 10px;
      color: #0A0A0B;
      font-weight: bold;
    }
    
    .flowstate-defect-issue {
      font-size: 12px;
      color: #D4D4D8;
      line-height: 1.4;
      flex: 1;
    }
    
    .flowstate-defect-meta {
      font-size: 10px;
      color: #71717A;
      margin-top: 6px;
      padding-left: 26px;
    }
    
    .flowstate-defect-meta .expected {
      color: #22C55E;
    }
    
    .flowstate-defect-meta .why {
      font-style: italic;
      color: #52525B;
    }
    
    .flowstate-quick-fix {
      padding: 2px 8px;
      background: rgba(212, 255, 0, 0.15);
      border: 1px solid rgba(212, 255, 0, 0.3);
      border-radius: 4px;
      color: #D4FF00;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }
    
    .flowstate-quick-fix:hover {
      background: rgba(212, 255, 0, 0.25);
    }
    
    .flowstate-quick-fix:disabled {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.4);
      color: #22C55E;
      cursor: default;
    }
    
    .flowstate-export-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #27272A;
    }
    
    .flowstate-export-btn {
      width: 100%;
      padding: 10px;
      background: #1a1a2e;
      border: 1px solid #27272A;
      border-radius: 6px;
      color: #D4D4D8;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .flowstate-export-btn:hover {
      background: #252538;
      border-color: #3f3f46;
    }
    
    /* Manual Edit Mode */
    .flowstate-edit-modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      background: #1a1a2e;
      border: 1px solid #3f3f46;
      border-radius: 16px;
      z-index: 2147483648;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      display: none;
      flex-direction: column;
    }
    
    .flowstate-edit-modal.visible {
      display: flex;
      animation: flowstate-slideIn 0.2s ease;
    }
    
    .flowstate-edit-header {
      padding: 16px 20px;
      border-bottom: 1px solid #27272A;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .flowstate-edit-title {
      font-size: 14px;
      font-weight: 600;
      color: #FAFAFA;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .flowstate-edit-tabs {
      display: flex;
      gap: 4px;
    }
    
    .flowstate-edit-tab {
      padding: 6px 12px;
      background: transparent;
      border: 1px solid #27272A;
      border-radius: 6px;
      color: #71717A;
      font-size: 12px;
      cursor: pointer;
    }
    
    .flowstate-edit-tab.active {
      background: #1a1a2e;
      border-color: #D4FF00;
      color: #D4FF00;
    }
    
    .flowstate-edit-body {
      flex: 1;
      overflow: auto;
      padding: 16px 20px;
    }
    
    .flowstate-code-editor {
      width: 100%;
      min-height: 200px;
      background: #252538;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      padding: 12px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 13px;
      color: #E4E4E7;
      resize: vertical;
      line-height: 1.5;
    }
    
    .flowstate-code-editor:focus {
      outline: none;
      border-color: #D4FF00;
    }
    
    .flowstate-edit-footer {
      padding: 16px 20px;
      border-top: 1px solid #27272A;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    
    .flowstate-edit-actions {
      display: flex;
      gap: 8px;
    }
    
    .flowstate-live-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #71717A;
    }
    
    .flowstate-toggle {
      width: 36px;
      height: 20px;
      background: #27272A;
      border-radius: 10px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .flowstate-toggle.on {
      background: #D4FF00;
    }
    
    .flowstate-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #FAFAFA;
      border-radius: 50%;
      transition: left 0.2s;
    }
    
    .flowstate-toggle.on::after {
      left: 18px;
    }
    
    /* Propagation Panel */
    .flowstate-propagate {
      background: rgba(212, 255, 0, 0.05);
      border: 1px solid rgba(212, 255, 0, 0.2);
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
    }
    
    .flowstate-propagate-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .flowstate-propagate-title {
      font-size: 12px;
      font-weight: 600;
      color: #D4FF00;
    }
    
    .flowstate-propagate-count {
      font-size: 11px;
      color: #71717A;
    }
    
    .flowstate-propagate-preview {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    
    .flowstate-propagate-item {
      padding: 4px 8px;
      background: #1a1a2e;
      border: 1px solid #27272A;
      border-radius: 4px;
      font-size: 11px;
      color: #D4D4D8;
    }
    
    .flowstate-propagate-actions {
      display: flex;
      gap: 8px;
    }
    
    /* System Instructions */
    .flowstate-instructions {
      background: #111113;
      border: 1px solid #27272A;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .flowstate-instructions-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    
    .flowstate-instructions-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717A;
    }
    
    .flowstate-instructions-input {
      width: 100%;
      background: #0A0A0B;
      border: 1px solid #27272A;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      color: #D4D4D8;
      resize: none;
    }
    
    .flowstate-instructions-input:focus {
      outline: none;
      border-color: #3f3f46;
    }
    
    /* Change History */
    .flowstate-history {
      max-height: 150px;
      overflow-y: auto;
      margin-top: 12px;
    }
    
    .flowstate-history-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #1a1a2e;
      font-size: 11px;
    }
    
    .flowstate-history-time {
      color: #52525B;
      flex-shrink: 0;
      width: 50px;
    }
    
    .flowstate-history-action {
      color: #D4D4D8;
      flex: 1;
    }
    
    .flowstate-history-revert {
      color: #71717A;
      background: none;
      border: none;
      font-size: 11px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .flowstate-history-revert:hover {
      background: #27272A;
      color: #FAFAFA;
    }
    
    .flowstate-variations {
      display: flex;
      gap: 6px;
      margin: 16px 0;
      flex-wrap: wrap;
    }
    
    .flowstate-var-btn {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #27272A;
      background: #111113;
      color: #D4D4D8;
      font-size: 11px;
      font-family: 'Outfit', system-ui, sans-serif;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .flowstate-var-btn:hover {
      border-color: #D4FF00;
      color: #FAFAFA;
    }
    
    .flowstate-var-btn.active {
      background: #D4FF00;
      color: #0A0A0B;
      border-color: #D4FF00;
    }
    
    .flowstate-panel-footer {
      padding: 12px 16px;
      border-top: 1px solid #27272A;
      display: flex;
      gap: 8px;
      background: #111113;
    }
    
    .flowstate-btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Outfit', system-ui, sans-serif;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    
    .flowstate-btn-primary {
      background: #D4FF00;
      color: #0A0A0B;
    }
    
    .flowstate-btn-primary:hover {
      background: #E8FF4D;
    }
    
    .flowstate-btn-secondary {
      background: #1a1a2e;
      color: #FAFAFA;
      border: 1px solid #27272A;
    }
    
    .flowstate-btn-secondary:hover {
      border-color: #3F3F46;
    }
    
    .flowstate-empty {
      text-align: center;
      padding: 32px 16px;
      color: #71717A;
    }
    
    .flowstate-empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    /* Image Regeneration UI */
    .flowstate-image-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .flowstate-image-preview {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .flowstate-image-preview img {
      max-width: 80px;
      max-height: 60px;
      border-radius: 6px;
      border: 1px solid #3f3f46;
      object-fit: cover;
    }

    .flowstate-image-info {
      flex: 1;
      font-size: 11px;
      color: #A1A1AA;
    }

    .flowstate-image-prompt {
      width: 100%;
      min-height: 60px;
      background: #252538;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      padding: 10px;
      font-family: inherit;
      font-size: 12px;
      color: #E4E4E7;
      resize: vertical;
    }

    .flowstate-image-prompt:focus {
      outline: none;
      border-color: #D4FF00;
    }

    .flowstate-image-prompt::placeholder {
      color: #71717A;
    }

    .flowstate-image-actions {
      display: flex;
      gap: 8px;
    }

    .flowstate-image-result {
      margin-top: 8px;
      padding: 8px;
      background: rgba(212, 255, 0, 0.05);
      border: 1px solid rgba(212, 255, 0, 0.2);
      border-radius: 8px;
    }

    .flowstate-image-compare {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .flowstate-image-compare-item {
      flex: 1;
      text-align: center;
    }

    .flowstate-image-compare-item img {
      max-width: 100%;
      max-height: 120px;
      border-radius: 6px;
      border: 1px solid #3f3f46;
    }

    .flowstate-image-compare-label {
      font-size: 10px;
      color: #71717A;
      margin-top: 4px;
    }

    .flowstate-section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717A;
      margin: 16px 0 8px;
    }
    
    .flowstate-log {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #71717A;
      background: #050506;
      border-radius: 6px;
      padding: 10px;
      margin-top: 12px;
      max-height: 80px;
      overflow-y: auto;
    }
    
    .flowstate-log-line { padding: 2px 0; }
    .flowstate-log-line.success { color: #22C55E; }
    .flowstate-log-line.accent { color: #D4FF00; }
    .flowstate-log-line.error { color: #EF4444; }
    
    /* Annotation Mode */
    #flowstate-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483644;
      pointer-events: none;
      cursor: crosshair;
    }
    
    #flowstate-canvas.active {
      pointer-events: auto;
    }
    
    .flowstate-toolbar {
      position: fixed;
      bottom: 90px;
      right: 24px;
      background: #0A0A0B;
      border: 1px solid #27272A;
      border-radius: 12px;
      padding: 8px;
      display: none;
      gap: 4px;
      z-index: 2147483647;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    
    .flowstate-toolbar.visible {
      display: flex;
    }
    
    .flowstate-tool {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #71717A;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    
    .flowstate-tool:hover {
      background: #1a1a2e;
      color: #FAFAFA;
    }
    
    .flowstate-tool.active {
      background: #D4FF00;
      color: #0A0A0B;
    }
    
    .flowstate-tool-divider {
      width: 1px;
      height: 24px;
      background: #27272A;
      margin: 0 4px;
      align-self: center;
    }
    
    .flowstate-heal-all {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      background: #D4FF00;
      color: #0A0A0B;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 4px;
    }
    
    .flowstate-heal-all:hover {
      background: #E8FF4D;
    }
    
    .flowstate-heal-all:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .flowstate-text-input {
      position: fixed;
      background: #0A0A0B;
      border: 2px solid #D4FF00;
      border-radius: 6px;
      padding: 8px 12px;
      color: #FAFAFA;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 14px;
      min-width: 150px;
      z-index: 2147483648;
      outline: none;
    }
    
    .flowstate-annotation-label {
      position: fixed;
      background: rgba(212, 255, 0, 0.9);
      color: #0A0A0B;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Outfit', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
      z-index: 2147483645;
      white-space: nowrap;
    }
    
    /* Voice Recording */
    .flowstate-voice-btn.recording {
      background: #EF4444 !important;
      color: white !important;
      animation: flowstate-recording-pulse 1s ease-in-out infinite;
    }
    
    @keyframes flowstate-recording-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    }
    
    .flowstate-voice-transcript {
      position: fixed;
      bottom: 160px;
      right: 24px;
      max-width: 350px;
      background: #0A0A0B;
      border: 1px solid #27272A;
      border-radius: 12px;
      padding: 16px;
      display: none;
      z-index: 2147483647;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    
    .flowstate-voice-transcript.visible {
      display: block;
      animation: flowstate-slideIn 0.2s ease;
    }
    
    .flowstate-voice-transcript.recording {
      border-color: #EF4444;
      box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3), 0 4px 24px rgba(0,0,0,0.4);
    }
    
    .flowstate-voice-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #71717A;
    }
    
    .flowstate-voice-header.recording {
      color: #EF4444;
    }
    
    .flowstate-voice-header .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #71717A;
    }
    
    .flowstate-voice-header.recording .dot {
      background: #EF4444;
      animation: flowstate-recording-pulse 1s ease-in-out infinite;
    }
    
    .flowstate-voice-text {
      font-size: 14px;
      color: #FAFAFA;
      line-height: 1.5;
      min-height: 24px;
    }
    
    .flowstate-voice-text.interim {
      color: #71717A;
      font-style: italic;
    }
    
    .flowstate-voice-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    .flowstate-voice-action {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Outfit', system-ui, sans-serif;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .flowstate-voice-action.primary {
      background: #D4FF00;
      color: #0A0A0B;
    }
    
    .flowstate-voice-action.secondary {
      background: #1a1a2e;
      color: #FAFAFA;
      border: 1px solid #27272A;
    }

    /* Usage Dashboard */
    .flowstate-usage-btn {
      position: relative;
    }

    .flowstate-usage-indicator {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22C55E;
    }

    .flowstate-usage-indicator.warning {
      background: #F59E0B;
    }

    .flowstate-usage-indicator.danger {
      background: #EF4444;
    }

    .flowstate-usage-popup {
      position: fixed;
      bottom: 160px;
      right: 24px;
      width: 280px;
      background: #0A0A0B;
      border: 1px solid #27272A;
      border-radius: 12px;
      padding: 16px;
      z-index: 2147483648;
      display: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }

    .flowstate-usage-popup.visible {
      display: block;
      animation: flowstate-slideIn 0.2s ease;
    }

    .flowstate-usage-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #27272A;
    }

    .flowstate-usage-title {
      font-size: 13px;
      font-weight: 600;
      color: #FAFAFA;
    }

    .flowstate-usage-close {
      background: none;
      border: none;
      color: #71717A;
      cursor: pointer;
      font-size: 16px;
      padding: 0;
    }

    .flowstate-usage-stat {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #1a1a2e;
    }

    .flowstate-usage-stat:last-child {
      border-bottom: none;
    }

    .flowstate-usage-label {
      font-size: 11px;
      color: #71717A;
    }

    .flowstate-usage-value {
      font-size: 12px;
      color: #FAFAFA;
      font-weight: 500;
    }

    .flowstate-budget-bar {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #27272A;
    }

    .flowstate-budget-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .flowstate-budget-label {
      font-size: 11px;
      color: #71717A;
    }

    .flowstate-budget-amount {
      font-size: 11px;
      color: #D4FF00;
      font-weight: 600;
    }

    .flowstate-budget-track {
      height: 6px;
      background: #27272A;
      border-radius: 3px;
      overflow: hidden;
    }

    .flowstate-budget-fill {
      height: 100%;
      background: #22C55E;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .flowstate-budget-fill.warning {
      background: #F59E0B;
    }

    .flowstate-budget-fill.danger {
      background: #EF4444;
    }

    .flowstate-usage-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .flowstate-usage-actions button {
      flex: 1;
      padding: 6px 10px;
      font-size: 11px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    /* Educational / Learn Mode */
    .flowstate-learn-btn {
      padding: 2px 6px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 4px;
      color: #818CF8;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .flowstate-learn-btn:hover {
      background: rgba(99, 102, 241, 0.25);
    }

    .flowstate-learn-panel {
      margin-top: 8px;
      padding: 12px;
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 8px;
      display: none;
    }

    .flowstate-learn-panel.visible {
      display: block;
      animation: flowstate-slideIn 0.2s ease;
    }

    .flowstate-learn-title {
      font-size: 11px;
      font-weight: 600;
      color: #818CF8;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .flowstate-learn-content {
      font-size: 11px;
      color: #A1A1AA;
      line-height: 1.5;
    }

    .flowstate-learn-content strong {
      color: #D4D4D8;
    }

    .flowstate-learn-example {
      margin-top: 8px;
      padding: 8px;
      background: #0A0A0B;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 10px;
      color: #D4FF00;
    }

    .flowstate-learn-tip {
      margin-top: 8px;
      padding: 6px 8px;
      background: rgba(34, 197, 94, 0.1);
      border-left: 2px solid #22C55E;
      font-size: 10px;
      color: #A1A1AA;
    }

    .flowstate-learn-tip strong {
      color: #22C55E;
    }

    /* Enter EDU Mode Button */
    .flowstate-enter-edu {
      width: 100%;
      margin-top: 12px;
      padding: 10px 16px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(212, 255, 0, 0.15) 100%);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 8px;
      color: #FAFAFA;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .flowstate-enter-edu:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(212, 255, 0, 0.25) 100%);
      border-color: rgba(99, 102, 241, 0.6);
      transform: translateY(-1px);
    }

    .flowstate-enter-edu:active {
      transform: translateY(0);
    }

    /* EDU Mode - Full Chat Experience */
    .flowstate-edu-mode {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .flowstate-edu-header {
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(212, 255, 0, 0.1) 100%);
      border-bottom: 1px solid rgba(99, 102, 241, 0.2);
    }

    .flowstate-edu-context {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .flowstate-edu-badge {
      padding: 3px 8px;
      background: rgba(99, 102, 241, 0.3);
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #818CF8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .flowstate-edu-topic {
      font-size: 14px;
      font-weight: 600;
      color: #FAFAFA;
    }

    .flowstate-edu-summary {
      font-size: 11px;
      color: #A1A1AA;
      line-height: 1.4;
    }

    .flowstate-edu-back {
      padding: 4px 8px;
      background: transparent;
      border: 1px solid #3F3F46;
      border-radius: 4px;
      color: #A1A1AA;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
      margin-left: auto;
    }

    .flowstate-edu-back:hover {
      background: #27272A;
      color: #FAFAFA;
    }

    .flowstate-edu-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .flowstate-edu-message {
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1.5;
      max-width: 90%;
    }

    .flowstate-edu-message.user {
      background: rgba(212, 255, 0, 0.15);
      border: 1px solid rgba(212, 255, 0, 0.3);
      color: #D4FF00;
      align-self: flex-end;
    }

    .flowstate-edu-message.assistant {
      background: #18181B;
      border: 1px solid #27272A;
      color: #D4D4D8;
      align-self: flex-start;
    }

    .flowstate-edu-message code {
      background: rgba(0, 0, 0, 0.4);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
      color: #D4FF00;
    }

    .flowstate-edu-message pre {
      background: #0A0A0B;
      padding: 10px;
      border-radius: 6px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 11px;
    }

    .flowstate-edu-message strong {
      color: #FAFAFA;
    }

    .flowstate-edu-input-area {
      padding: 12px 16px;
      border-top: 1px solid #27272A;
      background: #111113;
    }

    .flowstate-edu-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }

    .flowstate-edu-suggestion {
      padding: 4px 10px;
      background: #27272A;
      border: 1px solid #3F3F46;
      border-radius: 12px;
      color: #A1A1AA;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .flowstate-edu-suggestion:hover {
      background: #3F3F46;
      color: #FAFAFA;
      border-color: #52525B;
    }

    .flowstate-edu-input-row {
      display: flex;
      gap: 8px;
    }

    .flowstate-edu-input {
      flex: 1;
      padding: 10px 14px;
      background: #18181B;
      border: 1px solid #3F3F46;
      border-radius: 8px;
      color: #FAFAFA;
      font-size: 13px;
      font-family: inherit;
    }

    .flowstate-edu-input:focus {
      outline: none;
      border-color: #D4FF00;
    }

    .flowstate-edu-input::placeholder {
      color: #52525B;
    }

    .flowstate-edu-send {
      padding: 10px 16px;
      background: #D4FF00;
      border: none;
      border-radius: 8px;
      color: #0A0A0B;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .flowstate-edu-send:hover {
      background: #B8E600;
    }

    .flowstate-edu-send:disabled {
      background: #3F3F46;
      color: #71717A;
      cursor: not-allowed;
    }

    .flowstate-edu-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #71717A;
      padding: 8px 12px;
      background: #18181B;
      border-radius: 8px;
      align-self: flex-start;
    }

    .flowstate-edu-loading::before {
      content: '';
      width: 14px;
      height: 14px;
      border: 2px solid #3F3F46;
      border-top-color: #818CF8;
      border-radius: 50%;
      animation: flowstate-spin 0.8s linear infinite;
    }

    @keyframes flowstate-spin {
      to { transform: rotate(360deg); }
    }

    /* Enter EDU Mode button in learn panels */
    .flowstate-enter-edu {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;
      padding: 8px 12px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(212, 255, 0, 0.15) 100%);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 6px;
      color: #818CF8;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      width: 100%;
    }

    .flowstate-enter-edu:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(212, 255, 0, 0.25) 100%);
      border-color: #818CF8;
      color: #A5B4FC;
    }

    /* Onboarding Tooltip */
    .flowstate-onboarding {
      position: fixed;
      z-index: 2147483649;
      background: #18181B;
      border: 1px solid #3F3F46;
      border-radius: 12px;
      padding: 16px;
      max-width: 300px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      animation: flowstate-slideIn 0.3s ease;
    }

    .flowstate-onboarding::before {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      background: #18181B;
      border: 1px solid #3F3F46;
      border-right: none;
      border-bottom: none;
      transform: rotate(45deg);
    }

    .flowstate-onboarding.arrow-left::before {
      left: -7px;
      top: 20px;
    }

    .flowstate-onboarding.arrow-bottom::before {
      bottom: -7px;
      left: 50%;
      transform: translateX(-50%) rotate(-135deg);
    }

    .flowstate-onboarding-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .flowstate-onboarding-step {
      background: #D4FF00;
      color: #0A0A0B;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .flowstate-onboarding-title {
      font-size: 13px;
      font-weight: 600;
      color: #FAFAFA;
    }

    .flowstate-onboarding-content {
      font-size: 12px;
      color: #A1A1AA;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .flowstate-onboarding-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .flowstate-onboarding-skip {
      padding: 6px 12px;
      background: transparent;
      border: none;
      color: #71717A;
      font-size: 11px;
      cursor: pointer;
    }

    .flowstate-onboarding-next {
      padding: 6px 12px;
      background: #D4FF00;
      border: none;
      border-radius: 6px;
      color: #0A0A0B;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    .flowstate-onboarding-progress {
      display: flex;
      gap: 4px;
      margin-top: 12px;
      justify-content: center;
    }

    .flowstate-onboarding-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3F3F46;
    }

    .flowstate-onboarding-dot.active {
      background: #D4FF00;
    }

    .flowstate-onboarding-dot.completed {
      background: #22C55E;
    }
  `;
  document.head.appendChild(styles);
  
  // =========================================================================
  // DOM ELEMENTS
  // =========================================================================
  
  // Floating Action Button
  const fab = document.createElement('button');
  fab.id = 'flowstate-fab';
  fab.title = 'FlowState';
  document.body.appendChild(fab);
  
  // Tooltip (shows element info on hover)
  const tooltip = document.createElement('div');
  tooltip.className = 'flowstate-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
  
  // Panel
  const panel = document.createElement('div');
  panel.id = 'flowstate-panel';
  panel.innerHTML = `
    <div class="flowstate-panel-header">
      <div class="flowstate-panel-title">
        <span class="icon">🌊</span>
        FlowState
      </div>
      <div class="flowstate-header-actions">
        <span class="flowstate-element-tag" id="flowstate-selected-tag">Select an element</span>
        <button class="flowstate-header-btn" id="flowstate-demo-script-btn" title="Toggle Demo Script">📋</button>
        <button class="flowstate-header-btn" id="flowstate-guide-btn" title="Toggle Welcome Guide">❓</button>
        <div class="flowstate-debug-btn-wrapper">
          <button class="flowstate-header-btn debug" id="flowstate-debug-btn" title="Debug Mode - View Console Errors">🐛</button>
          <span class="flowstate-error-badge" id="flowstate-error-badge">0</span>
        </div>
        <button class="flowstate-header-btn" id="flowstate-expand-btn" title="Toggle Workspace Mode (W)">⬜</button>
        <button class="flowstate-header-btn" id="flowstate-refresh-btn" title="Refresh Page">↻</button>
        <button class="flowstate-header-btn restart" id="flowstate-restart-btn" title="Restart Server">⟳</button>
      </div>
    </div>
    <div class="flowstate-panel-body" id="flowstate-panel-body">
      <div class="flowstate-empty">
        <div class="flowstate-empty-icon">👆</div>
        <div>Click any element to analyze</div>
      </div>
    </div>
    <div class="flowstate-panel-footer">
      <button class="flowstate-btn flowstate-btn-primary" id="flowstate-apply-btn" disabled>
        ✨ Apply
      </button>
      <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-copy-btn" disabled>
        📋
      </button>
      <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-variations-btn" disabled>
        🎨
      </button>
      <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-annotate-btn" title="Annotate Mode">
        ✏️
      </button>
      <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-export-btn" title="Export All Changes">
        💾
      </button>
      <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-edit-btn" title="Manual Edit (M)">
        M
      </button>
      <button class="flowstate-btn flowstate-btn-secondary flowstate-usage-btn" id="flowstate-usage-btn" title="Usage & Budget">
        💰
        <span class="flowstate-usage-indicator" id="flowstate-usage-indicator"></span>
      </button>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Manual Edit Modal
  const editModal = document.createElement('div');
  editModal.className = 'flowstate-edit-modal';
  editModal.id = 'flowstate-edit-modal';
  editModal.innerHTML = `
    <div class="flowstate-edit-header">
      <div class="flowstate-edit-title">
        <span>✏️ Manual Edit</span>
        <span id="flowstate-edit-element" style="color: #D4FF00; font-weight: normal;"></span>
      </div>
      <div class="flowstate-edit-tabs">
        <button class="flowstate-edit-tab active" data-tab="css">CSS</button>
        <button class="flowstate-edit-tab" data-tab="html">HTML</button>
      </div>
    </div>
    <div class="flowstate-edit-body">
      <div class="flowstate-instructions">
        <div class="flowstate-instructions-header">
          <span class="flowstate-instructions-title">📐 System Instructions</span>
          <button id="flowstate-save-instructions" style="font-size: 10px; padding: 2px 6px; background: #1a1a2e; border: 1px solid #27272A; border-radius: 4px; color: #71717A; cursor: pointer;">Save</button>
        </div>
        <textarea class="flowstate-instructions-input" id="flowstate-instructions-input" rows="2" placeholder="e.g., 'Use 8px spacing scale. Primary color is #D4FF00. All buttons should have 12px 24px padding.'"></textarea>
      </div>
      <textarea class="flowstate-code-editor" id="flowstate-code-editor" spellcheck="false"></textarea>
      <div class="flowstate-propagate" id="flowstate-propagate" style="display: none;">
        <div class="flowstate-propagate-header">
          <span class="flowstate-propagate-title">🔄 Apply to Similar Elements?</span>
          <span class="flowstate-propagate-count" id="flowstate-propagate-count"></span>
        </div>
        <div class="flowstate-propagate-preview" id="flowstate-propagate-preview"></div>
        <div class="flowstate-propagate-actions">
          <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-propagate-yes" style="font-size: 11px; padding: 6px 12px;">Yes, apply to all</button>
          <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-propagate-no" style="font-size: 11px; padding: 6px 12px;">No, just this one</button>
        </div>
      </div>
    </div>
    <div class="flowstate-edit-footer">
      <div class="flowstate-live-toggle">
        <div class="flowstate-toggle on" id="flowstate-live-toggle"></div>
        <span>Live Preview</span>
      </div>
      <div class="flowstate-edit-actions">
        <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-edit-cancel">Cancel</button>
        <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-edit-ai">🤖 AI Suggest</button>
        <button class="flowstate-btn flowstate-btn-primary" id="flowstate-edit-apply">Apply</button>
      </div>
    </div>
  `;
  document.body.appendChild(editModal);
  
  // Backdrop for modal
  const modalBackdrop = document.createElement('div');
  modalBackdrop.id = 'flowstate-modal-backdrop';
  modalBackdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0,0,0,0.5);
    z-index: 2147483647;
    display: none;
  `;
  document.body.appendChild(modalBackdrop);
  
  // Annotation Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'flowstate-canvas';
  document.body.appendChild(canvas);
  
  // Annotation Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'flowstate-toolbar';
  toolbar.innerHTML = `
    <button class="flowstate-tool" data-tool="select" title="Select (V)">👆</button>
    <button class="flowstate-tool" data-tool="draw" title="Draw (D)">✏️</button>
    <button class="flowstate-tool" data-tool="eraser" title="Eraser (E)">🧹</button>
    <button class="flowstate-tool" data-tool="box" title="Box (B)">▢</button>
    <button class="flowstate-tool" data-tool="arrow" title="Arrow (A)">➝</button>
    <button class="flowstate-tool" data-tool="text" title="Text (T)">💬</button>
    <button class="flowstate-tool flowstate-voice-btn" data-tool="voice" title="Hold to Talk (Space)">🎙️</button>
    <div class="flowstate-tool-divider"></div>
    <button class="flowstate-tool" data-tool="undo" title="Undo Last (Z)">↩️</button>
    <button class="flowstate-tool" data-tool="clear" title="Clear All">🗑️</button>
    <button class="flowstate-heal-all" id="flowstate-heal-all" disabled>✨ Heal All</button>
  `;
  document.body.appendChild(toolbar);
  
  // Voice transcript display
  const voiceTranscript = document.createElement('div');
  voiceTranscript.id = 'flowstate-voice-transcript';
  voiceTranscript.className = 'flowstate-voice-transcript';
  document.body.appendChild(voiceTranscript);

  // Usage Dashboard Popup
  const usagePopup = document.createElement('div');
  usagePopup.id = 'flowstate-usage-popup';
  usagePopup.className = 'flowstate-usage-popup';
  usagePopup.innerHTML = `
    <div class="flowstate-usage-header">
      <span class="flowstate-usage-title">📊 Usage Dashboard</span>
      <button class="flowstate-usage-close" id="flowstate-usage-close">×</button>
    </div>
    <div id="flowstate-usage-content">
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">Loading...</span>
      </div>
    </div>
  `;
  document.body.appendChild(usagePopup);

  const healAllBtn = document.getElementById('flowstate-heal-all');
  const voiceBtn = toolbar.querySelector('.flowstate-voice-btn');
  
  const panelBody = document.getElementById('flowstate-panel-body');
  const selectedTag = document.getElementById('flowstate-selected-tag');
  const applyBtn = document.getElementById('flowstate-apply-btn');
  const copyBtn = document.getElementById('flowstate-copy-btn');
  const variationsBtn = document.getElementById('flowstate-variations-btn');
  const annotateBtn = document.getElementById('flowstate-annotate-btn');
  const exportBtn = document.getElementById('flowstate-export-btn');
  const editBtn = document.getElementById('flowstate-edit-btn');
  const usageBtn = document.getElementById('flowstate-usage-btn');
  const usageIndicator = document.getElementById('flowstate-usage-indicator');
  const expandBtn = document.getElementById('flowstate-expand-btn');
  const refreshBtn = document.getElementById('flowstate-refresh-btn');
  const restartBtn = document.getElementById('flowstate-restart-btn');
  const demoScriptBtn = document.getElementById('flowstate-demo-script-btn');
  const guideBtn = document.getElementById('flowstate-guide-btn');
  const debugBtn = document.getElementById('flowstate-debug-btn');

  // Debug mode button handler
  debugBtn?.addEventListener('click', enterDebugMode);

  // =========================================================================
  // DEMO SCRIPT TOGGLE
  // =========================================================================
  let demoScriptVisible = true; // Start visible by default

  function toggleDemoScript() {
    demoScriptVisible = !demoScriptVisible;
    // Find all demo instruction boxes on the page
    const demoBoxes = document.querySelectorAll('.demo-instructions');
    demoBoxes.forEach(box => {
      box.style.display = demoScriptVisible ? 'block' : 'none';
    });
    demoScriptBtn.classList.toggle('active', demoScriptVisible);
  }

  demoScriptBtn?.addEventListener('click', toggleDemoScript);

  // =========================================================================
  // WELCOME GUIDE TOGGLE
  // =========================================================================
  // Expose guideVisible globally so hideOnboarding can update it
  window.__flowstateGuideVisible = false;

  function toggleGuide() {
    window.__flowstateGuideVisible = !window.__flowstateGuideVisible;
    if (window.__flowstateGuideVisible) {
      // Show the onboarding from step 0
      showOnboarding(0);
    } else {
      // Hide the onboarding
      hideOnboarding();
    }
    guideBtn.classList.toggle('active', window.__flowstateGuideVisible);
  }

  guideBtn?.addEventListener('click', toggleGuide);

  // =========================================================================
  // WORKSPACE MODE (Expand/Collapse)
  // =========================================================================
  let isExpanded = false;

  function toggleWorkspaceMode() {
    isExpanded = !isExpanded;
    panel.classList.toggle('expanded', isExpanded);
    document.body.classList.toggle('flowstate-workspace-mode', isExpanded);
    expandBtn.textContent = isExpanded ? '⬛' : '⬜';
    expandBtn.classList.toggle('active', isExpanded);
  }

  expandBtn?.addEventListener('click', toggleWorkspaceMode);

  // Refresh page button
  refreshBtn?.addEventListener('click', () => {
    window.location.reload();
  });

  // Restart server button
  restartBtn?.addEventListener('click', async () => {
    const originalText = restartBtn.textContent;
    restartBtn.textContent = '...';
    restartBtn.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        restartBtn.textContent = '✓';
        // Wait for server to restart, then reload
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        restartBtn.textContent = '✗';
        setTimeout(() => {
          restartBtn.textContent = originalText;
          restartBtn.disabled = false;
        }, 2000);
      }
    } catch (e) {
      restartBtn.textContent = '✗';
      setTimeout(() => {
        restartBtn.textContent = originalText;
        restartBtn.disabled = false;
      }, 2000);
    }
  });

  // Keyboard shortcut: W for workspace mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (isActive && panel.classList.contains('visible')) {
          e.preventDefault();
          toggleWorkspaceMode();
        }
      }
    }
  });
  
  // =========================================================================
  // EDUCATIONAL KNOWLEDGE BASE
  // =========================================================================

  const DESIGN_KNOWLEDGE = {
    'padding': {
      title: '📐 What is Padding?',
      explanation: `<strong>Padding</strong> is the space between an element's content and its border. Think of it like the cushioning inside a box.`,
      why: `Good padding makes buttons easier to tap on mobile (44px minimum is recommended) and gives text room to breathe.`,
      example: `padding: 12px 16px;  /* top/bottom: 12px, left/right: 16px */`,
      tip: `Use consistent padding across similar elements for visual harmony.`
    },
    'border-radius': {
      title: '⭕ What is Border Radius?',
      explanation: `<strong>Border-radius</strong> rounds the corners of an element. Higher values = rounder corners.`,
      why: `Rounded corners feel friendlier and more modern. They also guide the eye and create visual flow.`,
      example: `border-radius: 8px;  /* All corners */\nborder-radius: 8px 0 0 8px;  /* Top-left only */`,
      tip: `Keep border-radius consistent across your UI. If buttons are 8px, inputs should match.`
    },
    'contrast': {
      title: '🎨 What is Color Contrast?',
      explanation: `<strong>Contrast</strong> is the difference in brightness between text and background. WCAG requires a ratio of at least 4.5:1 for normal text.`,
      why: `Low contrast makes text hard to read, especially for users with visual impairments or in bright sunlight.`,
      example: `/* Good: White on dark */\ncolor: #FAFAFA;\nbackground: #0A0A0B;\n\n/* Bad: Gray on gray */\ncolor: #666;\nbackground: #888;`,
      tip: `Use tools like WebAIM's contrast checker to verify your color choices.`
    },
    'spacing': {
      title: '📏 What is Spacing?',
      explanation: `<strong>Spacing</strong> includes margins (outside space) and gaps (between flex/grid children). Consistent spacing creates visual rhythm.`,
      why: `Inconsistent spacing looks chaotic and unprofessional. It also affects readability and hierarchy.`,
      example: `margin-bottom: 16px;\ngap: 8px;  /* In flexbox/grid */`,
      tip: `Use a spacing scale (4, 8, 12, 16, 24, 32px) instead of random values.`
    },
    'alignment': {
      title: '↔️ What is Alignment?',
      explanation: `<strong>Alignment</strong> creates invisible lines that connect elements visually. Flexbox and CSS Grid make alignment easy.`,
      why: `Misaligned elements create visual tension and look unprofessional. Our eyes naturally seek patterns.`,
      example: `display: flex;\nalign-items: center;  /* Vertical center */\njustify-content: center;  /* Horizontal center */`,
      tip: `Pick an alignment strategy (left, center, justified) and stick with it for consistency.`
    },
    'typography': {
      title: '🔤 Typography Basics',
      explanation: `<strong>Typography</strong> includes font size, weight, line-height, and letter-spacing. Good typography is readable and hierarchical.`,
      why: `Text is how users consume information. Poor typography = poor user experience.`,
      example: `font-size: 16px;  /* Body text minimum */\nline-height: 1.5;  /* 150% of font size */\nfont-weight: 600;  /* Semi-bold for headings */`,
      tip: `Limit yourself to 2-3 font sizes per page. Use weight and color for hierarchy instead.`
    },
    'touch-target': {
      title: '👆 Touch Targets',
      explanation: `<strong>Touch targets</strong> are the tappable areas of buttons and links. On mobile, fingers are less precise than mouse cursors.`,
      why: `Small touch targets cause frustration and accidental taps. Apple recommends 44x44px minimum.`,
      example: `min-height: 44px;\nmin-width: 44px;\npadding: 12px 16px;`,
      tip: `Even if text is small, the clickable area should be large. Use padding!`
    },
    'visual-hierarchy': {
      title: '📊 Visual Hierarchy',
      explanation: `<strong>Visual hierarchy</strong> guides the eye through content in order of importance. Size, color, weight, and position all contribute.`,
      why: `Without hierarchy, users don't know where to look first. Important actions get missed.`,
      example: `/* Primary button - most important */\nbackground: #D4FF00;\n\n/* Secondary - less emphasis */\nbackground: transparent;\nborder: 1px solid #D4FF00;`,
      tip: `Ask yourself: "What should users see first?" Then make that element most prominent.`
    },
    'consistency': {
      title: '🔄 Design Consistency',
      explanation: `<strong>Consistency</strong> means using the same styles for similar elements. Same buttons, same spacing, same colors throughout.`,
      why: `Inconsistency makes your app feel broken or unfinished. It also increases cognitive load.`,
      example: `/* Define once, use everywhere */\n:root {\n  --radius: 8px;\n  --primary: #D4FF00;\n}`,
      tip: `Create a simple style guide: 2-3 colors, 1-2 fonts, consistent spacing scale.`
    },
    'default': {
      title: '📚 Design Principles',
      explanation: `Good UI design follows core principles: <strong>clarity</strong> (is it obvious?), <strong>efficiency</strong> (is it easy to use?), and <strong>consistency</strong> (does it feel unified?).`,
      why: `These principles help users accomplish their goals without confusion or frustration.`,
      example: `/* Be explicit, not clever */\nbutton { cursor: pointer; }  /* Shows it's clickable */`,
      tip: `When in doubt, choose the more obvious solution. Cleverness rarely beats clarity.`
    }
  };

  // =========================================================================
  // EDU MODE - Interactive Learning Chat
  // =========================================================================

  let eduModeActive = false;
  let eduContext = null;
  let eduChatHistory = [];
  let previousPanelContent = null;

  function enterEduMode(topic, knowledge) {
    eduModeActive = true;
    eduContext = topic;
    eduChatHistory = [];

    // Save previous panel content for returning
    previousPanelContent = panelBody.innerHTML;

    // Get suggested questions based on topic
    const suggestions = getEduSuggestions(topic);

    // Build EDU Mode UI
    panelBody.innerHTML = `
      <div class="flowstate-edu-mode">
        <div class="flowstate-edu-header">
          <div class="flowstate-edu-context">
            <span class="flowstate-edu-badge">EDU Mode</span>
            <span class="flowstate-edu-topic">${knowledge.title}</span>
            <button class="flowstate-edu-back" id="edu-back-btn">← Back</button>
          </div>
          <div class="flowstate-edu-summary">${knowledge.explanation}</div>
        </div>

        <div class="flowstate-edu-messages" id="edu-messages">
          <div class="flowstate-edu-message assistant">
            <strong>Welcome to EDU Mode!</strong><br><br>
            I'm here to help you understand <strong>${topic}</strong> in depth. Here's what you should know:<br><br>
            <strong>Why it matters:</strong> ${knowledge.why}<br><br>
            <strong>Example:</strong><br>
            <pre>${escapeHtml(knowledge.example)}</pre>
            <strong>💡 Tip:</strong> ${knowledge.tip}<br><br>
            Ask me anything about this topic!
          </div>
        </div>

        <div class="flowstate-edu-input-area">
          <div class="flowstate-edu-suggestions" id="edu-suggestions">
            ${suggestions.map(s => `<button class="flowstate-edu-suggestion">${s}</button>`).join('')}
          </div>
          <div class="flowstate-edu-input-row">
            <input type="text" class="flowstate-edu-input" id="edu-input" placeholder="Ask a question about ${topic}..." />
            <button class="flowstate-edu-send" id="edu-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;

    // Auto-expand panel for better chat experience
    if (!isExpanded) {
      toggleWorkspaceMode();
    }

    // Add event listeners
    document.getElementById('edu-back-btn')?.addEventListener('click', exitEduMode);
    document.getElementById('edu-send-btn')?.addEventListener('click', sendEduMessage);
    document.getElementById('edu-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendEduMessage();
      }
    });

    // Suggestion click handlers
    document.querySelectorAll('.flowstate-edu-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('edu-input').value = btn.textContent;
        sendEduMessage();
      });
    });
  }

  function exitEduMode() {
    eduModeActive = false;
    eduContext = null;
    eduChatHistory = [];

    // Collapse panel if we expanded it
    if (isExpanded) {
      toggleWorkspaceMode();
    }

    // Restore previous content
    if (previousPanelContent) {
      panelBody.innerHTML = previousPanelContent;
      previousPanelContent = null;
      // Re-attach learn button handlers
      attachLearnButtonHandlers();
    }
  }

  // ==========================================================================
  // DEBUG MODE - Console Error Viewer
  // ==========================================================================
  let debugModeActive = false;
  let debugPreviousContent = null;

  function enterDebugMode() {
    debugModeActive = true;
    debugPreviousContent = panelBody.innerHTML;

    const errors = getAllErrors();

    // Build error list HTML
    let errorListHtml = '';

    // Add uncaught errors
    errors.uncaught.forEach(err => {
      const typeClass = err.type === 'promise' ? 'promise' : 'error';
      errorListHtml += `
        <div class="flowstate-error-item ${typeClass}">
          <span class="flowstate-error-type ${typeClass}">${err.type === 'promise' ? 'Promise Rejection' : 'Uncaught Error'}</span>
          <div class="flowstate-error-message">${escapeHtml(err.message)}</div>
          ${err.source ? `<div class="flowstate-error-source">${err.source}:${err.line}:${err.col}</div>` : ''}
          ${err.stack ? `<div class="flowstate-error-stack">${escapeHtml(err.stack)}</div>` : ''}
        </div>
      `;
    });

    // Add console errors
    errors.console.forEach(err => {
      errorListHtml += `
        <div class="flowstate-error-item error">
          <span class="flowstate-error-type error">Console Error</span>
          <div class="flowstate-error-message">${escapeHtml(err.message)}</div>
          ${err.stack ? `<div class="flowstate-error-stack">${escapeHtml(err.stack)}</div>` : ''}
        </div>
      `;
    });

    // Add warnings
    errors.warnings.forEach(warn => {
      errorListHtml += `
        <div class="flowstate-error-item warning">
          <span class="flowstate-error-type warning">Warning</span>
          <div class="flowstate-error-message">${escapeHtml(warn.message)}</div>
        </div>
      `;
    });

    // Build the debug mode UI
    panelBody.innerHTML = `
      <div class="flowstate-debug-mode">
        <div class="flowstate-debug-header">
          <div class="flowstate-debug-title">
            <span class="flowstate-debug-badge">DEBUG</span>
            <span class="flowstate-debug-count">${errors.total} error${errors.total !== 1 ? 's' : ''}, ${errors.warnings.length} warning${errors.warnings.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="flowstate-debug-actions">
            <button class="flowstate-debug-clear" id="debug-clear-btn">Clear All</button>
            <button class="flowstate-debug-back" id="debug-back-btn">← Back</button>
          </div>
        </div>

        <div class="flowstate-error-list" id="debug-error-list">
          ${errors.total + errors.warnings.length > 0 ? errorListHtml : `
            <div class="flowstate-error-empty">
              <div class="flowstate-error-empty-icon">✨</div>
              <div>No errors detected!</div>
              <div style="font-size: 11px; margin-top: 8px;">The console is clean.</div>
            </div>
          `}
        </div>

        ${errors.total > 0 ? `
          <div class="flowstate-debug-analyze">
            <button class="flowstate-debug-analyze-btn" id="debug-analyze-btn">
              🤖 Analyze Errors with AI
            </button>
          </div>
        ` : ''}
      </div>
    `;

    // Auto-expand for better viewing
    if (!isExpanded) {
      toggleWorkspaceMode();
    }

    // Add event listeners
    document.getElementById('debug-back-btn')?.addEventListener('click', exitDebugMode);
    document.getElementById('debug-clear-btn')?.addEventListener('click', () => {
      clearCapturedErrors();
      enterDebugMode(); // Refresh the view
    });
    document.getElementById('debug-analyze-btn')?.addEventListener('click', analyzeErrorsWithAI);
  }

  function exitDebugMode() {
    debugModeActive = false;

    if (isExpanded) {
      toggleWorkspaceMode();
    }

    if (debugPreviousContent) {
      panelBody.innerHTML = debugPreviousContent;
      debugPreviousContent = null;
      attachLearnButtonHandlers();
    }
  }

  async function analyzeErrorsWithAI() {
    const btn = document.getElementById('debug-analyze-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '🔄 Analyzing...';

    const errors = getAllErrors();

    // Format errors for the AI
    const errorSummary = [
      ...errors.uncaught.map(e => `[${e.type}] ${e.message}${e.source ? ` at ${e.source}:${e.line}` : ''}`),
      ...errors.console.map(e => `[console.error] ${e.message}`)
    ].join('\n\n');

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `I'm experiencing JavaScript errors on my webpage. Please analyze these errors and suggest fixes:\n\n${errorSummary}`,
          context: 'JavaScript debugging and error fixing',
          history: []
        })
      });

      const data = await response.json();

      if (data.success && data.response) {
        // Show AI response in a new message area
        const errorList = document.getElementById('debug-error-list');
        if (errorList) {
          errorList.innerHTML = `
            <div class="flowstate-error-item" style="border-left-color: #6366F1;">
              <span class="flowstate-error-type" style="background: rgba(99, 102, 241, 0.2); color: #6366F1;">AI Analysis</span>
              <div class="flowstate-error-message" style="white-space: pre-wrap;">${formatMarkdown(data.response)}</div>
            </div>
          ` + errorList.innerHTML;
        }
      }
    } catch (err) {
      console.error('Error analyzing with AI:', err);
    }

    btn.disabled = false;
    btn.textContent = '🤖 Analyze Errors with AI';
  }

  async function sendEduMessage() {
    const input = document.getElementById('edu-input');
    const messagesContainer = document.getElementById('edu-messages');
    const sendBtn = document.getElementById('edu-send-btn');
    const suggestionsContainer = document.getElementById('edu-suggestions');

    const message = input?.value.trim();
    if (!message) return;

    // Add user message to UI
    messagesContainer.innerHTML += `
      <div class="flowstate-edu-message user">${escapeHtml(message)}</div>
    `;

    // Clear input and disable send
    input.value = '';
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    // Hide suggestions after first message
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }

    // Add loading indicator
    messagesContainer.innerHTML += `
      <div class="flowstate-edu-loading" id="edu-loading">Thinking...</div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add to history
    eduChatHistory.push({ role: 'user', content: message });

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: eduContext,
          history: eduChatHistory.slice(-10) // Keep last 10 messages for context
        })
      });

      const data = await response.json();

      // Remove loading indicator
      document.getElementById('edu-loading')?.remove();

      if (data.success) {
        // Format response with basic markdown
        const formattedResponse = formatMarkdown(data.response);

        // Add assistant message
        messagesContainer.innerHTML += `
          <div class="flowstate-edu-message assistant">${formattedResponse}</div>
        `;

        // Add to history
        eduChatHistory.push({ role: 'assistant', content: data.response });

        // Update usage indicator if available
        if (data.usage) {
          updateUsageIndicator(data.usage);
        }
      } else {
        messagesContainer.innerHTML += `
          <div class="flowstate-edu-message assistant" style="border-color: #EF4444;">
            Sorry, I encountered an error: ${escapeHtml(data.error || 'Unknown error')}
          </div>
        `;
      }
    } catch (e) {
      document.getElementById('edu-loading')?.remove();
      messagesContainer.innerHTML += `
        <div class="flowstate-edu-message assistant" style="border-color: #EF4444;">
          Connection error. Please check if the server is running.
        </div>
      `;
    }

    // Re-enable send button
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function getEduSuggestions(topic) {
    const baseSuggestions = {
      'padding': ['What\'s the difference between padding and margin?', 'How do I make touch-friendly buttons?', 'What padding values should I use?'],
      'border-radius': ['How do I make a circle?', 'What\'s a good border-radius for buttons?', 'How do I round only specific corners?'],
      'contrast': ['How do I check my contrast ratio?', 'What are the WCAG guidelines?', 'How do I fix low contrast?'],
      'spacing': ['What\'s a good spacing scale?', 'How do I use CSS gap?', 'Margin vs padding - when to use each?'],
      'alignment': ['How does flexbox alignment work?', 'What\'s the difference between align-items and justify-content?'],
      'typography': ['What font sizes should I use?', 'How do I create text hierarchy?', 'What\'s a good line-height?'],
      'default': ['How do I improve my UI?', 'What makes a button look good?', 'How do I learn design?']
    };

    return baseSuggestions[topic] || baseSuggestions['default'];
  }

  function formatMarkdown(text) {
    // Basic markdown formatting
    return text
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre>$2</pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  function attachLearnButtonHandlers() {
    // Re-attach "Learn" button handlers after restoring content
    panelBody.querySelectorAll('.flowstate-learn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.index;
        const learnPanel = panelBody.querySelector(`.flowstate-learn-panel[data-learn-index="${idx}"]`);
        if (learnPanel) {
          panelBody.querySelectorAll('.flowstate-learn-panel.visible').forEach(p => {
            if (p !== learnPanel) p.classList.remove('visible');
          });
          learnPanel.classList.toggle('visible');
          btn.textContent = learnPanel.classList.contains('visible') ? '✕' : '📚';
        }
      });
    });

    // Re-attach "Enter EDU Mode" button handlers after restoring content
    panelBody.querySelectorAll('.flowstate-enter-edu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topic = btn.dataset.topic;
        try {
          const knowledge = JSON.parse(btn.dataset.knowledge.replace(/&#39;/g, "'"));
          enterEduMode(topic, knowledge);
        } catch (err) {
          console.error('Error parsing knowledge data:', err);
          enterEduMode(topic, { title: topic });
        }
      });
    });
  }

  function getKnowledgeForDefect(issue) {
    const issueLower = issue.toLowerCase();

    if (issueLower.includes('padding') || issueLower.includes('cramped') || issueLower.includes('tight')) {
      return DESIGN_KNOWLEDGE['padding'];
    }
    if (issueLower.includes('radius') || issueLower.includes('corner') || issueLower.includes('round')) {
      return DESIGN_KNOWLEDGE['border-radius'];
    }
    if (issueLower.includes('contrast') || issueLower.includes('readable') || issueLower.includes('legib')) {
      return DESIGN_KNOWLEDGE['contrast'];
    }
    if (issueLower.includes('spacing') || issueLower.includes('margin') || issueLower.includes('gap')) {
      return DESIGN_KNOWLEDGE['spacing'];
    }
    if (issueLower.includes('align') || issueLower.includes('center')) {
      return DESIGN_KNOWLEDGE['alignment'];
    }
    if (issueLower.includes('font') || issueLower.includes('text') || issueLower.includes('size')) {
      return DESIGN_KNOWLEDGE['typography'];
    }
    if (issueLower.includes('tap') || issueLower.includes('click') || issueLower.includes('touch') || issueLower.includes('small')) {
      return DESIGN_KNOWLEDGE['touch-target'];
    }
    if (issueLower.includes('hierarch') || issueLower.includes('emphasis') || issueLower.includes('prominence')) {
      return DESIGN_KNOWLEDGE['visual-hierarchy'];
    }
    if (issueLower.includes('consist') || issueLower.includes('match') || issueLower.includes('same')) {
      return DESIGN_KNOWLEDGE['consistency'];
    }

    return DESIGN_KNOWLEDGE['default'];
  }

  function renderLearnPanel(knowledge) {
    return `
      <div class="flowstate-learn-panel" id="flowstate-learn-panel">
        <div class="flowstate-learn-title">📚 ${knowledge.title}</div>
        <div class="flowstate-learn-content">
          ${knowledge.explanation}
        </div>
        <div class="flowstate-learn-content" style="margin-top: 8px;">
          <strong>Why it matters:</strong> ${knowledge.why}
        </div>
        <div class="flowstate-learn-example">
${knowledge.example}
        </div>
        <div class="flowstate-learn-tip">
          <strong>Pro tip:</strong> ${knowledge.tip}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // ONBOARDING SYSTEM
  // =========================================================================

  const ONBOARDING_STEPS = [
    {
      target: '#flowstate-fab',
      title: 'Welcome to FlowState!',
      content: 'FlowState helps you find and fix visual issues in your UI. Click this button to start inspecting elements.',
      position: 'left'
    },
    {
      target: '.flowstate-panel',
      title: 'The Analysis Panel',
      content: 'When you click an element, FlowState analyzes it and shows visual defects here. Each issue includes a suggested fix.',
      position: 'left'
    },
    {
      target: '.flowstate-learn-btn',
      title: 'Learn As You Go',
      content: 'Click "Learn" on any defect to understand WHY it matters. FlowState teaches you design principles as you use it.',
      position: 'bottom'
    },
    {
      target: '#flowstate-usage-btn',
      title: 'Track Your Usage',
      content: 'Monitor API calls, tokens, and budget. FlowState helps you stay within limits while you work.',
      position: 'top'
    }
  ];

  let currentOnboardingStep = 0;
  let onboardingElement = null;

  function shouldShowOnboarding() {
    // Disabled for demo - onboarding was causing UI issues
    return false;
    // return !localStorage.getItem('flowstate-onboarding-completed');
  }

  function showOnboarding(stepIndex = 0) {
    if (stepIndex >= ONBOARDING_STEPS.length) {
      completeOnboarding();
      return;
    }

    const step = ONBOARDING_STEPS[stepIndex];
    currentOnboardingStep = stepIndex;

    // Remove existing onboarding tooltip
    if (onboardingElement) {
      onboardingElement.remove();
    }

    // Create new tooltip
    onboardingElement = document.createElement('div');
    onboardingElement.className = `flowstate-onboarding arrow-${step.position === 'left' ? 'left' : 'bottom'}`;

    onboardingElement.innerHTML = `
      <div class="flowstate-onboarding-header">
        <span class="flowstate-onboarding-step">${stepIndex + 1}/${ONBOARDING_STEPS.length}</span>
        <span class="flowstate-onboarding-title">${step.title}</span>
      </div>
      <div class="flowstate-onboarding-content">${step.content}</div>
      <div class="flowstate-onboarding-actions">
        <button class="flowstate-onboarding-skip">Skip tour</button>
        <button class="flowstate-onboarding-next">${stepIndex === ONBOARDING_STEPS.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
      <div class="flowstate-onboarding-progress">
        ${ONBOARDING_STEPS.map((_, i) => `
          <span class="flowstate-onboarding-dot ${i < stepIndex ? 'completed' : ''} ${i === stepIndex ? 'active' : ''}"></span>
        `).join('')}
      </div>
    `;

    document.body.appendChild(onboardingElement);

    // Position the tooltip
    const target = document.querySelector(step.target);
    if (target) {
      const rect = target.getBoundingClientRect();

      if (step.position === 'left') {
        onboardingElement.style.right = `${window.innerWidth - rect.left + 20}px`;
        onboardingElement.style.top = `${rect.top}px`;
      } else if (step.position === 'bottom') {
        onboardingElement.style.left = `${rect.left}px`;
        onboardingElement.style.top = `${rect.bottom + 15}px`;
      } else if (step.position === 'top') {
        onboardingElement.style.left = `${rect.left}px`;
        onboardingElement.style.bottom = `${window.innerHeight - rect.top + 15}px`;
      }
    } else {
      // Fallback position
      onboardingElement.style.bottom = '100px';
      onboardingElement.style.right = '100px';
    }

    // Add event listeners
    onboardingElement.querySelector('.flowstate-onboarding-skip').addEventListener('click', completeOnboarding);
    onboardingElement.querySelector('.flowstate-onboarding-next').addEventListener('click', () => showOnboarding(stepIndex + 1));
  }

  function hideOnboarding() {
    if (onboardingElement) {
      onboardingElement.remove();
      onboardingElement = null;
    }
    // Update guide button state and global variable
    window.__flowstateGuideVisible = false;
    const guideBtn = document.getElementById('flowstate-guide-btn');
    if (guideBtn) guideBtn.classList.remove('active');
  }

  function completeOnboarding() {
    localStorage.setItem('flowstate-onboarding-completed', 'true');
    hideOnboarding();
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  function getSelector(el) {
    if (el.id) return `#${el.id}`;
    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.split(' ').filter(c => c && !c.startsWith('flowstate'));
      if (classes.length) selector += '.' + classes.slice(0, 2).join('.');
    }
    return selector;
  }
  
  function getElementInfo(el) {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      selector: getSelector(el),
      text: el.textContent?.substring(0, 30).trim() || null,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      styles: window.getComputedStyle(el)
    };
  }
  
  function captureElementAsImage(el) {
    return new Promise((resolve) => {
      // Use html2canvas if available, otherwise capture viewport
      if (window.html2canvas) {
        html2canvas(el, { backgroundColor: null, scale: 2 }).then(canvas => {
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        });
      } else {
        // Fallback: capture with bounding rect info
        const rect = el.getBoundingClientRect();
        const info = { rect, html: el.outerHTML, styles: getElementInfo(el).styles };
        resolve(btoa(JSON.stringify(info)));
      }
    });
  }
  
  function log(msg, type = '') {
    const logEl = document.getElementById('flowstate-log');
    if (!logEl) return;
    const line = document.createElement('div');
    line.className = 'flowstate-log-line ' + type;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  
  // =========================================================================
  // CORE LOGIC
  // =========================================================================
  
  function activate() {
    isActive = true;
    fab.classList.add('active');
    panel.classList.add('visible');
    document.body.style.cursor = 'crosshair';
    
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
  }
  
  function deactivate() {
    isActive = false;
    fab.classList.remove('active');
    panel.classList.remove('visible');
    document.body.style.cursor = '';
    tooltip.style.display = 'none';
    
    if (hoveredElement) {
      hoveredElement.classList.remove('flowstate-highlight');
      hoveredElement = null;
    }
    if (selectedElement) {
      selectedElement.classList.remove('flowstate-selected');
      selectedElement = null;
    }
    
    // Restore original styles
    originalStyles.forEach((styles, el) => {
      Object.assign(el.style, styles);
    });
    originalStyles.clear();
    variationStyles = [];
    currentVariation = -1;
    
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleClick, true);
  }
  
  function handleMouseOver(e) {
    if (!isActive) return;
    const el = e.target;
    
    // Ignore FlowState UI
    if (el.closest('#flowstate-fab') || el.closest('#flowstate-panel')) return;
    
    if (hoveredElement && hoveredElement !== el) {
      hoveredElement.classList.remove('flowstate-highlight');
    }
    
    el.classList.add('flowstate-highlight');
    hoveredElement = el;
    
    // Update tooltip
    const info = getElementInfo(el);
    tooltip.innerHTML = `<span class="tag">&lt;${info.tag}&gt;</span><span class="dims">${info.width}×${info.height}</span>`;
    tooltip.style.display = 'block';
    
    const rect = el.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - 30) + 'px';
  }
  
  function handleMouseOut(e) {
    if (!isActive) return;
    const el = e.target;
    
    if (el.closest('#flowstate-fab') || el.closest('#flowstate-panel')) return;
    
    if (el === hoveredElement && el !== selectedElement) {
      el.classList.remove('flowstate-highlight');
      hoveredElement = null;
      tooltip.style.display = 'none';
    }
  }
  
  async function handleClick(e) {
    if (!isActive) return;
    const el = e.target;
    
    // Ignore FlowState UI
    if (el.closest('#flowstate-fab') || el.closest('#flowstate-panel')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Deselect previous
    if (selectedElement) {
      selectedElement.classList.remove('flowstate-selected');
    }
    
    selectedElement = el;
    el.classList.remove('flowstate-highlight');
    el.classList.add('flowstate-selected');
    
    // Update panel
    const info = getElementInfo(el);
    selectedTag.textContent = `<${info.tag}>${info.text ? ' "' + info.text.substring(0, 15) + '"' : ''}`;
    
    // Show loading
    panelBody.innerHTML = `
      <div class="flowstate-status">
        <div class="spinner"></div>
        <div>Analyzing element...</div>
      </div>
    `;
    
    applyBtn.disabled = true;
    copyBtn.disabled = true;
    
    // Call API
    await analyzeElement(el);
  }
  
  // =========================================================================
  // DESIGN SYSTEM DETECTION
  // =========================================================================
  
  function detectDesignSystem() {
    const ds = {
      buttons: { padding: [], borderRadius: [], fontSize: [], colors: [] },
      inputs: { padding: [], borderRadius: [], fontSize: [], border: [] },
      spacing: [],
      colors: { backgrounds: [], text: [], accents: [] }
    };
    
    // Sample buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(btn => {
      const cs = window.getComputedStyle(btn);
      ds.buttons.padding.push(cs.padding);
      ds.buttons.borderRadius.push(cs.borderRadius);
      ds.buttons.fontSize.push(cs.fontSize);
      ds.buttons.colors.push(cs.backgroundColor);
    });
    
    // Sample inputs
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea').forEach(input => {
      const cs = window.getComputedStyle(input);
      ds.inputs.padding.push(cs.padding);
      ds.inputs.borderRadius.push(cs.borderRadius);
      ds.inputs.fontSize.push(cs.fontSize);
      ds.inputs.border.push(cs.border);
    });
    
    // Find most common values
    ds.common = {
      buttonPadding: mode(ds.buttons.padding),
      buttonRadius: mode(ds.buttons.borderRadius),
      buttonFontSize: mode(ds.buttons.fontSize),
      inputPadding: mode(ds.inputs.padding),
      inputRadius: mode(ds.inputs.borderRadius),
      inputBorder: mode(ds.inputs.border)
    };
    
    return ds;
  }
  
  function mode(arr) {
    if (!arr.length) return null;
    const counts = {};
    arr.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  
  // =========================================================================
  // LOCAL ANALYSIS (INSTANT)
  // =========================================================================
  
  function analyzeElementLocally(el) {
    const localDefects = [];
    const cs = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim()?.substring(0, 50) || '';
    
    // Lazy-detect design system
    if (!pageDesignSystem) {
      pageDesignSystem = detectDesignSystem();
    }
    const ds = pageDesignSystem;
    
    // Get sibling elements for comparison
    const siblings = el.parentElement ? Array.from(el.parentElement.children).filter(c => c !== el) : [];
    const siblingStyles = siblings.slice(0, 5).map(s => window.getComputedStyle(s));
    
    // =========================================================================
    // BUTTON CHECKS
    // =========================================================================
    if (tag === 'button' || el.getAttribute('role') === 'button' || el.type === 'submit') {
      // Padding check
      const padding = parseInt(cs.paddingTop) || 0;
      if (padding < 8) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: 'button',
          element_text: text,
          issue: `Button padding too small (${padding}px)`,
          expected: ds.common.buttonPadding || '12px 24px',
          why: 'Small padding makes buttons hard to tap on mobile',
          autoFix: { padding: ds.common.buttonPadding || '12px 24px' }
        });
      }
      
      // Border radius vs siblings/design system
      const radius = parseInt(cs.borderRadius) || 0;
      const expectedRadius = parseInt(ds.common.inputRadius) || 8;
      if (radius < 4 && expectedRadius >= 8) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: 'button',
          element_text: text,
          issue: `Button corners sharper than other elements (${radius}px vs ${expectedRadius}px)`,
          expected: `${expectedRadius}px to match design system`,
          why: 'Consistent border-radius creates visual harmony',
          autoFix: { borderRadius: ds.common.inputRadius || '8px' }
        });
      }
      
      // Width consistency with sibling inputs
      const siblingInputs = siblings.filter(s => s.tagName === 'INPUT');
      if (siblingInputs.length > 0) {
        const inputWidth = siblingInputs[0].getBoundingClientRect().width;
        const btnWidth = el.getBoundingClientRect().width;
        if (btnWidth < inputWidth * 0.9) {
          localDefects.push({
            id: `local-${localDefects.length}`,
            element: 'button',
            element_text: text,
            issue: `Button narrower than form inputs (${Math.round(btnWidth)}px vs ${Math.round(inputWidth)}px)`,
            expected: '100% width to match inputs',
            why: 'Buttons should align with form fields',
            autoFix: { width: '100%' }
          });
        }
      }
      
      // Contrast check
      const bgColor = cs.backgroundColor;
      const textColor = cs.color;
      if (bgColor && textColor) {
        const bgLum = getLuminance(bgColor);
        const textLum = getLuminance(textColor);
        const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);
        if (contrast < 3) {
          localDefects.push({
            id: `local-${localDefects.length}`,
            element: 'button',
            element_text: text,
            issue: `Low contrast between text and background (${contrast.toFixed(1)}:1)`,
            expected: 'At least 4.5:1 for WCAG AA',
            why: 'Poor contrast affects readability and accessibility',
            autoFix: textLum > bgLum ? { color: '#000000' } : { color: '#FFFFFF' }
          });
        }
      }
      
      // Font size check
      const fontSize = parseInt(cs.fontSize) || 16;
      if (fontSize < 14) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: 'button',
          element_text: text,
          issue: `Button text too small (${fontSize}px)`,
          expected: '14-16px minimum for readability',
          why: 'Small text is hard to read, especially on mobile',
          autoFix: { fontSize: '14px' }
        });
      }
    }
    
    // =========================================================================
    // INPUT CHECKS
    // =========================================================================
    if (tag === 'input' || tag === 'textarea') {
      const padding = parseInt(cs.paddingTop) || 0;
      if (padding < 8) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: tag,
          element_text: el.placeholder || '',
          issue: `Input padding too small (${padding}px)`,
          expected: ds.common.inputPadding || '12px 16px',
          why: 'Adequate padding improves readability and usability',
          autoFix: { padding: ds.common.inputPadding || '12px 16px' }
        });
      }
    }
    
    // =========================================================================
    // SPACING/ALIGNMENT CHECKS
    // =========================================================================
    if (siblings.length > 0) {
      const elMargin = parseInt(cs.marginBottom) || 0;
      const sibMargins = siblingStyles.map(s => parseInt(s.marginBottom) || 0);
      const avgMargin = sibMargins.reduce((a, b) => a + b, 0) / sibMargins.length;
      
      if (Math.abs(elMargin - avgMargin) > 8 && avgMargin > 0) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: tag,
          element_text: text,
          issue: `Spacing inconsistent with siblings (${elMargin}px vs avg ${Math.round(avgMargin)}px)`,
          expected: `${Math.round(avgMargin)}px margin-bottom`,
          why: 'Consistent spacing creates visual rhythm',
          autoFix: { marginBottom: `${Math.round(avgMargin)}px` }
        });
      }
    }
    
    // =========================================================================
    // IMAGE CHECKS
    // =========================================================================
    if (tag === 'img') {
      if (!el.src || el.src.includes('placeholder') || el.naturalWidth === 0) {
        localDefects.push({
          id: `local-${localDefects.length}`,
          element: 'img',
          element_text: el.alt || 'image',
          issue: 'Missing or placeholder image',
          expected: 'Actual image asset',
          why: 'Placeholder images look unfinished',
          needsAsset: true
        });
      }
    }
    
    return localDefects;
  }
  
  function getLuminance(color) {
    // Parse rgb/rgba
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return 0.5;
    const [, r, g, b] = match.map(Number);
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  
  // =========================================================================
  // MAIN ANALYZE FUNCTION (INSTANT + API)
  // =========================================================================
  
  async function analyzeElement(el) {
    const info = getElementInfo(el);

    // Check if this is an image element - show image panel instead
    if (isImageElement(el)) {
      renderImagePanel(el);
      // Disable style-related buttons for images
      applyBtn.disabled = true;
      copyBtn.disabled = true;
      variationsBtn.disabled = true;
      return;
    }

    // Check cache first
    const cacheKey = el.outerHTML.substring(0, 200);
    if (analysisCache.has(cacheKey)) {
      defects = analysisCache.get(cacheKey);
      renderDefects(defects, null);
      generateVariations(el);
      return;
    }

    // INSTANT: Show local analysis immediately
    const localDefects = analyzeElementLocally(el);
    defects = localDefects;
    renderDefects(defects, null, true); // true = show loading indicator for API

    if (localDefects.length > 0) {
      generateVariations(el);
    }

    // =====================================================
    // DEMO MODE: Use cached "perfect" responses
    // =====================================================
    if (demoMode) {
      const log = document.getElementById('flowstate-log');
      // Simulate a short delay for demo effect
      await new Promise(r => setTimeout(r, 800));

      // Choose cached responses based on element type
      const isButton = info.tag === 'button' ||
                       el.classList.contains('btn') ||
                       el.classList.contains('cta') ||
                       el.classList.contains('ugly-signup-btn') ||
                       el.classList.contains('bad-cta');

      const cachedDefects = isButton ? DEMO_CACHED_RESPONSES.button : DEMO_CACHED_RESPONSES.generic;
      defects = mergeDefects(localDefects, cachedDefects);
      analysisCache.set(cacheKey, defects);
      renderDefects(defects, null);
      generateVariations(el);

      if (log) {
        log.innerHTML += `<div class="flowstate-log-line success">🎭 Demo mode: Using optimized responses</div>`;
      }
      return;
    }
    // =====================================================

    // Get computed styles we care about
    const cs = info.styles;
    const relevantStyles = {
      padding: cs.padding,
      margin: cs.margin,
      fontSize: cs.fontSize,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      border: cs.border,
      width: cs.width,
      height: cs.height,
      display: cs.display,
      textAlign: cs.textAlign
    };

    // Build context for the API
    const context = {
      element: info.tag,
      text: info.text,
      selector: info.selector,
      dimensions: { width: info.width, height: info.height },
      currentStyles: relevantStyles,
      html: el.outerHTML.substring(0, 500),
      parentTag: el.parentElement?.tagName?.toLowerCase() || 'body',
      designSystem: pageDesignSystem?.common || null
    };

    try {
      // Try to capture screenshot
      let screenshot = null;
      if (window.html2canvas) {
        try {
          const canvas = await html2canvas(el.parentElement || el, { backgroundColor: '#1a1a2e', scale: 2 });
          screenshot = canvas.toDataURL('image/png').split(',')[1];
        } catch (e) {
          console.log('Screenshot failed, using context only');
        }
      }

      const response = await fetch(`${API_BASE}/api/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot,
          context, // Send element context as fallback
          mimeType: 'image/png'
        })
      });

      const result = await response.json();

      if (result.success && result.data && result.data.visual_defects?.length > 0) {
        // Merge API defects with local, deduplicate
        const apiDefects = result.data.visual_defects || [];
        defects = mergeDefects(localDefects, apiDefects);
        analysisCache.set(cacheKey, defects);
        renderDefects(defects, result.data.asset_generation_prompt);
        generateVariations(el);

        // Log in panel
        const log = document.getElementById('flowstate-log');
        if (log) {
          log.innerHTML += `<div class="flowstate-log-line success">🤖 API enhanced with ${apiDefects.length} additional insight${apiDefects.length > 1 ? 's' : ''}</div>`;
        }
      }
    } catch (err) {
      // Local analysis is already shown, just log the error
      console.log('API enhancement failed:', err.message);
      const log = document.getElementById('flowstate-log');
      if (log) {
        log.innerHTML += `<div class="flowstate-log-line" style="color: #71717A;">⚡ Using local analysis only</div>`;
      }
    }
  }
  
  // =========================================================================
  // IMAGE REGENERATION (Nano Banana Pro)
  // =========================================================================

  function isImageElement(el) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    // Check for img tag
    if (tag === 'img') return true;
    // Check for elements with background-image
    const cs = window.getComputedStyle(el);
    const bgImage = cs.backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) return true;
    // Check for svg
    if (tag === 'svg') return true;
    // Check for picture/source
    if (tag === 'picture') return true;
    return false;
  }

  function getImageInfo(el) {
    const tag = el.tagName.toLowerCase();
    let src = '';
    let width = el.offsetWidth;
    let height = el.offsetHeight;
    let alt = '';

    if (tag === 'img') {
      src = el.src || el.dataset.src || '';
      alt = el.alt || '';
    } else if (tag === 'svg') {
      alt = el.getAttribute('aria-label') || 'SVG graphic';
    } else {
      // Background image
      const cs = window.getComputedStyle(el);
      const bgImage = cs.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) src = match[1];
      }
    }

    return { src, width, height, alt, tag };
  }

  function renderImagePanel(el) {
    const info = getImageInfo(el);
    const originalSrc = info.src;

    let html = `
      <div class="flowstate-image-panel">
        <div class="flowstate-section-label">Current Image</div>
        <div class="flowstate-image-preview">
          ${info.src ? `<img src="${escapeHtml(info.src)}" alt="Current" />` : '<div style="width: 80px; height: 60px; background: #27272A; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #71717A; font-size: 10px;">No src</div>'}
          <div class="flowstate-image-info">
            <div><strong>${info.tag.toUpperCase()}</strong></div>
            <div>${info.width}×${info.height}px</div>
            ${info.alt ? `<div style="color: #71717A; margin-top: 2px;">"${escapeHtml(info.alt)}"</div>` : ''}
          </div>
        </div>

        <div class="flowstate-section-label">Regenerate with AI</div>
        <textarea
          class="flowstate-image-prompt"
          id="flowstate-image-prompt"
          placeholder="Describe the new image you want...&#10;&#10;e.g., 'Modern hero image with gradient purple to blue, abstract tech shapes, dark theme'"
        ></textarea>

        <div class="flowstate-image-actions">
          <button class="flowstate-btn flowstate-btn-primary" id="flowstate-regenerate-btn" style="flex: 1;">
            🎨 Generate with Nano Banana
          </button>
        </div>

        <div id="flowstate-image-result"></div>

        <button class="flowstate-btn" id="flowstate-select-another" style="width: 100%; margin-top: 8px; background: #27272A; border: 1px solid #3F3F46;">
          ← Select Another Element
        </button>

        <div class="flowstate-log" id="flowstate-log">
          <div class="flowstate-log-line accent">🖼️ Image element selected</div>
          <div class="flowstate-log-line" style="color: #71717A;">Describe what you want and click Generate</div>
        </div>
      </div>
    `;

    panelBody.innerHTML = html;

    // Store original for comparison
    window.__flowstateOriginalImage = originalSrc;

    // Regenerate button click
    document.getElementById('flowstate-regenerate-btn')?.addEventListener('click', () => {
      regenerateImage(el);
    });

    // Select another element button - deselect and let user pick a new element
    document.getElementById('flowstate-select-another')?.addEventListener('click', () => {
      // Clear selection
      if (selectedElement) {
        selectedElement.classList.remove('flowstate-selected');
      }
      selectedElement = null;
      selectedElements = [];

      // Hide panel
      panel.classList.remove('visible');

      // Show a hint
      const hint = document.createElement('div');
      hint.id = 'flowstate-hint';
      hint.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #0A0A0B;
        border: 2px solid #D4FF00;
        color: #FAFAFA;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: 'Outfit', system-ui, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      `;
      hint.innerHTML = '👆 Click any element to analyze it';
      document.body.appendChild(hint);

      // Remove hint after 2 seconds
      setTimeout(() => hint.remove(), 2000);
    });
  }

  async function regenerateImage(el) {
    const promptInput = document.getElementById('flowstate-image-prompt');
    const resultDiv = document.getElementById('flowstate-image-result');
    const btn = document.getElementById('flowstate-regenerate-btn');
    const log = document.getElementById('flowstate-log');

    const prompt = promptInput?.value.trim();
    if (!prompt) {
      log.innerHTML += `<div class="flowstate-log-line error">Please enter a description</div>`;
      return;
    }

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '⏳ Generating...';
    log.innerHTML += `<div class="flowstate-log-line">🤖 Sending to Nano Banana Pro...</div>`;

    // =====================================================
    // DEMO MODE: Use cached image response
    // =====================================================
    if (demoMode) {
      // Simulate generation delay
      await new Promise(r => setTimeout(r, 1500));
      log.innerHTML += `<div class="flowstate-log-line success">🎭 Demo mode: Using cached image</div>`;

      // Use a URL to an impressive image from Unsplash
      const result = {
        success: true,
        url: 'https://images.unsplash.com/photo-1545486332-9e0999c535b2?w=1600&h=900&fit=crop',
        mimeType: 'image/jpeg'
      };

      processImageResult(el, result, resultDiv, log, btn);
      return;
    }
    // =====================================================

    try {
      // Determine context from element dimensions
      const info = getImageInfo(el);
      let context = 'general';
      if (info.width > info.height * 2) context = 'hero';
      else if (Math.abs(info.width - info.height) < 20) context = 'avatar';
      else if (info.width < 100 && info.height < 100) context = 'icon';

      const response = await fetch(`${API_BASE}/api/generate-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          context,
          theme: 'dark'
        })
      });

      const result = await response.json();
      processImageResult(el, result, resultDiv, log, btn, prompt);
    } catch (err) {
      log.innerHTML += `<div class="flowstate-log-line error">❌ ${err.message}</div>`;
      btn.disabled = false;
      btn.innerHTML = '🎨 Generate with Nano Banana';
    }
  }

  // Helper function to process image generation results (used by both live and demo modes)
  function processImageResult(el, result, resultDiv, log, btn, prompt) {
    if (result.success && (result.image || result.url)) {
      const newSrc = result.image
        ? `data:${result.mimeType || 'image/png'};base64,${result.image}`
        : result.url;

      // Show comparison
      resultDiv.innerHTML = `
        <div class="flowstate-image-result">
          <div class="flowstate-section-label">Result</div>
          <div class="flowstate-image-compare">
            <div class="flowstate-image-compare-item">
              ${window.__flowstateOriginalImage
                ? `<img src="${window.__flowstateOriginalImage}" alt="Original" />`
                : '<div style="height: 80px; background: #27272A; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #71717A;">Original</div>'
              }
              <div class="flowstate-image-compare-label">Before</div>
            </div>
            <div class="flowstate-image-compare-item">
              <img src="${newSrc}" alt="Generated" />
              <div class="flowstate-image-compare-label">After (AI)</div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="flowstate-btn flowstate-btn-primary" id="flowstate-apply-image" style="flex: 1;">
              ✅ Apply
            </button>
            <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-save-to-assets" title="Save to assets folder">
              📂
            </button>
            <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-download-image" title="Download">
              💾
            </button>
          </div>
        </div>
      `;

      // Store the new image data
      window.__flowstateNewImage = newSrc;

      log.innerHTML += `<div class="flowstate-log-line success">✨ Image generated!</div>`;

      // Apply button
      document.getElementById('flowstate-apply-image')?.addEventListener('click', () => {
        applyGeneratedImage(el, newSrc);
      });

      // Download button
      document.getElementById('flowstate-download-image')?.addEventListener('click', () => {
        downloadImage(newSrc, 'flowstate-generated.png');
      });

      // Save to Assets button
      document.getElementById('flowstate-save-to-assets')?.addEventListener('click', async () => {
        await saveToAssets(newSrc, prompt || 'demo-image');
      });

      // Show usage info if available
      if (result.usage) {
        log.innerHTML += `<div class="flowstate-log-line" style="color: #71717A;">💰 Cost: $${result.usage.cost} | Budget: $${result.usage.budgetRemaining}</div>`;
      }

    } else {
      log.innerHTML += `<div class="flowstate-log-line error">❌ ${result.error || 'Generation failed'}</div>`;
    }

    btn.disabled = false;
    btn.innerHTML = '🎨 Generate with Nano Banana';
  }

  function applyGeneratedImage(el, newSrc) {
    const tag = el.tagName.toLowerCase();

    // Store original for undo
    if (tag === 'img') {
      undoStack.push({
        element: el,
        property: 'src',
        oldValue: el.src
      });
      el.src = newSrc;
    } else {
      // Background image
      undoStack.push({
        element: el,
        property: 'backgroundImage',
        oldValue: el.style.backgroundImage
      });
      el.style.backgroundImage = `url(${newSrc})`;
    }

    const log = document.getElementById('flowstate-log');
    if (log) {
      log.innerHTML += `<div class="flowstate-log-line success">✅ Image applied!</div>`;
    }
  }

  function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function saveToAssets(dataUrl, prompt) {
    const log = document.getElementById('flowstate-log');
    const btn = document.getElementById('flowstate-save-to-assets');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳';
    }

    try {
      // Extract base64 data from data URL
      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid image data URL');
      }

      const mimeType = base64Match[1];
      const base64Data = base64Match[2];

      // Generate a filename based on prompt
      const sanitizedPrompt = prompt.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30).toLowerCase();
      const timestamp = Date.now();
      const filename = `${sanitizedPrompt}-${timestamp}.png`;

      const response = await fetch(`${API_BASE}/api/save-asset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mimeType,
          filename,
          prompt
        })
      });

      const result = await response.json();

      if (result.success) {
        if (log) {
          log.innerHTML += `<div class="flowstate-log-line success">📂 Saved to: ${result.filename}</div>`;
        }
        if (btn) {
          btn.innerHTML = '✅';
          setTimeout(() => { btn.innerHTML = '📂'; btn.disabled = false; }, 2000);
        }
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (err) {
      if (log) {
        log.innerHTML += `<div class="flowstate-log-line error">❌ Save failed: ${err.message}</div>`;
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📂';
      }
    }
  }

  function mergeDefects(local, api) {
    // Start with local defects
    const merged = [...local];
    const localIssues = new Set(local.map(d => d.issue?.toLowerCase().substring(0, 30)));
    
    // Add API defects that aren't duplicates
    api.forEach(apiDefect => {
      const issueKey = (typeof apiDefect === 'string' ? apiDefect : apiDefect.issue)?.toLowerCase().substring(0, 30);
      if (!localIssues.has(issueKey)) {
        merged.push(apiDefect);
      }
    });
    
    return merged;
  }
  
  function renderDefects(defects, assetPrompt, showApiLoading = false) {
    if (!defects || defects.length === 0) {
      panelBody.innerHTML = `
        <div class="flowstate-empty">
          <div class="flowstate-empty-icon">✨</div>
          <div>No issues found! Element looks good.</div>
        </div>
      `;
      return;
    }
    
    // Store which defects are selected
    const selectedDefects = new Set(defects.map((_, i) => i));
    
    let html = `<div class="flowstate-defects">`;
    
    defects.forEach((defect, i) => {
      const issue = typeof defect === 'string' ? defect : defect.issue;
      const expected = typeof defect === 'object' ? defect.expected : null;
      const why = typeof defect === 'object' ? defect.why : null;
      const hasAutoFix = typeof defect === 'object' && defect.autoFix;
      
      const knowledge = getKnowledgeForDefect(issue);

      html += `
        <div class="flowstate-defect" data-index="${i}">
          <div class="flowstate-defect-header">
            <div class="flowstate-checkbox checked" data-index="${i}"></div>
            <div class="flowstate-defect-issue">${escapeHtml(issue)}</div>
            <button class="flowstate-learn-btn" data-index="${i}" title="Learn why this matters">📚</button>
            ${hasAutoFix ? `<button class="flowstate-quick-fix" data-index="${i}" title="Quick fix">⚡</button>` : ''}
          </div>
          ${expected || why ? `
            <div class="flowstate-defect-meta">
              ${expected ? `<span class="expected">→ ${escapeHtml(expected)}</span>` : ''}
              ${why ? `<br><span class="why">${escapeHtml(why)}</span>` : ''}
            </div>
          ` : ''}
          <div class="flowstate-learn-panel" data-learn-index="${i}">
            <div class="flowstate-learn-title">${knowledge.title}</div>
            <div class="flowstate-learn-content">
              ${knowledge.explanation}
            </div>
            <div class="flowstate-learn-content" style="margin-top: 8px;">
              <strong>Why it matters:</strong> ${knowledge.why}
            </div>
            <div class="flowstate-learn-example">${knowledge.example}</div>
            <div class="flowstate-learn-tip">
              <strong>Pro tip:</strong> ${knowledge.tip}
            </div>
            <button class="flowstate-enter-edu" data-topic="${knowledge.title}" data-knowledge='${JSON.stringify(knowledge).replace(/'/g, "&#39;")}'>
              💬 Enter EDU Mode - Chat with AI
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    
    // Variation buttons - will be populated after styles are generated
    html += `
      <div class="flowstate-section-label">Design Variations</div>
      <div class="flowstate-variations" id="flowstate-variations">
        <button class="flowstate-var-btn active" data-var="-1">Original</button>
      </div>
    `;
    
    // Log
    html += `
      <div class="flowstate-log" id="flowstate-log">
        <div class="flowstate-log-line accent">⚡ Found ${defects.length} issue${defects.length > 1 ? 's' : ''} instantly</div>
        ${showApiLoading ? `<div class="flowstate-log-line" style="color: #71717A;">🤖 Enhancing with AI...</div>` : ''}
      </div>
    `;
    
    // Undo button if we have history
    if (undoStack.length > 0) {
      html += `
        <div style="margin-top: 8px;">
          <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-undo" style="width: 100%; font-size: 12px;">
            ↩ Undo Last (${undoStack.length})
          </button>
        </div>
      `;
    }
    
    panelBody.innerHTML = html;
    
    // Enable buttons
    applyBtn.disabled = false;
    copyBtn.disabled = false;
    variationsBtn.disabled = false;
    
    // Checkbox listeners
    panelBody.querySelectorAll('.flowstate-checkbox').forEach(cb => {
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(cb.dataset.index);
        if (selectedDefects.has(idx)) {
          selectedDefects.delete(idx);
          cb.classList.remove('checked');
        } else {
          selectedDefects.add(idx);
          cb.classList.add('checked');
        }
      });
    });
    
    // Quick fix listeners
    panelBody.querySelectorAll('.flowstate-quick-fix').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        const defect = defects[idx];
        if (defect.autoFix && selectedElement) {
          applyQuickFix(selectedElement, defect.autoFix);
          btn.textContent = '✓';
          btn.disabled = true;
        }
      });
    });

    // Learn button listeners
    panelBody.querySelectorAll('.flowstate-learn-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.dataset.index;
        const learnPanel = panelBody.querySelector(`.flowstate-learn-panel[data-learn-index="${idx}"]`);
        if (learnPanel) {
          // Close all other learn panels
          panelBody.querySelectorAll('.flowstate-learn-panel.visible').forEach(p => {
            if (p !== learnPanel) p.classList.remove('visible');
          });
          // Toggle this one
          learnPanel.classList.toggle('visible');
          btn.textContent = learnPanel.classList.contains('visible') ? '✕' : '📚';
        }
      });
    });

    // EDU Mode button listeners
    panelBody.querySelectorAll('.flowstate-enter-edu').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const topic = btn.dataset.topic;
        try {
          const knowledge = JSON.parse(btn.dataset.knowledge.replace(/&#39;/g, "'"));
          enterEduMode(topic, knowledge);
        } catch (err) {
          console.error('Error parsing knowledge data:', err);
          enterEduMode(topic, { title: topic });
        }
      });
    });

    // Undo listener
    const undoBtn = document.getElementById('flowstate-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', undoLastChange);
    }
    
    // Generate the healed variations
    generateHealedStyles(defects);
    
    // Now populate variation buttons
    const variationsContainer = document.getElementById('flowstate-variations');
    if (variationsContainer && variationStyles.length > 0) {
      variationStyles.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.className = 'flowstate-var-btn';
        btn.dataset.var = i;
        btn.innerHTML = `${v.icon} ${v.name}`;
        variationsContainer.appendChild(btn);
      });
      
      // Add click listeners to all variation buttons
      variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const varIndex = parseInt(btn.dataset.var);
          applyVariation(varIndex);
        });
      });
    }
  }
  
  // =========================================================================
  // QUICK FIX & UNDO
  // =========================================================================
  
  function applyQuickFix(el, styles) {
    // Save to undo stack
    const previousStyles = {};
    Object.keys(styles).forEach(prop => {
      previousStyles[prop] = el.style[prop];
    });
    undoStack.push({ element: el, styles: previousStyles });
    
    // Apply the fix
    Object.assign(el.style, styles);
    
    // Track for export
    allChanges.push({
      selector: generateSelector(el),
      styles: styles,
      timestamp: Date.now()
    });
    
    // Update log
    const log = document.getElementById('flowstate-log');
    if (log) {
      log.innerHTML += `<div class="flowstate-log-line success">⚡ Quick fix applied</div>`;
    }
  }
  
  function undoLastChange() {
    if (undoStack.length === 0) return;
    
    const last = undoStack.pop();
    Object.assign(last.element.style, last.styles);
    
    // Remove from allChanges
    allChanges.pop();
    
    // Update log
    const log = document.getElementById('flowstate-log');
    if (log) {
      log.innerHTML += `<div class="flowstate-log-line">↩ Undone</div>`;
    }
    
    // Re-render if needed
    if (selectedElement) {
      renderDefects(defects, null);
    }
  }
  
  function generateSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.className) {
      const classes = el.className.split(' ').filter(c => c && !c.startsWith('flowstate')).slice(0, 2);
      if (classes.length) return `${el.tagName.toLowerCase()}.${classes.join('.')}`;
    }
    return el.tagName.toLowerCase();
  }
  
  // =========================================================================
  // EXPORT ALL CHANGES AS CSS
  // =========================================================================
  
  function exportAllChanges() {
    if (allChanges.length === 0) {
      alert('No changes to export yet. Apply some fixes first!');
      return;
    }
    
    // Group changes by selector
    const grouped = {};
    allChanges.forEach(change => {
      if (!grouped[change.selector]) {
        grouped[change.selector] = {};
      }
      Object.assign(grouped[change.selector], change.styles);
    });
    
    // Generate CSS
    let css = `/* FlowState Export - ${new Date().toISOString().split('T')[0]} */\n\n`;
    
    Object.entries(grouped).forEach(([selector, styles]) => {
      css += `${selector} {\n`;
      Object.entries(styles).forEach(([prop, value]) => {
        // Convert camelCase to kebab-case
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        css += `  ${kebabProp}: ${value};\n`;
      });
      css += `}\n\n`;
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(css).then(() => {
      // Show success in export button
      const originalText = exportBtn.innerHTML;
      exportBtn.innerHTML = '✓';
      exportBtn.style.color = '#22C55E';
      setTimeout(() => {
        exportBtn.innerHTML = originalText;
        exportBtn.style.color = '';
      }, 1500);
      
      console.log('📋 Exported CSS:\n', css);
    }).catch(() => {
      // Fallback: show in alert
      alert('Copy this CSS:\n\n' + css);
    });
  }
  
  // =========================================================================
  // SYSTEM INSTRUCTIONS
  // =========================================================================
  
  function loadSystemInstructions() {
    try {
      return localStorage.getItem('flowstate-instructions') || '';
    } catch (e) {
      return '';
    }
  }
  
  function saveSystemInstructions(instructions) {
    try {
      localStorage.setItem('flowstate-instructions', instructions);
      systemInstructions = instructions;
    } catch (e) {
      console.log('Could not save instructions');
    }
  }
  
  // =========================================================================
  // FIND SIMILAR ELEMENTS
  // =========================================================================
  
  function findSimilarElements(el) {
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).filter(c => !c.startsWith('flowstate'));
    const similar = [];
    
    // Find by same tag and class
    if (classes.length > 0) {
      const selector = `${tag}.${classes[0]}`;
      document.querySelectorAll(selector).forEach(match => {
        if (match !== el && !match.closest('#flowstate-panel')) {
          similar.push(match);
        }
      });
    }
    
    // If no class matches, find by tag + similar role
    if (similar.length === 0) {
      const role = el.getAttribute('role') || (tag === 'button' ? 'button' : null);
      if (role) {
        document.querySelectorAll(`[role="${role}"], ${tag}`).forEach(match => {
          if (match !== el && !match.closest('#flowstate-panel') && similar.length < 10) {
            // Check if visually similar (same computed styles)
            const elCs = window.getComputedStyle(el);
            const matchCs = window.getComputedStyle(match);
            if (elCs.backgroundColor === matchCs.backgroundColor || 
                elCs.borderRadius === matchCs.borderRadius) {
              similar.push(match);
            }
          }
        });
      }
    }
    
    return similar;
  }
  
  function showPropagateOption(similar, pendingStyles) {
    if (similar.length === 0) return;
    
    const propagateDiv = document.getElementById('flowstate-propagate');
    const countSpan = document.getElementById('flowstate-propagate-count');
    const previewDiv = document.getElementById('flowstate-propagate-preview');
    
    if (!propagateDiv) return;
    
    countSpan.textContent = `${similar.length} similar element${similar.length > 1 ? 's' : ''} found`;
    
    // Show preview of similar elements
    previewDiv.innerHTML = similar.slice(0, 5).map(el => {
      const text = el.textContent?.trim().substring(0, 20) || el.tagName.toLowerCase();
      return `<span class="flowstate-propagate-item">${text}</span>`;
    }).join('');
    
    if (similar.length > 5) {
      previewDiv.innerHTML += `<span class="flowstate-propagate-item">+${similar.length - 5} more</span>`;
    }
    
    propagateDiv.style.display = 'block';
    
    // Store for later
    similarElements = similar;
    window.__flowstatePendingStyles = pendingStyles;
  }
  
  function propagateToSimilar(styles) {
    similarElements.forEach(el => {
      // Save to undo stack
      const previousStyles = {};
      Object.keys(styles).forEach(prop => {
        previousStyles[prop] = el.style[prop];
      });
      undoStack.push({ element: el, styles: previousStyles });
      
      // Apply
      Object.assign(el.style, styles);
      
      // Track
      allChanges.push({
        selector: generateSelector(el),
        styles: styles,
        timestamp: Date.now(),
        propagated: true
      });
    });
    
    // Log
    addToHistory(`Propagated changes to ${similarElements.length} elements`);
  }
  
  // =========================================================================
  // CHANGE HISTORY / TRACE
  // =========================================================================
  
  function addToHistory(action, details = {}) {
    const entry = {
      time: new Date(),
      action,
      element: selectedElement ? generateSelector(selectedElement) : null,
      details,
      undoIndex: undoStack.length - 1
    };
    changeHistory.push(entry);
    
    // Persist to sessionStorage
    try {
      sessionStorage.setItem('flowstate-history', JSON.stringify(changeHistory.slice(-50)));
    } catch (e) {}
  }
  
  function renderHistory() {
    const historyHtml = changeHistory.slice(-10).reverse().map((entry, i) => {
      const time = entry.time.toLocaleTimeString().split(':').slice(0, 2).join(':');
      return `
        <div class="flowstate-history-item">
          <span class="flowstate-history-time">${time}</span>
          <span class="flowstate-history-action">${entry.action}</span>
          ${entry.undoIndex >= 0 ? `<button class="flowstate-history-revert" data-index="${entry.undoIndex}">↩</button>` : ''}
        </div>
      `;
    }).join('');
    
    return `
      <div class="flowstate-section-label" style="margin-top: 16px;">📜 Recent Changes</div>
      <div class="flowstate-history">${historyHtml || '<div style="color: #52525B; font-size: 11px;">No changes yet</div>'}</div>
    `;
  }
  
  // =========================================================================
  // MANUAL EDIT MODE
  // =========================================================================
  
  function openManualEdit(el) {
    if (!el) return;
    
    manualEditMode = true;
    const modal = document.getElementById('flowstate-edit-modal');
    const backdrop = document.getElementById('flowstate-modal-backdrop');
    const editor = document.getElementById('flowstate-code-editor');
    const elementLabel = document.getElementById('flowstate-edit-element');
    const instructionsInput = document.getElementById('flowstate-instructions-input');
    
    // Set element label
    elementLabel.textContent = `<${el.tagName.toLowerCase()}>`;
    
    // Load system instructions
    instructionsInput.value = systemInstructions;
    
    // Get current styles as CSS
    const cs = window.getComputedStyle(el);
    const relevantProps = ['padding', 'margin', 'border-radius', 'background-color', 'color', 
                          'font-size', 'font-weight', 'width', 'height', 'border', 'box-shadow',
                          'text-align', 'display', 'gap', 'letter-spacing', 'text-transform'];
    
    let cssText = `/* Edit styles for ${el.tagName.toLowerCase()} */\n\n`;
    relevantProps.forEach(prop => {
      const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      const value = cs[camelProp];
      if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
        cssText += `${prop}: ${value};\n`;
      }
    });
    
    editor.value = cssText;
    
    // Find similar elements
    similarElements = findSimilarElements(el);
    const propagateDiv = document.getElementById('flowstate-propagate');
    if (propagateDiv) {
      propagateDiv.style.display = 'none';
    }
    
    // Show modal
    backdrop.style.display = 'block';
    modal.classList.add('visible');
    editor.focus();
    
    // Store original for comparison
    window.__flowstateOriginalCSS = cssText;
  }
  
  function closeManualEdit() {
    manualEditMode = false;
    const modal = document.getElementById('flowstate-edit-modal');
    const backdrop = document.getElementById('flowstate-modal-backdrop');
    
    modal.classList.remove('visible');
    backdrop.style.display = 'none';
  }
  
  function parseManualCSS(cssText) {
    const styles = {};
    const lines = cssText.split('\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (line.startsWith('/*') || line.startsWith('//') || !line.includes(':')) return;
      
      const [prop, ...valueParts] = line.replace(';', '').split(':');
      const value = valueParts.join(':').trim();
      
      if (prop && value) {
        // Convert kebab-case to camelCase
        const camelProp = prop.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        styles[camelProp] = value;
      }
    });
    
    return styles;
  }
  
  function applyManualEdit() {
    const editor = document.getElementById('flowstate-code-editor');
    const cssText = editor.value;
    const styles = parseManualCSS(cssText);
    
    if (!selectedElement || Object.keys(styles).length === 0) {
      closeManualEdit();
      return;
    }
    
    // Check what changed
    const originalStyles = parseManualCSS(window.__flowstateOriginalCSS || '');
    const changedStyles = {};
    
    Object.entries(styles).forEach(([prop, value]) => {
      if (originalStyles[prop] !== value) {
        changedStyles[prop] = value;
      }
    });
    
    if (Object.keys(changedStyles).length === 0) {
      closeManualEdit();
      return;
    }
    
    // Save to undo stack
    const previousStyles = {};
    Object.keys(changedStyles).forEach(prop => {
      previousStyles[prop] = selectedElement.style[prop];
    });
    undoStack.push({ element: selectedElement, styles: previousStyles });
    
    // Apply changes
    Object.assign(selectedElement.style, changedStyles);
    
    // Track
    allChanges.push({
      selector: generateSelector(selectedElement),
      styles: changedStyles,
      timestamp: Date.now(),
      manual: true
    });
    
    addToHistory('Manual edit', { properties: Object.keys(changedStyles) });
    
    // Check if we should propagate
    if (similarElements.length > 0) {
      showPropagateOption(similarElements, changedStyles);
    } else {
      closeManualEdit();
    }
  }
  
  function handleLivePreview() {
    const editor = document.getElementById('flowstate-code-editor');
    const toggle = document.getElementById('flowstate-live-toggle');
    
    if (!toggle.classList.contains('on') || !selectedElement) return;
    
    const styles = parseManualCSS(editor.value);
    
    // Store original if not already
    if (!originalStyles.has(selectedElement)) {
      const original = {};
      Object.keys(styles).forEach(prop => {
        original[prop] = selectedElement.style[prop];
      });
      originalStyles.set(selectedElement, original);
    }
    
    // Apply live preview
    Object.assign(selectedElement.style, styles);
  }
  
  function generateHealedStyles(defects) {
    if (!selectedElement) return;
    
    // Store original styles
    const original = {};
    const cs = window.getComputedStyle(selectedElement);
    ['padding', 'margin', 'borderRadius', 'width', 'backgroundColor', 'color', 'fontSize', 'border', 'boxShadow', 'fontWeight', 'textTransform', 'letterSpacing'].forEach(prop => {
      original[prop] = selectedElement.style[prop] || '';
    });
    originalStyles.set(selectedElement, { ...original });
    
    // Get current computed values for reference
    const currentPadding = cs.padding;
    const currentRadius = parseInt(cs.borderRadius) || 0;
    const currentBg = cs.backgroundColor;
    const currentColor = cs.color;
    const currentFontSize = parseInt(cs.fontSize) || 14;
    
    // =========================================================================
    // VARIATION 1: "Healed" — Fix the issues, keep the spirit
    // =========================================================================
    const healed = {};

    // Apply defect-specific fixes
    defects.forEach(defect => {
      const issue = (typeof defect === 'string' ? defect : defect.issue).toLowerCase();
      const expected = typeof defect === 'object' ? defect.expected : null;

      if (issue.includes('padding')) {
        healed.padding = '12px 16px';
      }
      if (issue.includes('border-radius') || issue.includes('radius')) {
        healed.borderRadius = '8px';
      }
      if (issue.includes('width') || issue.includes('full')) {
        healed.width = '100%';
      }
      if (issue.includes('contrast') || issue.includes('color')) {
        healed.color = '#FFFFFF';
      }
    });

    // If no defects matched, provide sensible defaults based on element type
    if (Object.keys(healed).length === 0) {
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'button' || tagName === 'a' || el.getAttribute('role') === 'button') {
        // Button defaults
        const parsedPadding = currentPadding.split(' ').map(v => parseInt(v) || 0);
        if (parsedPadding.some(v => v < 10)) {
          healed.padding = '12px 16px';
        }
        if (currentRadius < 6) {
          healed.borderRadius = '8px';
        }
      } else if (tagName === 'input' || tagName === 'textarea') {
        // Input defaults
        healed.padding = '12px 16px';
        healed.borderRadius = '8px';
      }

      // If still empty, apply subtle polish
      if (Object.keys(healed).length === 0) {
        healed.transition = 'all 0.2s ease';
      }
    }
    
    // =========================================================================
    // VARIATION 2: "Minimal" — Clean, modern, understated
    // =========================================================================
    const minimal = {
      padding: '10px 20px',
      borderRadius: '6px',
      backgroundColor: 'transparent',
      color: currentColor,
      border: '1px solid currentColor',
      boxShadow: 'none',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: '0'
    };
    
    // =========================================================================
    // VARIATION 3: "Bold" — Expressive, attention-grabbing
    // =========================================================================
    const bold = {
      padding: '14px 28px',
      borderRadius: '12px',
      backgroundColor: '#D4FF00',
      color: '#0A0A0B',
      border: 'none',
      boxShadow: '0 4px 14px rgba(212, 255, 0, 0.3)',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      fontSize: (currentFontSize + 1) + 'px'
    };
    
    // =========================================================================
    // VARIATION 4: "Soft" — Rounded, friendly, approachable
    // =========================================================================
    const soft = {
      padding: '12px 24px',
      borderRadius: '100px',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: '0.25px'
    };
    
    variationStyles = [
      { name: 'Healed', styles: healed, icon: '✨' },
      { name: 'Minimal', styles: minimal, icon: '◯' },
      { name: 'Bold', styles: bold, icon: '■' },
      { name: 'Soft', styles: soft, icon: '●' }
    ];
    
    log('✨ 4 variations ready', 'success');
  }
  
  function applyVariation(index) {
    if (!selectedElement) return;
    
    const original = originalStyles.get(selectedElement);
    if (!original) return;
    
    if (index === -1) {
      // Restore original
      Object.keys(original).forEach(prop => {
        selectedElement.style[prop] = original[prop];
      });
      currentVariation = -1;
      log('↩ Restored original', '');
    } else if (variationStyles[index]) {
      // Apply variation (now an object with .styles)
      const variation = variationStyles[index];
      Object.assign(selectedElement.style, variation.styles);
      currentVariation = index;
      log(`${variation.icon} Applied "${variation.name}"`, 'success');
    }
  }
  
  function applyFix() {
    if (!selectedElement) return;
    
    // If still on original, apply the first variation (Healed)
    if (currentVariation === -1 && variationStyles.length > 0) {
      applyVariation(0);
      // Update UI to show Healed is active
      const variationsContainer = document.getElementById('flowstate-variations');
      if (variationsContainer) {
        variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(b => b.classList.remove('active'));
        variationsContainer.querySelector('[data-var="0"]')?.classList.add('active');
      }
    }
    
    // Clear the originalStyles so the change persists
    originalStyles.delete(selectedElement);
    
    const appliedName = currentVariation >= 0 && variationStyles[currentVariation] 
      ? variationStyles[currentVariation].name 
      : 'Healed';
    
    log(`✅ "${appliedName}" applied permanently!`, 'success');
    
    // Deselect
    selectedElement.classList.remove('flowstate-selected');
    selectedElement = null;
    selectedTag.textContent = 'Select an element';
    
    // Reset panel
    setTimeout(() => {
      panelBody.innerHTML = `
        <div class="flowstate-empty">
          <div class="flowstate-empty-icon">✨</div>
          <div>Fix applied! Click another element.</div>
        </div>
      `;
      applyBtn.disabled = true;
      copyBtn.disabled = true;
      variationsBtn.disabled = true;
    }, 1000);
  }
  
  async function generateAIVariations() {
    if (!selectedElement) return;
    
    log('🎨 Generating AI variations...', 'accent');
    variationsBtn.disabled = true;
    variationsBtn.textContent = '⏳ Generating...';
    
    // In a full implementation, this would call the API for AI-generated variations
    // For now, we'll add some additional preset variations
    
    const cs = window.getComputedStyle(selectedElement);
    const currentBg = cs.backgroundColor;
    
    // Add more variations
    const glassmorphism = {
      name: 'Glass',
      icon: '◇',
      styles: {
        padding: '12px 24px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        color: '#FFFFFF',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        fontWeight: '500'
      }
    };
    
    const neon = {
      name: 'Neon',
      icon: '⚡',
      styles: {
        padding: '12px 24px',
        borderRadius: '8px',
        backgroundColor: 'transparent',
        color: '#D4FF00',
        border: '2px solid #D4FF00',
        boxShadow: '0 0 10px rgba(212, 255, 0, 0.3), inset 0 0 10px rgba(212, 255, 0, 0.1)',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }
    };
    
    // Add new variations
    variationStyles.push(glassmorphism, neon);
    
    // Re-render variation buttons
    const variationsContainer = document.getElementById('flowstate-variations');
    if (variationsContainer) {
      // Add new buttons
      [glassmorphism, neon].forEach((v, i) => {
        const btn = document.createElement('button');
        btn.className = 'flowstate-var-btn';
        btn.dataset.var = variationStyles.length - 2 + i;
        btn.innerHTML = `${v.icon} ${v.name}`;
        btn.addEventListener('click', () => {
          variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyVariation(parseInt(btn.dataset.var));
        });
        variationsContainer.appendChild(btn);
      });
    }
    
    log('✨ 2 new variations added!', 'success');
    variationsBtn.disabled = false;
    variationsBtn.textContent = '🎨 More';
  }
  
  // =========================================================================
  // CSS TO TAILWIND MAPPING
  // =========================================================================

  const tailwindMap = {
    // Padding
    'padding': {
      '0px': 'p-0',
      '4px': 'p-1',
      '8px': 'p-2',
      '12px': 'p-3',
      '16px': 'p-4',
      '20px': 'p-5',
      '24px': 'p-6',
      '32px': 'p-8',
      '40px': 'p-10',
      '48px': 'p-12',
      '8px 16px': 'px-4 py-2',
      '12px 24px': 'px-6 py-3',
      '16px 32px': 'px-8 py-4',
    },
    // Border radius
    'border-radius': {
      '0px': 'rounded-none',
      '2px': 'rounded-sm',
      '4px': 'rounded',
      '6px': 'rounded-md',
      '8px': 'rounded-lg',
      '12px': 'rounded-xl',
      '16px': 'rounded-2xl',
      '24px': 'rounded-3xl',
      '9999px': 'rounded-full',
    },
    // Background colors
    'background-color': {
      '#000000': 'bg-black',
      'rgb(0, 0, 0)': 'bg-black',
      '#ffffff': 'bg-white',
      'rgb(255, 255, 255)': 'bg-white',
      '#D4FF00': 'bg-lime-400',
      'rgb(212, 255, 0)': 'bg-lime-400',
      '#0A0A0B': 'bg-zinc-950',
      'rgb(10, 10, 11)': 'bg-zinc-950',
      '#18181B': 'bg-zinc-900',
      'rgb(24, 24, 27)': 'bg-zinc-900',
      'transparent': 'bg-transparent',
      'rgba(0, 0, 0, 0)': 'bg-transparent',
    },
    // Text colors
    'color': {
      '#000000': 'text-black',
      'rgb(0, 0, 0)': 'text-black',
      '#ffffff': 'text-white',
      'rgb(255, 255, 255)': 'text-white',
      '#FAFAFA': 'text-zinc-50',
      'rgb(250, 250, 250)': 'text-zinc-50',
      '#D4FF00': 'text-lime-400',
      'rgb(212, 255, 0)': 'text-lime-400',
      '#A1A1AA': 'text-zinc-400',
      'rgb(161, 161, 170)': 'text-zinc-400',
    },
    // Font size
    'font-size': {
      '12px': 'text-xs',
      '14px': 'text-sm',
      '16px': 'text-base',
      '18px': 'text-lg',
      '20px': 'text-xl',
      '24px': 'text-2xl',
      '30px': 'text-3xl',
      '36px': 'text-4xl',
      '48px': 'text-5xl',
    },
    // Font weight
    'font-weight': {
      '100': 'font-thin',
      '200': 'font-extralight',
      '300': 'font-light',
      '400': 'font-normal',
      '500': 'font-medium',
      '600': 'font-semibold',
      '700': 'font-bold',
      '800': 'font-extrabold',
      '900': 'font-black',
    },
    // Box shadow (common patterns)
    'box-shadow': {
      'none': 'shadow-none',
      '0 1px 2px 0 rgb(0 0 0 / 0.05)': 'shadow-sm',
      '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)': 'shadow',
      '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)': 'shadow-md',
      '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)': 'shadow-lg',
      '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)': 'shadow-xl',
      '0 25px 50px -12px rgb(0 0 0 / 0.25)': 'shadow-2xl',
    },
  };

  function cssToTailwind(property, value) {
    // Normalize property name
    const normalizedProp = property.replace(/([A-Z])/g, '-$1').toLowerCase();
    const normalizedValue = value.trim().toLowerCase();

    // Direct lookup
    if (tailwindMap[normalizedProp]?.[value]) {
      return tailwindMap[normalizedProp][value];
    }
    if (tailwindMap[normalizedProp]?.[normalizedValue]) {
      return tailwindMap[normalizedProp][normalizedValue];
    }

    // Try to find closest match for numeric values
    if (normalizedProp === 'padding' || normalizedProp === 'margin') {
      const numMatch = value.match(/^(\d+)px$/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        const prefix = normalizedProp === 'padding' ? 'p' : 'm';
        const sizes = { 0: 0, 4: 1, 8: 2, 12: 3, 16: 4, 20: 5, 24: 6, 32: 8, 40: 10, 48: 12 };
        const closest = Object.keys(sizes).reduce((a, b) =>
          Math.abs(b - num) < Math.abs(a - num) ? b : a
        );
        return `${prefix}-${sizes[closest]}`;
      }
    }

    return null;
  }

  function copyCss() {
    if (!selectedElement) return;

    // Get the current variation's styles, or original computed styles
    let stylesToCopy = {};

    if (currentVariation >= 0 && variationStyles[currentVariation]) {
      stylesToCopy = variationStyles[currentVariation].styles;
    } else {
      // Copy current computed styles
      const cs = window.getComputedStyle(selectedElement);
      ['padding', 'margin', 'borderRadius', 'backgroundColor', 'color', 'fontSize', 'border', 'boxShadow', 'fontWeight'].forEach(prop => {
        stylesToCopy[prop] = cs[prop];
      });
    }

    // Build CSS output
    const cssLines = [];
    const tailwindClasses = [];

    Object.entries(stylesToCopy)
      .filter(([_, val]) => val)
      .forEach(([prop, val]) => {
        const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        cssLines.push(`${cssProp}: ${val};`);

        const twClass = cssToTailwind(prop, val);
        if (twClass) {
          tailwindClasses.push(twClass);
        }
      });

    // Build combined output
    let output = '/* CSS */\n' + cssLines.join('\n');

    if (tailwindClasses.length > 0) {
      output += '\n\n/* Tailwind */\n' + tailwindClasses.join(' ');
    }

    navigator.clipboard.writeText(output).then(() => {
      log('📋 CSS + Tailwind copied!', 'success');
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
    });
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
  
  // =========================================================================
  // ANNOTATION SYSTEM
  // =========================================================================
  
  function initCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  
  function enterAnnotationMode() {
    annotationMode = true;
    canvas.classList.add('active');
    toolbar.classList.add('visible');
    panel.classList.remove('visible');
    initCanvas();
    setTool('draw');
    
    // Add canvas event listeners
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    
    console.log('🖊️ Annotation mode active');
  }
  
  function exitAnnotationMode() {
    annotationMode = false;
    canvas.classList.remove('active');
    toolbar.classList.remove('visible');
    voiceTranscript.classList.remove('visible');
    
    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }
    
    canvas.removeEventListener('mousedown', handleCanvasMouseDown);
    canvas.removeEventListener('mousemove', handleCanvasMouseMove);
    canvas.removeEventListener('mouseup', handleCanvasMouseUp);
  }
  
  function setTool(tool) {
    if (tool === 'clear') {
      clearAnnotations();
      return;
    }

    if (tool === 'undo') {
      undoLastAnnotation();
      return;
    }

    if (tool === 'voice') {
      toggleRecording();
      return;
    }

    currentTool = tool;
    toolbar.querySelectorAll('.flowstate-tool:not(.flowstate-voice-btn)').forEach(t => {
      t.classList.toggle('active', t.dataset.tool === tool);
    });

    // Update cursor
    const cursors = {
      select: 'default',
      draw: 'crosshair',
      eraser: 'crosshair',
      box: 'crosshair',
      arrow: 'crosshair',
      text: 'text'
    };
    canvas.style.cursor = cursors[tool] || 'crosshair';

    // For select tool, allow clicks to pass through to page elements
    if (tool === 'select') {
      canvas.style.pointerEvents = 'none';
    } else {
      canvas.style.pointerEvents = 'auto';
    }
  }

  function undoLastAnnotation() {
    if (annotations.length > 0) {
      annotations.pop();
      redrawCanvas();
      updateHealAllButton();
      console.log('↩️ Undo: removed last annotation');
    }
  }

  function findNearestAnnotation(x, y, threshold) {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];

      if (ann.type === 'draw' && ann.points) {
        // Check if any point in the drawing is close
        for (const pt of ann.points) {
          const dist = Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2);
          if (dist < threshold) return i;
        }
      } else if (ann.type === 'box') {
        // Check if click is inside or near the box
        const minX = Math.min(ann.startX, ann.endX || ann.startX);
        const maxX = Math.max(ann.startX, ann.endX || ann.startX);
        const minY = Math.min(ann.startY, ann.endY || ann.startY);
        const maxY = Math.max(ann.startY, ann.endY || ann.startY);
        if (x >= minX - threshold && x <= maxX + threshold &&
            y >= minY - threshold && y <= maxY + threshold) {
          return i;
        }
      } else if (ann.type === 'arrow') {
        // Check distance to the line
        const dist = distToLine(x, y, ann.startX, ann.startY, ann.endX || ann.startX, ann.endY || ann.startY);
        if (dist < threshold) return i;
      } else if (ann.type === 'text') {
        // Check if near the text position
        const dist = Math.sqrt((ann.x - x) ** 2 + (ann.y - y) ** 2);
        if (dist < threshold + 30) return i; // Larger threshold for text
      }
    }
    return -1;
  }

  function distToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function handleCanvasMouseDown(e) {
    if (currentTool === 'select') return;

    // Eraser mode - find and remove nearest annotation
    if (currentTool === 'eraser') {
      const x = e.clientX;
      const y = e.clientY;
      const erasedIndex = findNearestAnnotation(x, y, 20);
      if (erasedIndex >= 0) {
        annotations.splice(erasedIndex, 1);
        redrawCanvas();
        updateHealAllButton();
        console.log('🧹 Erased annotation');
      }
      return;
    }
    
    const x = e.clientX;
    const y = e.clientY;

    if (currentTool === 'text') {
      e.preventDefault();
      createTextInput(x, y);
      return;
    }

    isDrawing = true;
    
    currentAnnotation = {
      type: currentTool,
      points: [{ x, y }],
      startX: x,
      startY: y,
      color: '#D4FF00',
      lineWidth: currentTool === 'draw' ? 3 : 2
    };
  }
  
  function handleCanvasMouseMove(e) {
    if (!isDrawing || !currentAnnotation) return;
    
    const x = e.clientX;
    const y = e.clientY;
    
    if (currentTool === 'draw') {
      currentAnnotation.points.push({ x, y });
    } else {
      currentAnnotation.endX = x;
      currentAnnotation.endY = y;
    }
    
    redrawCanvas();
    drawCurrentAnnotation();
  }
  
  function handleCanvasMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentAnnotation) {
      if (currentTool === 'draw' && currentAnnotation.points.length > 2) {
        annotations.push(currentAnnotation);
      } else if (currentTool === 'box' || currentTool === 'arrow') {
        annotations.push(currentAnnotation);
      }
      currentAnnotation = null;
      redrawCanvas();
      updateHealAllButton();
    }
  }
  
  function createTextInput(x, y) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'flowstate-text-input';
    input.style.left = x + 'px';
    input.style.top = y + 'px';
    input.placeholder = 'Add note...';
    document.body.appendChild(input);
    // Use setTimeout to ensure the input is fully in the DOM before focusing
    setTimeout(() => input.focus(), 0);
    
    const handleBlur = () => {
      const text = input.value.trim();
      if (text) {
        annotations.push({
          type: 'text',
          x: x,
          y: y,
          text: text,
          color: '#D4FF00'
        });
        redrawCanvas();
        updateHealAllButton();
      }
      input.remove();
    };
    
    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        input.remove();
      }
    });
    
    isDrawing = false;
  }
  
  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    annotations.forEach(ann => {
      drawAnnotation(ann);
    });
  }
  
  function drawAnnotation(ann) {
    ctx.strokeStyle = ann.color || '#D4FF00';
    ctx.fillStyle = ann.color || '#D4FF00';
    ctx.lineWidth = ann.lineWidth || 2;
    
    switch (ann.type) {
      case 'draw':
        if (ann.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        ann.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
        
      case 'box':
        const width = ann.endX - ann.startX;
        const height = ann.endY - ann.startY;
        ctx.strokeStyle = ann.color || '#D4FF00';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(ann.startX, ann.startY, width, height);
        ctx.setLineDash([]);
        break;
        
      case 'arrow':
        drawArrow(ctx, ann.startX, ann.startY, ann.endX, ann.endY, ann.color || '#D4FF00');
        break;
        
      case 'text':
        // Draw background pill
        ctx.font = '600 14px Outfit, system-ui, sans-serif';
        const metrics = ctx.measureText(ann.text);
        const padding = 8;
        const bgHeight = 24;
        
        ctx.fillStyle = 'rgba(212, 255, 0, 0.9)';
        ctx.beginPath();
        ctx.roundRect(ann.x - padding, ann.y - bgHeight/2 - 2, metrics.width + padding * 2, bgHeight, 4);
        ctx.fill();
        
        ctx.fillStyle = '#0A0A0B';
        ctx.fillText(ann.text, ann.x, ann.y + 4);
        break;
        
      case 'voice':
        // Draw voice annotation with microphone icon
        ctx.font = '600 14px Outfit, system-ui, sans-serif';
        const voiceText = `🎙️ "${ann.text}"`;
        const voiceMetrics = ctx.measureText(voiceText);
        const voicePadding = 12;
        const voiceBgHeight = 32;
        
        // Center at top of screen
        const voiceX = (window.innerWidth - voiceMetrics.width) / 2 - voicePadding;
        
        // Background
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.beginPath();
        ctx.roundRect(voiceX, ann.y - voiceBgHeight/2, voiceMetrics.width + voicePadding * 2, voiceBgHeight, 8);
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(voiceText, voiceX + voicePadding, ann.y + 5);
        break;
    }
  }
  
  function drawCurrentAnnotation() {
    if (!currentAnnotation) return;
    drawAnnotation(currentAnnotation);
  }
  
  function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const headLength = 12;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    
    // Line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
  
  function clearAnnotations() {
    annotations = [];
    voiceInstructions = [];
    redrawCanvas();
    updateHealAllButton();
  }
  
  function updateHealAllButton() {
    healAllBtn.disabled = annotations.length === 0 && voiceInstructions.length === 0;
  }
  
  async function healAllAnnotations() {
    if (annotations.length === 0) return;
    
    healAllBtn.disabled = true;
    healAllBtn.innerHTML = '⏳ Analyzing...';
    
    try {
      // Capture screenshot with annotations
      const screenshotCanvas = await html2canvas(document.body, {
        backgroundColor: null,
        scale: 1,
        logging: false,
        ignoreElements: (el) => {
          return el.id === 'flowstate-fab' || 
                 el.id === 'flowstate-panel' || 
                 el.id === 'flowstate-canvas' ||
                 el.classList?.contains('flowstate-toolbar') ||
                 el.classList?.contains('flowstate-tooltip');
        }
      });
      
      // Draw annotations onto screenshot
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = screenshotCanvas.width;
      finalCanvas.height = screenshotCanvas.height;
      const finalCtx = finalCanvas.getContext('2d');
      
      // Draw page screenshot
      finalCtx.drawImage(screenshotCanvas, 0, 0);
      
      // Draw annotations scaled
      const scaleX = screenshotCanvas.width / window.innerWidth;
      const scaleY = screenshotCanvas.height / window.innerHeight;
      
      annotations.forEach(ann => {
        finalCtx.strokeStyle = ann.color;
        finalCtx.fillStyle = ann.color;
        finalCtx.lineWidth = (ann.lineWidth || 2) * scaleX;
        
        switch (ann.type) {
          case 'draw':
            if (ann.points.length < 2) return;
            finalCtx.beginPath();
            finalCtx.moveTo(ann.points[0].x * scaleX, ann.points[0].y * scaleY);
            ann.points.forEach(p => finalCtx.lineTo(p.x * scaleX, p.y * scaleY));
            finalCtx.stroke();
            break;
            
          case 'box':
            const width = (ann.endX - ann.startX) * scaleX;
            const height = (ann.endY - ann.startY) * scaleY;
            finalCtx.setLineDash([5 * scaleX, 5 * scaleX]);
            finalCtx.strokeRect(ann.startX * scaleX, ann.startY * scaleY, width, height);
            finalCtx.setLineDash([]);
            break;
            
          case 'arrow':
            drawArrow(finalCtx, ann.startX * scaleX, ann.startY * scaleY, ann.endX * scaleX, ann.endY * scaleY, ann.color);
            break;
            
          case 'text':
            finalCtx.font = `600 ${14 * scaleX}px Outfit, system-ui, sans-serif`;
            const metrics = finalCtx.measureText(ann.text);
            const padding = 8 * scaleX;
            const bgHeight = 24 * scaleY;
            
            finalCtx.fillStyle = 'rgba(212, 255, 0, 0.9)';
            finalCtx.beginPath();
            finalCtx.roundRect(ann.x * scaleX - padding, ann.y * scaleY - bgHeight/2 - 2, metrics.width + padding * 2, bgHeight, 4 * scaleX);
            finalCtx.fill();
            
            finalCtx.fillStyle = '#0A0A0B';
            finalCtx.fillText(ann.text, ann.x * scaleX, ann.y * scaleY + 4 * scaleY);
            break;
        }
      });
      
      // Get base64
      const screenshot = finalCanvas.toDataURL('image/png').split(',')[1];
      
      // Build annotation descriptions for context
      const annotationDescriptions = annotations.map(ann => {
        if (ann.type === 'text') return `Text label: "${ann.text}" at position (${ann.x}, ${ann.y})`;
        if (ann.type === 'box') return `Box selection from (${ann.startX}, ${ann.startY}) to (${ann.endX}, ${ann.endY})`;
        if (ann.type === 'arrow') return `Arrow pointing from (${ann.startX}, ${ann.startY}) to (${ann.endX}, ${ann.endY})`;
        if (ann.type === 'draw') return `Freehand circle/highlight around area near (${ann.points[0]?.x}, ${ann.points[0]?.y})`;
        if (ann.type === 'voice') return `VOICE INSTRUCTION: "${ann.text}"`;
        return '';
      }).filter(Boolean);
      
      // Add any standalone voice instructions
      voiceInstructions.forEach(vi => {
        if (!annotationDescriptions.some(d => d.includes(vi))) {
          annotationDescriptions.push(`VOICE INSTRUCTION: "${vi}"`);
        }
      });
      
      // Call API with annotated screenshot
      const response = await fetch(`${API_BASE}/api/inspect-annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot,
          annotations: annotationDescriptions,
          voiceInstructions: voiceInstructions,
          mimeType: 'image/png'
        })
      });
      
      const result = await response.json();
      
      // Exit annotation mode and show results
      exitAnnotationMode();
      panel.classList.add('visible');
      
      if (result.success && result.data) {
        defects = result.data.visual_defects || [];
        renderAnnotationResults(defects);
      } else {
        panelBody.innerHTML = `
          <div class="flowstate-empty">
            <div class="flowstate-empty-icon">⚠️</div>
            <div>Analysis failed. Try the element-click mode.</div>
          </div>
        `;
      }
      
    } catch (err) {
      console.error('Heal all error:', err);
      panelBody.innerHTML = `
        <div class="flowstate-empty">
          <div class="flowstate-empty-icon">⚠️</div>
          <div>Error: ${err.message}</div>
        </div>
      `;
    }
    
    healAllBtn.disabled = false;
    healAllBtn.innerHTML = '✨ Heal All';
  }
  
  function renderAnnotationResults(defects) {
    if (!defects || defects.length === 0) {
      panelBody.innerHTML = `
        <div class="flowstate-empty">
          <div class="flowstate-empty-icon">✨</div>
          <div>No issues found in annotated areas!</div>
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="flowstate-section-label">Issues Found in Annotations</div>
      <div class="flowstate-defects">
    `;
    
    defects.forEach((defect, i) => {
      const issue = typeof defect === 'string' ? defect : defect.issue;
      const expected = typeof defect === 'object' ? defect.expected : null;
      const element = typeof defect === 'object' ? defect.element : 'element';
      
      html += `
        <div class="flowstate-defect">
          <div class="flowstate-defect-header">
            <div class="flowstate-checkbox checked"></div>
            <div class="flowstate-defect-issue">${escapeHtml(issue)}</div>
          </div>
          ${expected ? `
            <div class="flowstate-defect-meta">
              <span class="expected">→ ${escapeHtml(expected)}</span>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += `</div>
      <div class="flowstate-log" id="flowstate-log">
        <div class="flowstate-log-line accent">🖊️ Analyzed ${annotations.length} annotations</div>
        ${voiceInstructions.length > 0 ? `<div class="flowstate-log-line accent">🎙️ Voice: "${voiceInstructions.join('; ')}"</div>` : ''}
        <div class="flowstate-log-line success">✨ Found ${defects.length} issue${defects.length > 1 ? 's' : ''}</div>
      </div>
    `;
    
    panelBody.innerHTML = html;
    
    // Clear annotations and voice after showing results
    clearAnnotations();
    voiceInstructions = [];
  }
  
  // =========================================================================
  // VOICE RECOGNITION
  // =========================================================================
  
  function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported');
      return false;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update display
      const textEl = voiceTranscript.querySelector('.flowstate-voice-text');
      if (textEl) {
        if (finalTranscript) {
          voiceTranscriptText = finalTranscript;
          textEl.textContent = finalTranscript;
          textEl.classList.remove('interim');
        } else if (interimTranscript) {
          textEl.textContent = interimTranscript;
          textEl.classList.add('interim');
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event.error);
      stopRecording();
    };
    
    recognition.onend = () => {
      if (isRecording) {
        // Restart if we're still supposed to be recording
        try {
          recognition.start();
        } catch (e) {
          stopRecording();
        }
      }
    };
    
    return true;
  }
  
  function startRecording() {
    if (!recognition && !initVoiceRecognition()) {
      alert('Voice recognition not supported in this browser. Try Chrome.');
      return;
    }
    
    isRecording = true;
    voiceTranscriptText = '';
    
    // Update UI
    voiceBtn.classList.add('recording');
    voiceTranscript.classList.add('visible', 'recording');
    voiceTranscript.innerHTML = `
      <div class="flowstate-voice-header recording">
        <span class="dot"></span>
        Listening...
      </div>
      <div class="flowstate-voice-text interim">Say what you want to change...</div>
    `;
    
    try {
      recognition.start();
    } catch (e) {
      console.log('Recognition start error:', e);
    }
    
    console.log('🎙️ Recording started');
  }
  
  function stopRecording() {
    isRecording = false;
    
    // Update UI
    voiceBtn.classList.remove('recording');
    voiceTranscript.classList.remove('recording');
    
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }
    
    // If we have a transcript, show confirmation UI
    if (voiceTranscriptText.trim()) {
      voiceTranscript.innerHTML = `
        <div class="flowstate-voice-header">
          <span class="dot" style="background: #D4FF00;"></span>
          Voice Instruction
        </div>
        <div class="flowstate-voice-text">"${escapeHtml(voiceTranscriptText.trim())}"</div>
        <div class="flowstate-voice-actions">
          <button class="flowstate-voice-action primary" id="voice-confirm">✓ Add</button>
          <button class="flowstate-voice-action secondary" id="voice-retry">🎙️ Retry</button>
          <button class="flowstate-voice-action secondary" id="voice-cancel">✕</button>
        </div>
      `;
      
      // Add listeners
      document.getElementById('voice-confirm')?.addEventListener('click', confirmVoice);
      document.getElementById('voice-retry')?.addEventListener('click', () => {
        voiceTranscript.classList.remove('visible');
        setTimeout(startRecording, 100);
      });
      document.getElementById('voice-cancel')?.addEventListener('click', () => {
        voiceTranscriptText = '';
        voiceTranscript.classList.remove('visible');
      });
    } else {
      voiceTranscript.classList.remove('visible');
    }
    
    console.log('🎙️ Recording stopped');
  }
  
  function confirmVoice() {
    if (voiceTranscriptText.trim()) {
      voiceInstructions.push(voiceTranscriptText.trim());
      
      // Add as a visual annotation too (text label at center of screen)
      annotations.push({
        type: 'voice',
        text: voiceTranscriptText.trim(),
        x: window.innerWidth / 2,
        y: 60
      });
      
      redrawCanvas();
      updateHealAllButton();
      
      console.log('🎙️ Voice instruction added:', voiceTranscriptText);
    }
    
    voiceTranscriptText = '';
    voiceTranscript.classList.remove('visible');
  }
  
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
  
  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  
  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isActive) {
      deactivate();
    } else {
      activate();
    }
  });
  
  applyBtn.addEventListener('click', applyFix);
  copyBtn.addEventListener('click', copyCss);
  variationsBtn.addEventListener('click', generateAIVariations);
  healAllBtn.addEventListener('click', healAllAnnotations);
  annotateBtn.addEventListener('click', enterAnnotationMode);
  exportBtn.addEventListener('click', exportAllChanges);
  editBtn.addEventListener('click', () => {
    if (selectedElement) {
      openManualEdit(selectedElement);
    }
  });

  // Usage Dashboard
  async function fetchUsage() {
    try {
      const response = await fetch(`${API_BASE}/api/usage`);
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch usage:', err);
      return null;
    }
  }

  function updateUsageIndicator(usage) {
    if (!usageIndicator || !usage) return;

    const percent = parseFloat(usage.session.budgetPercent);
    usageIndicator.className = 'flowstate-usage-indicator';

    if (percent >= 90) {
      usageIndicator.classList.add('danger');
    } else if (percent >= 70) {
      usageIndicator.classList.add('warning');
    }
  }

  function renderUsagePopup(usage) {
    const content = document.getElementById('flowstate-usage-content');
    if (!content || !usage) return;

    const percent = parseFloat(usage.session.budgetPercent);
    let fillClass = '';
    if (percent >= 90) fillClass = 'danger';
    else if (percent >= 70) fillClass = 'warning';

    content.innerHTML = `
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">API Calls</span>
        <span class="flowstate-usage-value">${usage.totals.apiCalls}</span>
      </div>
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">Input Tokens</span>
        <span class="flowstate-usage-value">${usage.totals.inputTokens.toLocaleString()}</span>
      </div>
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">Output Tokens</span>
        <span class="flowstate-usage-value">${usage.totals.outputTokens.toLocaleString()}</span>
      </div>
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">Images Generated</span>
        <span class="flowstate-usage-value">${usage.totals.imagesGenerated}</span>
      </div>
      <div class="flowstate-usage-stat">
        <span class="flowstate-usage-label">Est. Cost</span>
        <span class="flowstate-usage-value">$${usage.totals.estimatedCost}</span>
      </div>

      <div class="flowstate-budget-bar">
        <div class="flowstate-budget-header">
          <span class="flowstate-budget-label">Budget Used</span>
          <span class="flowstate-budget-amount">$${usage.session.budgetUsed.toFixed(4)} / $${usage.session.budget.toFixed(2)}</span>
        </div>
        <div class="flowstate-budget-track">
          <div class="flowstate-budget-fill ${fillClass}" style="width: ${Math.min(percent, 100)}%"></div>
        </div>
      </div>

      <div class="flowstate-usage-actions">
        <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-refresh-usage">🔄 Refresh</button>
        <button class="flowstate-btn flowstate-btn-secondary" id="flowstate-reset-usage" style="color: #EF4444;">🗑️ Reset</button>
      </div>
    `;

    // Add event listeners to the action buttons
    document.getElementById('flowstate-refresh-usage')?.addEventListener('click', async () => {
      const newUsage = await fetchUsage();
      if (newUsage) {
        renderUsagePopup(newUsage);
        updateUsageIndicator(newUsage);
      }
    });

    document.getElementById('flowstate-reset-usage')?.addEventListener('click', async () => {
      if (confirm('Reset all usage data? This cannot be undone.')) {
        try {
          await fetch(`${API_BASE}/api/usage/reset`, { method: 'POST' });
          const newUsage = await fetchUsage();
          if (newUsage) {
            renderUsagePopup(newUsage);
            updateUsageIndicator(newUsage);
          }
        } catch (err) {
          console.error('Failed to reset usage:', err);
        }
      }
    });
  }

  async function toggleUsagePopup() {
    const popup = document.getElementById('flowstate-usage-popup');
    if (!popup) return;

    if (popup.classList.contains('visible')) {
      popup.classList.remove('visible');
    } else {
      popup.classList.add('visible');
      const usage = await fetchUsage();
      if (usage) {
        renderUsagePopup(usage);
        updateUsageIndicator(usage);
      }
    }
  }

  usageBtn?.addEventListener('click', toggleUsagePopup);
  document.getElementById('flowstate-usage-close')?.addEventListener('click', () => {
    document.getElementById('flowstate-usage-popup')?.classList.remove('visible');
  });

  // Fetch initial usage to set indicator color
  fetchUsage().then(usage => {
    if (usage) updateUsageIndicator(usage);
  });

  // Show onboarding for first-time users (with slight delay for DOM to settle)
  setTimeout(() => {
    if (shouldShowOnboarding()) {
      showOnboarding(0);
    }
  }, 1000);

  // Manual Edit Modal listeners
  document.getElementById('flowstate-edit-cancel')?.addEventListener('click', closeManualEdit);
  document.getElementById('flowstate-edit-apply')?.addEventListener('click', applyManualEdit);
  document.getElementById('flowstate-modal-backdrop')?.addEventListener('click', closeManualEdit);
  
  document.getElementById('flowstate-live-toggle')?.addEventListener('click', function() {
    this.classList.toggle('on');
  });
  
  document.getElementById('flowstate-code-editor')?.addEventListener('input', handleLivePreview);
  
  document.getElementById('flowstate-save-instructions')?.addEventListener('click', () => {
    const input = document.getElementById('flowstate-instructions-input');
    if (input) {
      saveSystemInstructions(input.value);
      // Flash success
      const btn = document.getElementById('flowstate-save-instructions');
      btn.textContent = '✓';
      btn.style.color = '#22C55E';
      setTimeout(() => {
        btn.textContent = 'Save';
        btn.style.color = '';
      }, 1000);
    }
  });
  
  document.getElementById('flowstate-propagate-yes')?.addEventListener('click', () => {
    if (window.__flowstatePendingStyles) {
      propagateToSimilar(window.__flowstatePendingStyles);
    }
    closeManualEdit();
  });
  
  document.getElementById('flowstate-propagate-no')?.addEventListener('click', () => {
    closeManualEdit();
  });
  
  document.getElementById('flowstate-edit-ai')?.addEventListener('click', async () => {
    const editor = document.getElementById('flowstate-code-editor');
    const instructions = document.getElementById('flowstate-instructions-input')?.value || '';
    
    if (!selectedElement) return;
    
    const btn = document.getElementById('flowstate-edit-ai');
    btn.textContent = '⏳';
    btn.disabled = true;
    
    try {
      const context = {
        element: selectedElement.tagName.toLowerCase(),
        currentCSS: editor.value,
        systemInstructions: instructions,
        designSystem: pageDesignSystem?.common || null
      };
      
      const response = await fetch(`${API_BASE}/api/suggest-css`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });
      
      const result = await response.json();
      
      if (result.success && result.css) {
        editor.value = result.css;
        handleLivePreview();
      }
    } catch (e) {
      console.log('AI suggestion failed:', e);
    }
    
    btn.textContent = '🤖 AI Suggest';
    btn.disabled = false;
  });
  
  // Tab switching in edit modal
  document.querySelectorAll('.flowstate-edit-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.flowstate-edit-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const editor = document.getElementById('flowstate-code-editor');
      if (!selectedElement) return;
      
      if (tab.dataset.tab === 'html') {
        editor.value = selectedElement.outerHTML;
      } else {
        // Restore CSS view
        const cs = window.getComputedStyle(selectedElement);
        const relevantProps = ['padding', 'margin', 'border-radius', 'background-color', 'color', 
                              'font-size', 'font-weight', 'width', 'height', 'border', 'box-shadow'];
        let cssText = `/* Edit styles for ${selectedElement.tagName.toLowerCase()} */\n\n`;
        relevantProps.forEach(prop => {
          const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          const value = cs[camelProp];
          if (value && value !== 'none' && value !== 'normal') {
            cssText += `${prop}: ${value};\n`;
          }
        });
        editor.value = cssText;
      }
    });
  });
  
  // Toolbar event listeners
  toolbar.querySelectorAll('.flowstate-tool').forEach(tool => {
    tool.addEventListener('click', () => {
      setTool(tool.dataset.tool);
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't capture if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'Escape') {
      if (isRecording) {
        stopRecording();
      } else if (annotationMode) {
        exitAnnotationMode();
        panel.classList.add('visible');
      } else if (isActive) {
        deactivate();
      }
    }
    
    // Global shortcuts when FlowState is active
    if (isActive && !annotationMode) {
      // Z = Undo (Cmd/Ctrl + Z)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undoLastChange();
      }
      
      // E = Export
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey) {
        exportAllChanges();
      }
      
      // M = Manual Edit
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && selectedElement) {
        openManualEdit(selectedElement);
      }
      
      // 1-6 for variations
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6 && variationStyles.length >= num) {
        applyVariation(num - 1);
        // Update button states
        const variationsContainer = document.getElementById('flowstate-variations');
        if (variationsContainer) {
          variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.var) === num - 1);
          });
        }
      }
      
      // 0 = Original
      if (e.key === '0') {
        applyVariation(-1);
        const variationsContainer = document.getElementById('flowstate-variations');
        if (variationsContainer) {
          variationsContainer.querySelectorAll('.flowstate-var-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.var) === -1);
          });
        }
      }
    }
    
    // Escape closes manual edit modal
    if (manualEditMode && e.key === 'Escape') {
      closeManualEdit();
      return;
    }
    
    // Tool shortcuts when in annotation mode
    if (annotationMode && !isRecording) {
      const shortcuts = { 'v': 'select', 'd': 'draw', 'e': 'eraser', 'b': 'box', 'a': 'arrow', 't': 'text' };
      if (shortcuts[e.key.toLowerCase()]) {
        setTool(shortcuts[e.key.toLowerCase()]);
      }

      // Z for undo (without modifier in annotation mode)
      if (e.key.toLowerCase() === 'z' && !e.metaKey && !e.ctrlKey) {
        undoLastAnnotation();
      }

      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoLastAnnotation();
      }

      // Space for voice (hold to talk)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startRecording();
      }
    }
  });
  
  // Space release to stop recording
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && isRecording) {
      e.preventDefault();
      stopRecording();
    }
  });
  
  // Window resize
  window.addEventListener('resize', () => {
    if (annotationMode) {
      initCanvas();
      redrawCanvas();
    }
  });
  
  // Load html2canvas dynamically
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
  }
  
  console.log('🌊 FlowState overlay loaded. Click the button in the bottom-right corner to start.');
  
})();
