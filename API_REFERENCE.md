# Signals API Reference

This document provides comprehensive API documentation for the TC39-compliant signals implementation. It's designed for developers who need detailed technical information about the signals system.

## Table of Contents

- [Core Classes](#core-classes)
- [Signal Options](#signal-options)
- [Signal.subtle Namespace](#signalsubtle-namespace)
- [Extension Functions](#extension-functions)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)

## Core Classes

### Signal (Abstract Base Class)

The base class for all signal types. Cannot be instantiated directly.

```javascript
// ❌ This will throw
const signal = new Signal(); // TypeError: Signal is an abstract class

// ✅ Use concrete implementations
const state = new Signal.State(value);
const computed = new Signal.Computed(callback);
```

#### Abstract Methods

- **`get(): T`** - Must be implemented by subclasses to return the signal's current value

---

### Signal.State<T>

Represents mutable state that can be read and written.

#### Constructor

```typescript
new Signal.State<T>(initialValue: T, options?: SignalOptions<T>)
```

**Parameters:**

- `initialValue: T` - The initial value of the signal
- `options?: SignalOptions<T>` - Optional configuration object

**Example:**

```javascript
const count = new Signal.State(0);
const user = new Signal.State(
  { id: 1, name: 'John' },
  {
    equals: (a, b) => a.id === b.id, // Custom equality
  }
);
```

#### Methods

##### `get(): T`

Returns the current value and establishes a dependency if called within a computation.

```javascript
const count = new Signal.State(42);
console.log(count.get()); // 42

// Within a computed signal, this creates a dependency
const doubled = new Signal.Computed(() => count.get() * 2);
```

**Returns:** The current value of the signal

**Side Effects:** Registers the calling computation as a dependent

##### `set(value: T): void`

Updates the signal's value. Only triggers updates if the new value is different according to the equality function.

```javascript
const count = new Signal.State(0);
count.set(5); // Triggers dependent updates
count.set(5); // No effect - value unchanged
```

**Parameters:**

- `value: T` - The new value to set

**Side Effects:**

- Updates internal value
- Schedules updates for all dependent computations
- Calls lifecycle callbacks if configured

##### `peek(): T`

Returns the current value without establishing a dependency.

```javascript
const count = new Signal.State(42);

const computed = new Signal.Computed(() => {
  // This creates a dependency
  const a = count.get();

  // This does NOT create a dependency
  const b = count.peek();

  return a + b;
});
```

**Returns:** The current value

**Use Cases:**

- Debugging without affecting dependencies
- Conditional logic based on signal values
- Reading values in effect cleanup functions

##### `dispose(): void`

Permanently disposes the signal and prevents further access.

```javascript
const count = new Signal.State(42);
count.dispose();

console.log(count.get()); // Error: Cannot access disposed signal
count.set(100); // Error: Cannot set value on disposed signal
```

**Side Effects:**

- Clears all subscribers and callbacks
- Marks signal as disposed
- Subsequent access throws errors

---

### Signal.Computed<T>

Represents derived state that automatically recalculates when dependencies change.

#### Constructor

```typescript
new Signal.Computed<T>(callback: () => T, options?: SignalOptions<T>)
```

**Parameters:**

- `callback: () => T` - Function that computes the value
- `options?: SignalOptions<T>` - Optional configuration object

**Example:**

```javascript
const firstName = new Signal.State('John');
const lastName = new Signal.State('Doe');

const fullName = new Signal.Computed(() => {
  return `${firstName.get()} ${lastName.get()}`;
});
```

#### Methods

##### `get(): T`

Returns the computed value, recalculating if dependencies have changed.

```javascript
const count = new Signal.State(5);
const doubled = new Signal.Computed(() => count.get() * 2);

console.log(doubled.get()); // 10
count.set(10);
console.log(doubled.get()); // 20 - automatically recalculated
```

**Returns:** The computed value

**Behavior:**

- Returns cached value if dependencies haven't changed
- Recalculates if any dependency has changed
- Establishes dependencies with other signals during computation

##### `peek(): T`

Returns the computed value without establishing a dependency, recalculating if stale.

```javascript
const count = new Signal.State(5);
const doubled = new Signal.Computed(() => count.get() * 2);

// In another computed signal
const debug = new Signal.Computed(() => {
  // This won't make debug depend on doubled
  return `Debug: ${doubled.peek()}`;
});
```

**Returns:** The computed value

##### `dispose(): void`

Disposes the computed signal and cleans up all dependencies.

```javascript
const computed = new Signal.Computed(() => someState.get() * 2);
computed.dispose();

console.log(computed.get()); // Error: Cannot access disposed computed signal
```

**Side Effects:**

- Removes itself from all dependency signals
- Clears internal state and callbacks
- Triggers unwatched callbacks on dependencies if appropriate

---

## Signal Options

Configuration object for customizing signal behavior.

```typescript
interface SignalOptions<T> {
  equals?: (a: T, b: T) => boolean;
  [Signal.subtle.watched]?: () => void;
  [Signal.subtle.unwatched]?: () => void;
}
```

### Properties

#### `equals?: (a: T, b: T) => boolean`

Custom function to determine if two values are equal. Used to prevent unnecessary updates.

**Default:** `(a, b) => a === b` (strict equality)

**Examples:**

```javascript
// Object comparison by ID
const user = new Signal.State(userObj, {
  equals: (a, b) => a.id === b.id,
});

// Deep equality for arrays
const items = new Signal.State([], {
  equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

// Numeric tolerance
const temperature = new Signal.State(20.0, {
  equals: (a, b) => Math.abs(a - b) < 0.1,
});
```

#### Lifecycle Callbacks

Special symbol-keyed properties for lifecycle events.

##### `[Signal.subtle.watched]?: () => void`

Called when the signal gains its first subscriber.

```javascript
const expensiveData = new Signal.State(null, {
  [Signal.subtle.watched]() {
    console.log('Started watching - begin polling');
    this.pollInterval = setInterval(() => {
      // Update data from server
    }, 1000);
  },
});
```

##### `[Signal.subtle.unwatched]?: () => void`

Called when the signal loses its last subscriber.

```javascript
const expensiveData = new Signal.State(null, {
  [Signal.subtle.unwatched]() {
    console.log('No more watchers - stop polling');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  },
});
```

---

## Signal.subtle Namespace

Advanced APIs for introspection and fine-grained control.

### Classes

#### Signal.subtle.Watcher

Allows manual observation of signal changes with batched notifications.

##### Constructor

```typescript
new Signal.subtle.Watcher(notify: () => void)
```

**Parameters:**

- `notify: () => void` - Callback function called when watched signals change

**Example:**

```javascript
const watcher = new Signal.subtle.Watcher(() => {
  console.log('Signals changed:', watcher.getPending());
});

watcher.watch(signal1, signal2);
```

##### Methods

###### `watch(...signals: Signal[]): void`

Start watching the specified signals for changes.

```javascript
const watcher = new Signal.subtle.Watcher(() => {
  const pending = watcher.getPending();
  pending.forEach((signal) => {
    console.log('Signal changed:', signal);
  });
});

watcher.watch(userSignal, cartSignal);
```

###### `unwatch(...signals: Signal[]): void`

Stop watching the specified signals.

```javascript
watcher.unwatch(userSignal); // Stop watching userSignal only
watcher.unwatch(); // Stop watching all signals
```

###### `getPending(): Signal[]`

Returns an array of signals that have changed since the last notification.

```javascript
const watcher = new Signal.subtle.Watcher(() => {
  const changed = watcher.getPending();
  changed.forEach((signal) => {
    // Handle each changed signal
    updateUI(signal);
  });
});
```

### Utility Functions

#### `Signal.subtle.untrack<T>(callback: () => T): T`

Executes a callback without tracking dependencies.

```javascript
const count = new Signal.State(5);
const computed = new Signal.Computed(() => {
  // This creates a dependency on count
  const tracked = count.get();

  // This does NOT create a dependency
  const untracked = Signal.subtle.untrack(() => count.get());

  return tracked; // Only depends on the tracked read
});
```

**Parameters:**

- `callback: () => T` - Function to execute without dependency tracking

**Returns:** The result of the callback

**Use Cases:**

- Reading signals for logging/debugging
- Conditional logic that shouldn't affect dependencies
- Reading configuration values

#### `Signal.subtle.currentComputed(): Computation | null`

Returns the currently executing computation, if any.

```javascript
const debug = new Signal.Computed(() => {
  const current = Signal.subtle.currentComputed();
  console.log('Computing:', current?.signal);
  return someCalculation();
});
```

**Returns:** The current computation object or `null` if not in a computation

#### `Signal.subtle.introspectSources(signal: Signal): Signal[]`

Returns the signals that the given computed signal depends on.

```javascript
const a = new Signal.State(1);
const b = new Signal.State(2);
const sum = new Signal.Computed(() => a.get() + b.get());

const dependencies = Signal.subtle.introspectSources(sum);
console.log(dependencies); // [a, b]
```

**Parameters:**

- `signal: Signal` - The signal to introspect

**Returns:** Array of dependency signals (empty for state signals)

#### `Signal.subtle.introspectSinks(signal: Signal): Computation[]`

Returns the computations that depend on the given signal.

```javascript
const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);
const tripled = new Signal.Computed(() => count.get() * 3);

const dependents = Signal.subtle.introspectSinks(count);
console.log(dependents.length); // 2
```

**Parameters:**

- `signal: Signal` - The signal to introspect

**Returns:** Array of dependent computations

---

## Extension Functions

Convenience functions that build on the core signal primitives.

### `batch<T>(fn: () => T): T`

Batches multiple signal updates to prevent intermediate computations.

```javascript
const firstName = new Signal.State('John');
const lastName = new Signal.State('Doe');
const fullName = new Signal.Computed(() => `${firstName.get()} ${lastName.get()}`);

// Without batching: fullName computes twice
firstName.set('Jane');
lastName.set('Smith');

// With batching: fullName computes once
batch(() => {
  firstName.set('Jane');
  lastName.set('Smith');
});
```

**Parameters:**

- `fn: () => T` - Function containing signal updates

**Returns:** The result of the function

**Performance:** Significantly improves performance when updating multiple related signals.

### `effect(fn: () => (void | (() => void))): () => void`

Creates a side effect that runs when its dependencies change.

```javascript
const count = new Signal.State(0);

const cleanup = effect(() => {
  console.log('Count is now:', count.get());

  // Optional cleanup function
  return () => {
    console.log('Effect is re-running');
  };
});

count.set(5); // Logs: "Effect is re-running" then "Count is now: 5"

// Don't forget to clean up
cleanup();
```

**Parameters:**

- `fn: () => (void | (() => void))` - Effect function that optionally returns a cleanup function

**Returns:** Function to dispose the effect

**Behavior:**

- Runs immediately when created
- Re-runs when any accessed signal changes
- Calls cleanup function before re-running
- Uses `Signal.subtle.Watcher` internally for efficient notifications

---

## Type Definitions

### Computation

Internal representation of a computation context.

```typescript
interface Computation {
  dependencies: Set<Signal>;
  signal?: Signal.Computed;
  invalidate: () => void;
}
```

### SignalSystem

Internal system managing signal updates and scheduling.

```typescript
interface SignalSystem {
  currentComputation: Computation | null;
  updateQueue: Set<() => void>;
  isUpdating: boolean;
  computationStack: Computation[];
  computationDepth: number;
  maxComputationDepth: number;
}
```

---

## Error Handling

The signals system includes comprehensive error handling to prevent cascading failures.

### Computation Errors

Errors in computed signal callbacks are caught and logged:

```javascript
const problematic = new Signal.Computed(() => {
  throw new Error('Something went wrong');
});

// Error is caught and logged, doesn't crash the app
try {
  problematic.get();
} catch (error) {
  console.log('Computation failed:', error.message);
}
```

### Effect Errors

Errors in effects are isolated and don't affect other effects:

```javascript
effect(() => {
  throw new Error('Effect 1 failed');
});

effect(() => {
  console.log('Effect 2 still runs'); // This runs normally
});
```

### Circular Dependency Detection

The system detects and prevents circular dependencies:

```javascript
let a, b;
a = new Signal.Computed(() => b.get() + 1);
b = new Signal.Computed(() => a.get() + 1);

a.get(); // Error: Circular dependency detected
```

### Stack Overflow Protection

Computation depth is limited to prevent stack overflow:

```javascript
// This will throw before causing stack overflow
const deep = new Signal.Computed(() => {
  // Create deeply nested computation chain
  return createNestedComputation(150); // Exceeds max depth
});

deep.get(); // Error: Maximum computation depth exceeded
```

---

## Performance Considerations

### Memoization

- Computed signals cache their values until dependencies change
- Use custom `equals` functions to optimize object comparisons
- `peek()` doesn't create dependencies, reducing computation overhead

### Batching

- Use `batch()` when updating multiple related signals
- Batching prevents intermediate computations and UI updates
- Nested batching is supported and efficient

### Memory Management

- Dispose signals and effects when no longer needed
- Lifecycle callbacks help manage expensive resources
- Automatic cleanup prevents memory leaks in most cases

### Microtask Optimization

- Watcher notifications are batched into single microtasks
- Reduces pressure on the event loop under heavy updates
- Multiple signal changes trigger only one notification cycle

### Best Practices

1. **Use specific equality functions** for objects to prevent unnecessary updates
2. **Dispose dynamic signals** to prevent memory leaks
3. **Batch related updates** for optimal performance
4. **Use `peek()` for debugging** to avoid creating dependencies
5. **Keep computations simple** to minimize recalculation overhead

---

## Examples

### Custom Equality

```javascript
// For objects, compare by key properties
const user = new Signal.State(userObject, {
  equals: (a, b) => a.id === b.id && a.version === b.version,
});

// For arrays, use appropriate comparison
const items = new Signal.State([], {
  equals: (a, b) => a.length === b.length && a.every((item, i) => item.id === b[i].id),
});
```

### Resource Management

```javascript
const websocketData = new Signal.State(null, {
  [Signal.subtle.watched]() {
    this.socket = new WebSocket('ws://example.com');
    this.socket.onmessage = (event) => {
      this.set(JSON.parse(event.data));
    };
  },
  [Signal.subtle.unwatched]() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  },
});
```

### Complex Computations

```javascript
const searchResults = new Signal.Computed(() => {
  const query = searchQuery.get();
  const filters = searchFilters.get();
  const data = allData.get();

  if (!query.trim()) return [];

  return data
    .filter((item) => matchesQuery(item, query))
    .filter((item) => matchesFilters(item, filters))
    .sort((a, b) => calculateRelevance(b, query) - calculateRelevance(a, query))
    .slice(0, 50); // Limit results
});
```

This API reference provides complete documentation for building robust, performant applications with the signals system.
