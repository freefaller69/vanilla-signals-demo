import chatHtml from './Chat.html?raw';
import chatStyles from './Chat.css?inline';
import { effect } from '../../utils/signals';
import { setupComponent } from '../../utils/createComponent';
import { messageInput, canSendMessage, sendMessage, activeThread } from '../../store/messageStore';

class ChatComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, chatStyles, chatHtml, 'shadow');
  }

  connectedCallback() {
    console.log('Chat component connected');
    this.bindEvents();
    this.bindEffects();
  }

  bindEvents() {
    const sendButton = this.shadowRoot.querySelector('#sendButton');
    const messageInputEl = this.shadowRoot.querySelector('#messageInput');

    // Send message button
    sendButton.addEventListener('click', () => {
      console.log('click listener');
      this.handleSendMessage();
    });

    // Message input changes
    messageInputEl.addEventListener('input', (e) => {
      console.log('Input event - setting messageInput to:', `"${e.target.value}"`);
      messageInput.value = e.target.value;
      sendButton.disabled = messageInputEl.value.trim() === '';
      console.log('Input event - messageInput signal now contains:', `"${messageInput.value}"`);
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
    effect(() => {
      const thread = activeThread.value;
      const titleEl = this.shadowRoot.querySelector('#chatTitle');
      const participantsEl = this.shadowRoot.querySelector('#chatParticipants');

      if (!titleEl || !participantsEl) {
        console.log('Chat: header elements not found');
        return;
      }

      if (thread) {
        titleEl.textContent = thread.name;
        participantsEl.textContent = `${thread.participants.length} participants: ${thread.participants.join(', ')}`;
      } else {
        titleEl.textContent = 'Select a conversation';
        participantsEl.textContent = 'Choose a thread from the sidebar to start messaging';
      }
    });

    // Update messages list
    effect(() => {
      const thread = activeThread.value;
      console.log(
        'Chat: messages effect running - thread:',
        thread?.name || 'null',
        'messages:',
        thread?.messages?.length || 0
      );
      const container = this.shadowRoot.querySelector('#messagesContainer');
      if (!container) return;

      if (thread && thread.messages.length > 0) {
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

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      } else if (thread) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>Start the conversation</h3>
            <p>No messages in this thread yet. Send the first message!</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <h3>Welcome to Signals Messaging</h3>
            <p>This demo showcases reactive state management with signals, computed values, and effects.</p>
          </div>
        `;
      }
    });

    // Update send button state
    effect(() => {
      const sendButton = this.shadowRoot.querySelector('#sendButton');
      const canSend = canSendMessage.value;
      if (sendButton) {
        sendButton.disabled = !canSend;
      }
    });

    // Keep input in sync with signal (only when programmatically cleared)
    effect(() => {
      const messageInputEl = this.shadowRoot.querySelector('#messageInput');
      const signalValue = messageInput.value;

      // Only update DOM if signal was cleared (empty) and DOM still has content
      if (messageInputEl && signalValue === '' && messageInputEl.value !== '') {
        console.log('Clearing input element to match signal');
        messageInputEl.value = '';
        this.autoResizeTextarea(messageInputEl);
      }
    });
  }

  handleSendMessage() {
    const content = messageInput.value.trim();
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
