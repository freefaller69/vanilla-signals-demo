# Demo App Walkthrough: Understanding Signals in Practice

This document walks through the signals demo application to show how reactive programming works in a real frontend application. It's designed to help backend engineers understand the patterns and benefits of signals-based architecture.

## Application Overview

The demo is a simple chat application that demonstrates:

- **Multiple UI components** reacting to shared state
- **Computed values** derived from multiple sources
- **Real-time UI updates** without manual event handling
- **Performance optimization** through automatic batching

### Architecture Highlights

- **Central State Store**: All application state managed through signals
- **Component Isolation**: Each component focuses on rendering, not state management
- **Automatic Synchronization**: All UI components stay in sync automatically
- **Type Safety**: Using plain JavaScript with clear patterns

## Core State Management (`src/store/messageStore.js`)

Let's examine how the application's central state is structured:

### Primary State Signals

```javascript
// Core data - these are your "database tables" in memory
const threads = signal([
  {
    id: 1,
    name: 'General Discussion',
    messages: [{ id: 1, text: 'Welcome to the chat!', timestamp: new Date(), sender: 'System' }],
  },
  // ... more threads
]);

const activeThreadId = signal(1); // Which thread is currently selected
const messageInput = signal(''); // Current message being typed
```

**Key Insight**: These are like entity models in a backend application, but they automatically notify dependents when they change.

### Computed State (Derived Values)

```javascript
// These automatically recalculate when their dependencies change
const activeThread = computed(() => {
  const allThreads = threads.get();
  const currentId = activeThreadId.get();
  return allThreads.find((thread) => thread.id === currentId);
});

const totalMessageCount = computed(() => {
  return threads.get().reduce((count, thread) => count + thread.messages.length, 0);
});

const unreadCount = computed(() => {
  // In a real app, this would track actual unread messages
  return threads.get().filter((thread) => thread.id !== activeThreadId.get()).length;
});
```

**Backend Analogy**: Think of computed signals like:

- **SQL Views** that automatically refresh when underlying tables change
- **Cached properties** that invalidate when dependencies change
- **Calculated fields** in Entity Framework that update automatically

### Actions (State Mutations)

```javascript
function selectThread(threadId) {
  activeThreadId.set(threadId);
  // That's it! All UI components that depend on activeThreadId automatically update
}

function sendMessage() {
  const text = messageInput.get().trim();
  if (!text) return;

  const thread = activeThread.get();
  if (!thread) return;

  // Create new message
  const newMessage = {
    id: Date.now(),
    text,
    timestamp: new Date(),
    sender: 'You',
  };

  // Update the threads array with the new message
  // Note: We create a new array to ensure signal detects the change
  const updatedThreads = threads
    .get()
    .map((t) => (t.id === thread.id ? { ...t, messages: [...t.messages, newMessage] } : t));

  // Batch the updates to prevent intermediate calculations
  batch(() => {
    threads.set(updatedThreads);
    messageInput.set('');
  });

  // Custom event for any components that need to react to message sending
  window.dispatchEvent(
    new CustomEvent('messageSent', {
      detail: { threadId: thread.id, message: newMessage },
    })
  );
}
```

**Key Pattern**: Notice how we:

1. **Read current state** using `.get()`
2. **Calculate new state** immutably (create new arrays/objects)
3. **Update signals** using `.set()`
4. **Trust the system** to update all dependent UI automatically

## Component Architecture

The demo application uses a clean three-component architecture that demonstrates separation of concerns and reactive patterns:

### Architecture Overview

```
src/components/
├── MainContent/         # Root container component
│   ├── MainContent.js   # Simple container with no reactive logic
│   ├── MainContent.html # Layout template
│   └── MainContent.css  # Global layout styles
├── Chat/                # Message display and input handling
│   ├── Chat.js          # Main reactive message logic
│   ├── Chat.html        # Chat interface template
│   └── Chat.css         # Chat-specific styles
└── Sidebar/             # Thread navigation and statistics
    ├── Sidebar.js       # Thread list and stats reactive logic
    ├── Sidebar.html     # Sidebar template
    └── Sidebar.css      # Sidebar styles
```

### Component Pattern: HTML/CSS Imports + setupComponent

All components follow a consistent pattern using external template files:

```javascript
// Standard component imports
import componentHtml from './Component.html?raw';
import componentStyles from './Component.css?inline';
import { setupComponent } from '../../utilities/createComponent.js';

class MyComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, componentStyles, componentHtml);
  }
}
```

**Benefits of this pattern:**
- **Separation of concerns** - Logic, styles, and markup in separate files
- **Shadow DOM encapsulation** - Styles don't leak between components
- **Template reusability** - HTML can be edited without touching JavaScript
- **Build-time optimization** - Vite handles the ?raw and ?inline imports

