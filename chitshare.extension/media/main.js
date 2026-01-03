// Chitshare VS Code Extension - Webview Entry Point
import { initState } from './state.js';
import { init } from './event-handlers.js';

// Initialize state from storage
initState();

// Start application
init();
