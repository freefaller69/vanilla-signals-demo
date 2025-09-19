# Signals Guide: Reactive Programming for Frontend Applications

## Introduction for Backend Engineers

If you're coming from a .NET background, you might be thinking of signals in terms of ASP.NET SignalR or event-driven patterns. Frontend signals are different—they're a **reactive programming primitive** that automatically manages dependencies and updates when state changes.

Think of signals as **smart properties** that:

- Automatically track what depends on them (like computed properties in C#)
- Only recalculate when their dependencies actually change
- Eliminate manual event handling and callback hell
- Provide a declarative way to express data flow

## Why Signals Matter in Frontend Development

Unlike backend services where you often pull data on-demand, frontend applications need to:

- **React instantly** to user interactions
- **Synchronize** multiple UI components automatically
- **Minimize unnecessary re-renders** for performance
- **Manage complex state dependencies** without manual tracking

Signals solve these problems by providing automatic dependency tracking and efficient updates.

## Core Concepts

### 1. Signal.State - Your Data Source

`Signal.State` is like a reactive property that notifies dependents when it changes:

```javascript
// Similar to a C# property with PropertyChanged notification
const count = new Signal.State(0);

// Reading the value automatically registers this as a dependency
console.log(count.get()); // 0

// Setting triggers all dependent computations
count.set(5);
```

**Key differences from backend patterns:**

- No explicit event subscription needed
- Dependencies are tracked automatically
- Updates are batched and efficient

### 2. Signal.Computed - Derived State

`Signal.Computed` is like a calculated property that automatically recalculates when dependencies change:

```javascript
const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);

console.log(doubled.get()); // 0

count.set(5);
console.log(doubled.get()); // 10 - automatically updated!
```

**Think of it like:**

- C# computed properties that automatically invalidate
- Reactive Extensions (Rx) operators
- Database views that automatically refresh

### 3. Effects - Side Effects

Effects run automatically when their dependencies change:

```javascript
const user = new Signal.State({ name: 'John', status: 'online' });

// This runs immediately and whenever user changes
effect(() => {
  console.log(`${user.get().name} is ${user.get().status}`);
  // Could update the DOM, make API calls, etc.
});

user.set({ name: 'John', status: 'offline' }); // Effect runs again
```

## Practical Examples

### Example 1: User Profile Component

```javascript
// State
const user = new Signal.State({
  name: 'John Doe',
  email: 'john@example.com',
  isOnline: true,
});

// Computed values
const displayName = new Signal.Computed(() => {
  const u = user.get();
  return u.isOnline ? `${u.name} (Online)` : u.name;
});

const profileClass = new Signal.Computed(() => {
  return user.get().isOnline ? 'profile online' : 'profile offline';
});

// Effects for DOM updates
effect(() => {
  document.getElementById('user-name').textContent = displayName.get();
});

effect(() => {
  document.getElementById('user-profile').className = profileClass.get();
});

// Update state - all UI automatically updates
user.set({
  name: 'John Doe',
  email: 'john@example.com',
  isOnline: false,
});
```

### Example 2: Shopping Cart

```javascript
// Cart state
const cartItems = new Signal.State([]);

// Computed totals
const itemCount = new Signal.Computed(() => {
  return cartItems.get().reduce((sum, item) => sum + item.quantity, 0);
});

const totalPrice = new Signal.Computed(() => {
  return cartItems.get().reduce((sum, item) => sum + item.price * item.quantity, 0);
});

const formattedTotal = new Signal.Computed(() => {
  return `$${totalPrice.get().toFixed(2)}`;
});

// UI updates
effect(() => {
  document.getElementById('cart-count').textContent = itemCount.get();
});

effect(() => {
  document.getElementById('cart-total').textContent = formattedTotal.get();
});

// Add item - everything updates automatically
function addToCart(product) {
  const current = cartItems.get();
  const existing = current.find((item) => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
    cartItems.set([...current]); // Trigger update
  } else {
    cartItems.set([...current, { ...product, quantity: 1 }]);
  }
}
```

### Example 3: Form Validation

```javascript
// Form data
const email = new Signal.State('');
const password = new Signal.State('');
const confirmPassword = new Signal.State('');

// Validation rules
const emailValid = new Signal.Computed(() => {
  const value = email.get();
  return value.includes('@') && value.includes('.');
});

const passwordValid = new Signal.Computed(() => {
  return password.get().length >= 8;
});

const passwordsMatch = new Signal.Computed(() => {
  return password.get() === confirmPassword.get();
});

const formValid = new Signal.Computed(() => {
  return emailValid.get() && passwordValid.get() && passwordsMatch.get();
});

// UI feedback
effect(() => {
  const emailInput = document.getElementById('email');
  emailInput.className = emailValid.get() ? 'valid' : 'invalid';
});

effect(() => {
  const submitBtn = document.getElementById('submit');
  submitBtn.disabled = !formValid.get();
});
```

## Advanced Patterns

### Batching Updates

When you need to update multiple signals at once, use `batch()` to prevent intermediate calculations:

```javascript
const firstName = new Signal.State('John');
const lastName = new Signal.State('Doe');
const fullName = new Signal.Computed(() => `${firstName.get()} ${lastName.get()}`);

// Without batching: fullName calculates twice
firstName.set('Jane');
lastName.set('Smith');

// With batching: fullName calculates once
batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
});
```

### Custom Equality

For object state, provide custom equality to prevent unnecessary updates:

```javascript
const user = new Signal.State(
  { id: 1, name: 'John', preferences: { theme: 'dark' } },
  {
    equals: (a, b) => {
      // Deep equality check or compare specific fields
      return a.id === b.id && a.name === b.name && a.preferences.theme === b.preferences.theme;
    },
  }
);
```

### Lifecycle Management

Use lifecycle callbacks to track when signals are being watched:

```javascript
const expensiveData = new Signal.State(null, {
  [Signal.subtle.watched]: () => {
    console.log('Started watching - maybe start polling API');
  },
  [Signal.subtle.unwatched]: () => {
    console.log('No more watchers - can stop polling');
  },
});
```

### Cleanup and Disposal

Always clean up effects when components are removed:

```javascript
class UserComponent {
  constructor(userId) {
    this.userId = userId;
    this.cleanups = [];

    // Set up effects
    this.cleanups.push(
      effect(() => {
        // Update DOM when user data changes
        this.render();
      })
    );
  }

  destroy() {
    // Clean up all effects
    this.cleanups.forEach((cleanup) => cleanup());
  }
}
```

## Signal.subtle.Watcher - Manual Observation for Production Use Cases

### Understanding Watchers vs Effects

The demo application uses `effect()` functions for all reactive behaviors, but signals also provide `Signal.subtle.Watcher` for more sophisticated observation patterns. Understanding when to use each is crucial for production applications.

#### Why This Demo Uses Effects

Our chat application uses effects because they provide:

1. **Automatic dependency tracking** - Effects automatically track which signals they read
2. **Immediate execution** - Effects run synchronously when dependencies change
3. **Simple cleanup** - Each effect returns a cleanup function
4. **Direct DOM updates** - Perfect for updating UI elements directly

```javascript
// This demo's approach - simple and direct
effect(() => {
  document.getElementById('user-name').textContent = displayName.get();
});

effect(() => {
  document.getElementById('cart-total').textContent = formattedTotal.get();
});
```

#### When to Use Signal.subtle.Watcher in Production

Watchers are more powerful for advanced scenarios where you need:

**Real-Time Communication (WebSockets/SignalR)**: Instead of sending individual updates for each signal change, watchers can batch multiple state changes into single WebSocket messages, reducing network traffic and improving performance - especially important for high-frequency updates in real-time applications.

**1. Batch Processing of Multiple Signal Changes**

```javascript
// Analytics tracking - batch multiple user actions
const analyticsWatcher = new Signal.subtle.Watcher(() => {
  const changedSignals = analyticsWatcher.getPending();

  // Process all changes together
  const events = changedSignals.map(signal => ({
    type: getSignalType(signal),
    timestamp: Date.now(),
    value: signal.peek() // Don't create dependencies
  }));

  // Single analytics call instead of multiple
  analytics.track('user_interactions', { events });
});

// Watch user interaction signals
analyticsWatcher.watch(buttonClicks, pageViews, formSubmissions);
```

**2. Performance Monitoring and Debugging**

```javascript
// Performance monitoring system
class SignalPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.watcher = new Signal.subtle.Watcher(() => {
      this.recordMetrics();
    });
  }

  monitorSignals(...signals) {
    signals.forEach(signal => {
      this.metrics.set(signal, {
        changeCount: 0,
        lastChanged: Date.now(),
        averageInterval: 0
      });
    });

    this.watcher.watch(...signals);
  }

  recordMetrics() {
    const changed = this.watcher.getPending();
    const now = Date.now();

    changed.forEach(signal => {
      const metric = this.metrics.get(signal);
      if (metric) {
        const interval = now - metric.lastChanged;
        metric.changeCount++;
        metric.averageInterval = (metric.averageInterval + interval) / 2;
        metric.lastChanged = now;

        // Alert on high-frequency changes
        if (interval < 100) {
          console.warn('High frequency updates detected:', signal);
        }
      }
    });
  }
}

// Usage
const monitor = new SignalPerformanceMonitor();
monitor.monitorSignals(userState, cartItems, searchResults);
```

**3. External System Integration**

```javascript
// WebSocket sync - batch state changes before sending
class WebSocketSync {
  constructor(websocket) {
    this.ws = websocket;
    this.pendingUpdates = new Set();

    this.watcher = new Signal.subtle.Watcher(() => {
      // Debounce multiple changes into single update
      clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => this.syncToServer(), 100);
    });
  }

  syncSignals(...signals) {
    this.watcher.watch(...signals);
  }

  syncToServer() {
    const changes = this.watcher.getPending();

    // Collect all changes into single message
    const updates = changes.map(signal => ({
      id: signal.id,
      value: signal.peek(), // Don't create dependencies
      timestamp: Date.now()
    }));

    if (updates.length > 0) {
      this.ws.send(JSON.stringify({
        type: 'bulk_update',
        changes: updates
      }));
    }
  }
}

// Usage
const sync = new WebSocketSync(websocket);
sync.syncSignals(userProfile, gameState, chatMessages);
```

**4. Complex State Coordination**

```javascript
// Multi-step form with complex validation
class FormOrchestrator {
  constructor() {
    this.validationQueue = new Set();

    this.watcher = new Signal.subtle.Watcher(() => {
      // Process all form field changes together
      this.processValidationBatch();
    });
  }

  watchForm(formFields) {
    this.watcher.watch(...Object.values(formFields));
  }

  processValidationBatch() {
    const changedFields = this.watcher.getPending();

    // Group validations by dependency
    const validationGroups = this.groupValidations(changedFields);

    // Run each group in sequence to avoid conflicts
    validationGroups.forEach(group => {
      this.runValidationGroup(group);
    });

    // Update UI once after all validations
    this.updateValidationUI();
  }

  groupValidations(fields) {
    // Complex logic to determine validation order
    // e.g., email validation before uniqueness check
    return this.sortByDependencies(fields);
  }
}
```

**5. Data Persistence with Conflict Resolution**

```javascript
// Auto-save with conflict detection
class AutoSaveManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.saveQueue = new Map();

    this.watcher = new Signal.subtle.Watcher(() => {
      this.processSaveQueue();
    });
  }

  watchDocuments(...documentSignals) {
    this.watcher.watch(...documentSignals);
  }

  processSaveQueue() {
    const changed = this.watcher.getPending();

    // Detect potential conflicts
    const conflicts = this.detectConflicts(changed);

    if (conflicts.length > 0) {
      this.resolveConflicts(conflicts);
    } else {
      // Safe to save all changes
      this.saveChanges(changed);
    }
  }

  detectConflicts(signals) {
    return signals.filter(signal => {
      const lastSaved = this.saveQueue.get(signal);
      const current = signal.peek();
      return lastSaved && this.hasConflict(lastSaved, current);
    });
  }
}
```

### Watchers vs Effects: Decision Matrix

| Use Case | Use Effect | Use Watcher | Reason |
|----------|------------|-------------|---------|
| Direct DOM updates | ✅ | ❌ | Effects run immediately, perfect for UI |
| Simple reactive logic | ✅ | ❌ | Effects are simpler and more direct |
| Multiple signal batching | ❌ | ✅ | Watchers collect multiple changes |
| External API calls | ❌ | ✅ | Batch API calls for efficiency |
| Performance monitoring | ❌ | ✅ | Need to observe without affecting |
| Complex coordination | ❌ | ✅ | Better control over execution timing |
| Analytics/logging | ❌ | ✅ | Batch events for better performance |

### Converting from Effects to Watchers

If you need more control, here's how to convert from the demo's effect pattern:

```javascript
// Demo approach (immediate, per-signal)
effect(() => {
  const user = userSignal.get();
  updateUserDisplay(user);
});

effect(() => {
  const cart = cartSignal.get();
  updateCartDisplay(cart);
});

// Production approach (batched, coordinated)
const uiWatcher = new Signal.subtle.Watcher(() => {
  const changes = uiWatcher.getPending();

  // Batch DOM updates for better performance
  const updates = changes.map(signal => {
    if (signal === userSignal) return () => updateUserDisplay(signal.peek());
    if (signal === cartSignal) return () => updateCartDisplay(signal.peek());
    return null;
  }).filter(Boolean);

  // Apply all updates in a single animation frame
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });
});

uiWatcher.watch(userSignal, cartSignal);
```

### Key Takeaways

- **Effects are perfect for simple, immediate reactive behaviors** (like this demo)
- **Watchers excel at complex, coordinated, or batched operations** (production scenarios)
- **Choose effects for UI updates, watchers for system integration**
- **Effects track dependencies automatically, watchers require manual setup**
- **Watchers provide better performance for high-frequency changes**

The demo's use of effects keeps the code simple and educational, but real production applications often benefit from watchers for advanced coordination patterns.

## Best Practices

### 1. **Keep Signals Focused**

- One concern per signal
- Prefer multiple simple signals over complex objects
- Use computed signals to derive complex state

### 2. **Minimize Signal Mutations**

- Treat signal values as immutable when possible
- Use spread operators or object/array methods that return new instances
- Avoid deep mutations of signal values

### 3. **Use Effects for Side Effects Only**

- DOM updates
- API calls
- Logging
- Local storage updates

### 4. **Batch Related Updates**

- Use `batch()` when updating multiple related signals
- Prevents intermediate computations and UI flicker

### 5. **Handle Cleanup Properly**

- Always dispose effects when components unmount
- Dispose dynamic signals to prevent memory leaks
- Use lifecycle callbacks for expensive resources

## Common Pitfalls for Backend Developers

### 1. **Don't Think in Events**

```javascript
// ❌ Backend/event thinking
user.addEventListener('change', () => {
  updateUI();
});

// ✅ Frontend/reactive thinking
effect(() => {
  updateUI(); // Runs automatically when user changes
});
```

### 2. **Don't Manually Track Dependencies**

```javascript
// ❌ Manual dependency tracking
let dependencies = new Set();
function computeTotal() {
  dependencies.clear();
  // ... complex tracking logic
}

// ✅ Automatic dependency tracking
const total = new Signal.Computed(() => {
  // Dependencies tracked automatically
  return items.get().reduce((sum, item) => sum + item.price, 0);
});
```

### 3. **Don't Over-Engineer State**

```javascript
// ❌ Complex nested state objects
const appState = new Signal.State({
  user: { profile: { settings: { theme: 'dark' } } },
  cart: { items: [], totals: { subtotal: 0, tax: 0, total: 0 } }
});

// ✅ Focused, simple signals
const theme = new Signal.State('dark');
const cartItems = new Signal.State([]);
const cartTotal = new Signal.Computed(() => /* calculate from items */);
```

## Testing Signals

The signals come with a comprehensive test suite. Here's how to test your own signal-based code:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { Signal, effect } from './signals/signals_tc39.js';

describe('User Profile', () => {
  it('should update display name when user status changes', () => {
    const user = new Signal.State({ name: 'John', isOnline: true });
    const displayName = new Signal.Computed(() => {
      const u = user.get();
      return u.isOnline ? `${u.name} (Online)` : u.name;
    });

    expect(displayName.get()).toBe('John (Online)');

    user.set({ name: 'John', isOnline: false });
    expect(displayName.get()).toBe('John');
  });

  it('should trigger effects when state changes', () => {
    const user = new Signal.State({ name: 'John' });
    const spy = vi.fn();

    effect(() => {
      spy(user.get().name);
    });

    expect(spy).toHaveBeenCalledWith('John');

    user.set({ name: 'Jane' });
    expect(spy).toHaveBeenCalledWith('Jane');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
```

## Performance Considerations

### 1. **Signals are Efficient**

- Only recompute when dependencies actually change
- Automatic memoization prevents redundant calculations
- Batched updates reduce DOM thrashing

### 2. **Use peek() for Non-Reactive Reads**

```javascript
const debugInfo = new Signal.Computed(() => {
  // This won't create a dependency on user
  const userData = user.peek();
  return `Debug: ${userData.name}`;
});
```

### 3. **Dispose Unused Signals**

```javascript
// For dynamic components
const dynamicSignal = new Signal.State(data);

// Later when component is removed
dynamicSignal.dispose();
```

## Migration from Other Patterns

### From Manual Event Handling

```javascript
// ❌ Before: Manual events
class UserCard {
  constructor(user) {
    this.user = user;
    this.user.addEventListener('change', this.handleUserChange.bind(this));
  }

  handleUserChange() {
    this.updateDOM();
  }
}

// ✅ After: Reactive signals
class UserCard {
  constructor(userSignal) {
    this.cleanup = effect(() => {
      this.updateDOM(); // Runs automatically
    });
  }
}
```

### From State Management Libraries

```javascript
// ❌ Before: Redux-like patterns
const store = createStore(reducer);
store.subscribe(() => {
  const state = store.getState();
  updateUI(state);
});

// ✅ After: Direct reactive state
const appState = new Signal.State(initialState);
effect(() => {
  updateUI(); // Automatically reactive
});
```

## Conclusion

Signals provide a powerful, intuitive way to manage reactive state in frontend applications. They eliminate the complexity of manual event handling while providing excellent performance through automatic dependency tracking and efficient updates.

Key takeaways for backend developers:

- **Think declaratively** rather than imperatively
- **Trust automatic dependency tracking** instead of manual wiring
- **Focus on data flow** rather than event handling
- **Use effects for side effects**, computed signals for derived state

The signals implementation in this demo app is production-ready and follows the TC39 standard, making it a great foundation for real applications.