### MainContent Component (`src/components/MainContent/MainContent.js`)

The root component serves as a simple container:

```javascript
import mainHtml from './MainContent.html?raw';
import mainStyles from './MainContent.css?inline';
import { setupComponent } from '../../utilities/createComponent.js';
import '../Chat/Chat.js';
import '../Sidebar/Sidebar.js';
import { startRandomMovieQuotes } from '../../store/messageStore.js';

class MainContent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, mainStyles, mainHtml);
  }

  connectedCallback() {
    startRandomMovieQuotes(); // Begins demo content generation
  }
}

customElements.define('main-content', MainContent);
```

**Key characteristics:**
- **No reactive logic** - Just imports and registers child components
- **Template-driven layout** - HTML file defines the overall structure
- **Initialization** - Starts background processes when mounted

### Chat Component (`src/components/Chat/Chat.js`)

Contains the core message display and input reactive logic:

```javascript
class ChatComponent extends HTMLElement {
  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    setupComponent(shadowRoot, chatStyles, chatHtml);
  }

  connectedCallback() {
    this.effectDisposers = []; // Track effects for cleanup
    this.bindEvents();         // Set up DOM event listeners
    this.bindEffects();        // Set up reactive effects
  }

  bindEffects() {
    // Effect 1: Update chat header when active thread changes
    this.effectDisposers.push(
      effect(() => {
        const thread = activeThread.get();
        const titleEl = this.shadowRoot.querySelector('#chatTitle');
        const participantsEl = this.shadowRoot.querySelector('#chatParticipants');

        if (thread) {
          titleEl.textContent = thread.name;
          participantsEl.textContent = `${thread.participants.length} participants: ${thread.participants.join(', ')}`;
        } else {
          titleEl.textContent = 'Select a conversation';
          participantsEl.textContent = 'Choose a thread from the sidebar to start messaging';
        }
      })
    );

    // Effect 2: Render messages with efficient incremental updates
    let lastRenderedMessages = [];
    let lastThreadId = null;

    this.effectDisposers.push(
      effect(() => {
        const thread = activeThread.get();
        const container = this.shadowRoot.querySelector('#messagesContainer');

        // Handle thread switching with full re-render
        const threadChanged = lastThreadId !== thread?.id;

        if (threadChanged) {
          // Full re-render for new thread
          container.innerHTML = thread?.messages
            .map((msg, index) => `
              <div class="message ${msg.author === 'You' ? 'own' : ''}"
                   style="animation-delay: ${index * 0.05}s">
                <div class="message-author">${msg.author}</div>
                <div class="message-content">${this.escapeHtml(msg.content)}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</div>
              </div>
            `).join('') || '';
          lastRenderedMessages = [...(thread?.messages || [])];
          lastThreadId = thread?.id;
        } else if (thread) {
          // Incremental update - only add new messages
          const newMessages = thread.messages.slice(lastRenderedMessages.length);
          if (newMessages.length > 0) {
            const newMessagesHtml = newMessages.map(/* render new messages */).join('');
            container.insertAdjacentHTML('beforeend', newMessagesHtml);
            lastRenderedMessages = [...thread.messages];
          }
        }
      })
    );

    // Effect 3: Update send button state
    this.effectDisposers.push(
      effect(() => {
        const sendButton = this.shadowRoot.querySelector('#sendButton');
        const canSend = canSendMessage.get();
        if (sendButton) {
          sendButton.disabled = !canSend;
        }
      })
    );
  }

  disconnectedCallback() {
    // CRITICAL: Clean up effects when component is removed
    this.effectDisposers?.forEach((dispose) => dispose());
    this.effectDisposers = [];
  }
}
```

### Sidebar Component (`src/components/Sidebar/Sidebar.js`)

Handles thread navigation and statistics display:

