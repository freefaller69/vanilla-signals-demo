import './components/MainContent/MainContent.js';
import { activeThreadId, selectThread, threads } from './store/messageStore.js';
import globalStyles from './style.css?inline';
import { applyGlobalStyles } from './utilities/createComponent.js';

class MessagingApp {
  constructor() {
    applyGlobalStyles(globalStyles);
    this.bindGlobalEvents();
    // this.autoSelectFirstThread();
  }

  bindGlobalEvents() {
    // Listen to custom events from the store
    window.addEventListener('threadSelected', (e) => {
      console.log('📱 Thread selected:', e.detail.threadId);
    });

    window.addEventListener('messageSent', (e) => {
      console.log('💬 Message sent:', e.detail);
    });
  }

  autoSelectFirstThread() {
    // Select first thread after a brief delay
    setTimeout(() => {
      const firstThread = threads.get()[0];
      console.log(
        'Auto-select check - firstThread:',
        firstThread?.name,
        'current activeThreadId:',
        activeThreadId.get()
      );
      if (firstThread && !activeThreadId.get()) {
        console.log('Auto-selecting first thread:', firstThread.name);
        selectThread(firstThread.id);
        console.log(
          '✅ Auto-selected first thread:',
          firstThread.name,
          'activeThreadId now:',
          activeThreadId.get()
        );
      }
    }, 100);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MessagingApp();
});
