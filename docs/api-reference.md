# TC39 Signals API Reference

## Core Signal Classes

### Signal.State

Represents a mutable signal that can be read and written.

```javascript
const count = new Signal.State(0);
count.set(5);
console.log(count.get()); // 5
```

#### Constructor

```javascript
new Signal.State(initialValue, options?)
```

**Parameters:**

- `initialValue: any` - The initial value of the signal
- `options?: SignalOptions` - Optional configuration

#### Methods

##### `get(): T`

Returns the current value and tracks dependency if called within a computation.

##### `set(value: T): void`

Updates the signal value. Only triggers updates if the new value is different (using custom `equals` or `===`).

##### `peek(): T`

Returns the current value without tracking dependency.

##### `dispose(): void`

Cleans up the signal and prevents further access.

### Signal.Computed

Represents a derived signal that automatically recomputes when dependencies change.

```javascript
const doubled = new Signal.Computed(() => count.get() * 2);
console.log(doubled.get()); // Auto-updates when count changes
```

#### Constructor

```javascript
new Signal.Computed(callback, options?)
```

**Parameters:**

- `callback: () => T` - Function that computes the value
- `options?: SignalOptions` - Optional configuration

#### Methods

##### `get(): T`

Returns the computed value, recalculating if stale.

##### `peek(): T`

Returns the computed value without tracking dependency.

##### `dispose(): void`

Cleans up the computed signal and all its dependencies.

## SignalOptions

Configuration object for customizing signal behavior.

```javascript
interface SignalOptions<T> {
  equals?: (a: T, b: T) => boolean;
  [Signal.subtle.watched]?: () => void;
  [Signal.subtle.unwatched]?: () => void;
}
```

### Properties

#### `equals?: (a: T, b: T) => boolean`

Custom comparison function to determine if values are equal.

```javascript
const obj = new Signal.State(
  { id: 1 },
  {
    equals: (a, b) => a.id === b.id,
  }
);
```

#### Lifecycle Callbacks

```javascript
const signal = new Signal.State(0, {
  [Signal.subtle.watched]: () => console.log('Being watched'),
  [Signal.subtle.unwatched]: () => console.log('No more watchers'),
});
```

## Signal.subtle Namespace

Advanced features for framework authors and power users.

### Signal.subtle.Watcher

Observes changes across multiple signals.

```javascript
const watcher = new Signal.subtle.Watcher(() => {
  console.log('Signals changed!');
});

watcher.watch(signal1, signal2);
// Changes to either signal trigger the callback
```

#### Constructor

```javascript
new Signal.subtle.Watcher(notify: () => void)
```

#### Methods

##### `watch(...signals: Signal[]): void`

Start watching the specified signals.

##### `unwatch(...signals: Signal[]): void`

Stop watching the specified signals.

##### `getPending(): Signal[]`

Returns signals that have pending changes.

### Utility Functions

#### `Signal.subtle.untrack(callback: () => T): T`

Executes callback without tracking dependencies.

```javascript
const result = Signal.subtle.untrack(() => {
  return someSignal.get(); // Won't create dependency
});
```

#### `Signal.subtle.currentComputed(): Computation | null`

Returns the current computation context, if any.

#### `Signal.subtle.introspectSources(signal: Signal): Signal[]`

Returns the dependencies of a computed signal.

#### `Signal.subtle.introspectSinks(signal: Signal): Computation[]`

Returns the computations that depend on a signal.

## Extension Functions

### batch(fn: () => T): T

Groups multiple signal updates into a single notification cycle.

```javascript
batch(() => {
  signal1.set(1);
  signal2.set(2);
  signal3.set(3);
}); // All updates happen together
```

### effect(fn: () => (() => void) | void): (() => void)

Creates a side effect that runs when dependencies change.

```javascript
const dispose = effect(() => {
  console.log('Count is:', count.get());

  // Optional cleanup function
  return () => console.log('Cleaning up');
});

// Later: dispose();
```

## Usage Examples

### Basic Counter

```javascript
import { Signal } from './signals/signals_tc39.js';

const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);

console.log(doubled.get()); // 0
count.set(5);
console.log(doubled.get()); // 10
```

### Custom Equality

```javascript
const user = new Signal.State(
  { name: 'John', age: 30 },
  {
    equals: (a, b) => a.name === b.name && a.age === b.age,
  }
);

const greeting = new Signal.Computed(() => `Hello, ${user.get().name}!`);
```

### Effect with Cleanup

```javascript
const dispose = effect(() => {
  const element = document.getElementById('counter');
  element.textContent = count.get();

  return () => {
    element.textContent = '';
  };
});
```

### Batched Updates

```javascript
import { batch } from './signals/signals_tc39.js';

batch(() => {
  firstName.set('Jane');
  lastName.set('Doe');
  age.set(25);
}); // Single update notification
```

## Error Handling

All signal operations include comprehensive error handling:

- **Disposed signals** throw clear error messages
- **Circular dependencies** are detected and prevented
- **Stack overflow protection** with configurable depth limits
- **Safe callback execution** with error isolation

## Performance Considerations

- **Lazy evaluation**: Computed signals only recalculate when accessed
- **Memoization**: Values are cached until dependencies change
- **Batched updates**: Use `batch()` for multiple simultaneous changes
- **Microtask optimization**: Shared scheduling reduces overhead
- **Memory management**: Use `dispose()` for dynamic signals