```javascript
class SidebarComponent extends HTMLElement {
  connectedCallback() {
    this.effectDisposers = [];
    this.bindEvents();    // Set up click handlers
    this.bindEffects();   // Set up reactive effects
  }

  bindEvents() {
    // New thread button
    const newThreadBtn = this.shadowRoot.querySelector('#newThreadBtn');
    newThreadBtn?.addEventListener('click', () => {
      createNewThread();
    });

    // Thread selection (event delegation)
    const threadList = this.shadowRoot.querySelector('#threadList');
    threadList.addEventListener('click', (e) => {
      const threadItem = e.target.closest('.thread-item');
      if (threadItem) {
        const threadId = parseInt(threadItem.dataset.threadId);
        selectThread(threadId); // Updates signal, triggers all dependent effects
      }
    });
  }

  bindEffects() {
    // Effect 1: Update statistics
    this.effectDisposers.push(
      effect(() => {
        const totalThreadsEl = this.shadowRoot.querySelector('#totalThreads');
        if (totalThreadsEl) {
          totalThreadsEl.textContent = totalThreadCount.get();
        }
      })
    );

    // Effect 2: Update thread list with active highlighting
    this.effectDisposers.push(
      effect(() => {
        const threadListEl = this.shadowRoot.querySelector('#threadList');
        const stats = threadStats.get();
        const activeId = activeThreadId.get();

        threadListEl.innerHTML = stats
          .map((thread) => `
            <div class="thread-item ${thread.id === activeId ? 'active' : ''}"
                 data-thread-id="${thread.id}">
              <div class="thread-name">
                ${thread.name}
                ${thread.unreadCount > 0 ? `<span class="unread-badge">${thread.unreadCount}</span>` : ''}
              </div>
              <div class="thread-preview">
                ${thread.lastMessage ? thread.lastMessage.content : 'No messages yet'}
              </div>
            </div>
          `).join('');
      })
    );
  }
}
```

**Key Patterns Used:**

1. **Template Separation**: HTML/CSS imported as external files using Vite's ?raw/?inline
2. **setupComponent Utility**: Consistent Shadow DOM + template application
3. **effectDisposers Array**: Proper cleanup tracking for all reactive effects
4. **bindEvents/bindEffects Separation**: Clear distinction between DOM events and reactive effects
5. **Incremental Rendering**: Chat optimizes message rendering for performance
6. **Event Delegation**: Sidebar uses delegation for dynamic thread list clicks
7. **Null Safety**: All effects handle missing elements gracefully

## Understanding the Data Flow

### 1. User Interaction

```
User clicks thread → Event handler calls selectThread(id) → activeThreadId.set(id)
```

### 2. Automatic Updates

```
activeThreadId changes → activeThread recomputes → All effects run automatically
```

### 3. UI Synchronization

```
MainContent effect → Updates message display
Sidebar effect     → Updates active thread highlighting
Header effect      → Updates breadcrumb (if present)
```

**This all happens automatically!** No manual coordination needed.

### 4. Message Sending Flow

```
User types → messageInput.set(text) → canSendMessage recomputes → Button state updates
User clicks send → sendMessage() → batch() updates → All dependent UI updates
```

## Performance Characteristics

### Automatic Optimization

1. **Memoization**: Computed values only recalculate when dependencies change
2. **Batching**: Multiple signal updates in `batch()` trigger effects only once
3. **Efficient Change Detection**: Uses shallow equality by default
4. **Lazy Evaluation**: Computed values only calculate when accessed

### Measuring Performance

You can observe the efficiency in the browser dev tools:

```javascript
// Add this to see when computations happen
const activeThread = new Signal.Computed(() => {
  console.log('activeThread computing...'); // Only logs when actually needed
  const allThreads = threads.get();
  const currentId = activeThreadId.get();
  return allThreads.find((thread) => thread.id === currentId);
});
```

## Comparison with Traditional Approaches

### Without Signals (Traditional)

```javascript
// ❌ Manual event handling - lots of boilerplate
class ChatApp {
  constructor() {
    this.threads = [];
    this.activeThreadId = 1;
    this.messageInput = '';
    this.listeners = [];
  }

  selectThread(id) {
    this.activeThreadId = id;
    // Manually notify all components
    this.notifyListeners('threadChanged', id);
  }

  addListener(event, callback) {
    this.listeners.push({ event, callback });
  }

  notifyListeners(event, data) {
    this.listeners.filter((l) => l.event === event).forEach((l) => l.callback(data));
  }

  sendMessage(text) {
    // Update data
    const thread = this.threads.find((t) => t.id === this.activeThreadId);
    thread.messages.push({ text, timestamp: new Date() });

    // Manually update all the UI
    this.updateMessageDisplay();
    this.updateThreadsList();
    this.updateMessageCount();
    this.clearInput();

    // Manually notify listeners
    this.notifyListeners('messageSent', { threadId: this.activeThreadId });
  }
}
```

### With Signals (Reactive)

```javascript
// ✅ Signals - declarative and automatic
const threads = signal(initialThreads);
const activeThreadId = signal(1);
const messageInput = signal('');

// Computed values update automatically
const activeThread = computed(() => threads.get().find((t) => t.id === activeThreadId.get()));

// UI updates automatically through effects
effect(() => updateMessageDisplay());
effect(() => updateThreadsList());
effect(() => updateMessageCount());

// Actions are simple and focused
function selectThread(id) {
  activeThreadId.set(id); // Everything else happens automatically
}

function sendMessage(text) {
  // Update state and trust the system
  batch(() => {
    threads.set(/* updated threads */);
    messageInput.set('');
  });
}
```

