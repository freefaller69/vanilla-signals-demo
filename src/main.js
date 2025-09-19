import './components/MainContent/MainContent.js';
import globalStyles from './style.css?inline';
import { applyGlobalStyles } from './utilities/createComponent.js';

class MessagingApp {
  constructor() {
    applyGlobalStyles(globalStyles);
    this.bindGlobalEvents();
  }

  bindGlobalEvents() {
    // Listen to custom events from the store
    window.addEventListener('threadSelected', (e) => {
      // Thread selected event
    });

    window.addEventListener('messageSent', (e) => {
      // Message sent event
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MessagingApp();
});
