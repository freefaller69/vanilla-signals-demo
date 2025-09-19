import chatHtml from './Chat.html?raw';
import chatStyles from './Chat.css?inline';
import { effect } from '../../signals/signals_tc39';
import { setupComponent } from '../../utilities/createComponent';
import { messageInput, canSendMessage, sendMessage, activeThread } from '../../store/messageStore';

class ChatComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, chatStyles, chatHtml);
  }

  connectedCallback() {
    this.effectDisposers = [];
    this.bindEvents();
    this.bindEffects();
  }

  disconnectedCallback() {
    this.effectDisposers?.forEach((dispose) => dispose());
    this.effectDisposers = [];
  }

  bindEvents() {
    const sendButton = this.shadowRoot.querySelector('#sendButton');
    const messageInputEl = this.shadowRoot.querySelector('#messageInput');

    // Send message button
    sendButton.addEventListener('click', () => {
      this.handleSendMessage();
    });

    // Message input changes
    messageInputEl.addEventListener('input', (e) => {
      messageInput.set(e.target.value);
      sendButton.disabled = messageInputEl.value.trim() === '';
      this.autoResizeTextarea(e.target);
    });

    // Enter key to send
    messageInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
        sendButton.disabled = true;
      }
    });
  }

  bindEffects() {
    this.effectDisposers.push(
      effect(() => {
        const thread = activeThread.get();
        const titleEl = this.shadowRoot.querySelector('#chatTitle');
        const participantsEl = this.shadowRoot.querySelector('#chatParticipants');

        if (!titleEl || !participantsEl) {
          return;
        }

        if (thread) {
          titleEl.textContent = thread.name;
          participantsEl.textContent = `${thread.participants.length} participants: ${thread.participants.join(', ')}`;
        } else {
          titleEl.textContent = 'Select a conversation';
          participantsEl.textContent = 'Choose a thread from the sidebar to start messaging';
        }
      })
    );

    // Update messages list with efficient incremental rendering
    let lastRenderedMessages = [];
    let lastThreadId = null;

    this.effectDisposers.push(
      effect(() => {
        const thread = activeThread.get();
        const container = this.shadowRoot.querySelector('#messagesContainer');
        if (!container) return;

        // If no thread selected, show welcome message
        if (!thread) {
          container.innerHTML = `
          <div class="empty-state">
            <h3>Welcome to Signals Messaging</h3>
            <p>This demo showcases reactive state management with signals, computed values, and effects.</p>
          </div>
        `;
          lastRenderedMessages = [];
          lastThreadId = null;
          return;
        }

        // If empty thread, show start conversation message
        if (thread.messages.length === 0) {
          container.innerHTML = `
          <div class="empty-state">
            <h3>Start the conversation</h3>
            <p>No messages in this thread yet. Send the first message!</p>
          </div>
        `;
          lastRenderedMessages = [];
          lastThreadId = thread.id;
          return;
        }

        // Check if we switched threads (need full re-render)
        const threadChanged = lastThreadId !== thread.id;

        if (threadChanged) {
          // Full re-render for new thread
          container.innerHTML = thread.messages
            .map(
              (msg, index) => `
          <div class="message ${msg.author === 'You' ? 'own' : ''}" style="animation-delay: ${index * 0.05}s">
            <div class="message-author">${msg.author}</div>
            <div class="message-content">${this.escapeHtml(msg.content)}</div>
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
          </div>
        `
            )
            .join('');
          lastRenderedMessages = [...thread.messages];
          lastThreadId = thread.id;
        } else {
          // Incremental update - only add new messages
          const newMessages = thread.messages.slice(lastRenderedMessages.length);

          if (newMessages.length > 0) {
            const newMessagesHtml = newMessages
              .map(
                (msg, index) => `
            <div class="message ${msg.author === 'You' ? 'own' : ''}" style="animation-delay: ${(lastRenderedMessages.length + index) * 0.05}s">
              <div class="message-author">${msg.author}</div>
              <div class="message-content">${this.escapeHtml(msg.content)}</div>
              <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
            </div>
          `
              )
              .join('');

            // Append new messages without touching existing ones
            container.insertAdjacentHTML('beforeend', newMessagesHtml);
            lastRenderedMessages = [...thread.messages];
          }
        }

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      })
    );

    // Update send button state
    this.effectDisposers.push(
      effect(() => {
        const sendButton = this.shadowRoot.querySelector('#sendButton');
        const canSend = canSendMessage.get();
        if (sendButton) {
          sendButton.disabled = !canSend;
        }
      })
    );

    // Keep input in sync with signal (only when programmatically cleared)
    this.effectDisposers.push(
      effect(() => {
        const messageInputEl = this.shadowRoot.querySelector('#messageInput');
        const signalValue = messageInput.get();

        // Only update DOM if signal was cleared (empty) and DOM still has content
        if (messageInputEl && signalValue === '' && messageInputEl.value !== '') {
          messageInputEl.value = '';
          this.autoResizeTextarea(messageInputEl);
        }
      })
    );
  }

  handleSendMessage() {
    const content = messageInput.get().trim();
    if (content) {
      sendMessage(content);
    }
  }

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('chat-component', ChatComponent);