## Error Handling and Debugging

The signals system includes comprehensive error handling:

### Catching Computation Errors

```javascript
const riskyComputation = computed(() => {
  const data = someSignal.get();
  if (!data) throw new Error('No data available');
  return data.someProperty.toUpperCase();
});

// Errors are caught and logged, but don't crash the app
try {
  console.log(riskyComputation.get());
} catch (error) {
  console.log('Computation failed:', error.message);
}
```

### Effect Error Isolation

```javascript
effect(() => {
  // If this throws, other effects still run
  throw new Error('This effect failed');
});

effect(() => {
  // This effect still works fine
  console.log('This effect is unaffected');
});
```

### Debugging Tips

1. **Use browser dev tools** to step through effects
2. **Add console.log** in computed functions to see when they run
3. **Use the `Signal.subtle` APIs** for introspection:

```javascript
// See what depends on a signal
console.log(Signal.subtle.introspectSinks(threads));

// See what a computed signal depends on
console.log(Signal.subtle.introspectSources(activeThread));
```

## Extending the Demo

### Adding Real-Time Features

```javascript
// Add WebSocket integration
const websocket = new WebSocket('ws://localhost:8080');

websocket.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === 'newMessage') {
    // Update signals - UI updates automatically
    const currentThreads = threads.get();
    const updatedThreads = currentThreads.map((thread) =>
      thread.id === data.threadId
        ? { ...thread, messages: [...thread.messages, data.message] }
        : thread
    );
    threads.set(updatedThreads);
  }
};
```

### Adding Persistence

```javascript
// Auto-save to localStorage
effect(() => {
  const currentThreads = threads.get();
  localStorage.setItem('chat-threads', JSON.stringify(currentThreads));
});

// Load from localStorage on startup
const savedThreads = localStorage.getItem('chat-threads');
if (savedThreads) {
  threads.set(JSON.parse(savedThreads));
}
```

### Adding Complex State

```javascript
// User presence
const onlineUsers = signal(new Set());
const currentUser = signal({ id: 1, name: 'You', status: 'online' });

// Typing indicators
const typingUsers = signal(new Map()); // threadId -> Set of user IDs

const typingInCurrentThread = computed(() => {
  const currentThreadId = activeThreadId.get();
  const typing = typingUsers.get().get(currentThreadId) || new Set();
  return Array.from(typing);
});

// UI automatically shows typing indicators
effect(() => {
  const typing = typingInCurrentThread.get();
  updateTypingIndicator(typing);
});
```

## Best Practices Learned from the Demo

### 1. **Single Source of Truth**

- All state lives in the central store
- Components read from signals, never maintain local state copies

### 2. **Immutable Updates**

- Always create new objects/arrays when updating signals
- Use spread operators and array methods that return new instances

### 3. **Effect Cleanup**

- Always store effect cleanup functions
- Dispose effects when components unmount

### 4. **Batched Updates**

- Use `batch()` when updating multiple related signals
- Prevents intermediate states and improves performance

### 5. **Focused Signals**

- Keep signals focused on single concerns
- Use computed signals to derive complex state

### 6. **Error Boundaries**

- Handle errors gracefully in effects and computations
- Don't let one broken effect crash the entire app

## Testing Strategy

The demo includes comprehensive tests showing how to test signal-based applications:

```javascript
// Test signal behavior
test('selecting thread updates active thread', () => {
  const initialThread = activeThread.get();
  selectThread(2);
  expect(activeThread.get().id).toBe(2);
  expect(activeThread.get()).not.toBe(initialThread);
});

// Test computed values
test('message count updates when messages added', () => {
  const initialCount = totalMessageCount.get();
  sendMessage('Test message');
  expect(totalMessageCount.get()).toBe(initialCount + 1);
});

// Test effects
test('effects run when dependencies change', () => {
  const spy = jest.fn();
  const cleanup = effect(() => spy(activeThreadId.get()));

  selectThread(3);
  expect(spy).toHaveBeenCalledWith(3);

  cleanup(); // Don't forget cleanup in tests
});
```

## Conclusion

This demo application demonstrates how signals enable:

1. **Declarative UI**: Describe what the UI should look like, not how to update it
2. **Automatic Synchronization**: All components stay in sync without manual coordination
3. **Performance**: Only compute what's actually needed, when it's needed
4. **Maintainability**: Clear separation between state, derived state, and UI
5. **Testability**: Easy to test individual pieces in isolation

The key mindset shift for backend developers is moving from **imperative** (manually coordinating updates) to **reactive** (describing relationships and letting the system handle updates automatically).

This approach scales well from simple demos to complex applications, providing a solid foundation for modern frontend development.
