import sidebarHtml from './Sidebar.html?raw';
import sidebarStyles from './Sidebar.css?inline';
import { effect } from '../../signals.js';
import {
  totalThreadCount,
  totalMessageCount,
  unreadCount,
  threadStats,
  activeThreadId,
  selectThread,
  createNewThread,
} from '../../store/messageStore.js';

class SidebarComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });

    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(sidebarStyles);
    shadowRoot.adoptedStyleSheets = [styleSheet];

    const templateElement = document.createElement('template');
    templateElement.innerHTML = sidebarHtml;
    shadowRoot.appendChild(templateElement.content.cloneNode(true));
  }

  connectedCallback() {
    console.log('Sidebar component connected');
    this.bindEvents();
    this.bindEffects();
  }

  bindEvents() {
    // New thread button
    const newThreadBtn = this.shadowRoot.querySelector('#newThreadBtn');
    if (!newThreadBtn) return;
    newThreadBtn?.addEventListener('click', () => {
      createNewThread();
    });

    // Thread selection (event delegation)
    const threadList = this.shadowRoot.querySelector('#threadList');
    if (!threadList) return;
    threadList.addEventListener('click', (e) => {
      const threadItem = e.target.closest('.thread-item');
      if (threadItem) {
        const threadId = parseInt(threadItem.dataset.threadId);
        selectThread(threadId);
      }
    });
  }

  bindEffects() {
    // Update total threads count
    effect(() => {
      const totalThreadsEl = this.shadowRoot.querySelector('#totalThreads');
      if (totalThreadsEl) {
        totalThreadsEl.textContent = totalThreadCount.value;
      }
    });

    // Update total messages count
    effect(() => {
      const totalMessagesEl = this.shadowRoot.querySelector('#totalMessages');
      if (totalMessagesEl) {
        totalMessagesEl.textContent = totalMessageCount.value;
      }
    });

    // Update unread count
    effect(() => {
      const unreadCountEl = this.shadowRoot.querySelector('#unreadCount');
      if (unreadCountEl) {
        const count = unreadCount.value;
        unreadCountEl.textContent = count;
        unreadCountEl.style.display = count > 0 ? 'inline' : 'none';
      }
    });

    // Update thread list
    effect(() => {
      const threadListEl = this.shadowRoot.querySelector('#threadList');
      if (!threadListEl) return;

      const stats = threadStats.value;
      const activeId = activeThreadId.value;

      threadListEl.innerHTML = stats
        .map(
          (thread) => `
        <div class="thread-item ${thread.id === activeId ? 'active' : ''}" data-thread-id="${thread.id}">
          <div class="thread-name">
            ${thread.name}
            ${thread.unreadCount > 0 ? `<span class="unread-badge">${thread.unreadCount}</span>` : ''}
          </div>
          <div class="thread-preview">
            ${thread.lastMessage ? thread.lastMessage.content : 'No messages yet'}
          </div>
        </div>
      `
        )
        .join('');
    });
  }
}

customElements.define('sidebar-component', SidebarComponent);
