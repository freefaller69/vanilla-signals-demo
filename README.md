# Vanilla Signals Demo

A comprehensive demonstration of TC39-compliant signals for reactive programming in JavaScript. This project showcases how signals enable elegant, efficient frontend applications without complex frameworks.

## 🌟 Features

- **TC39 Compliant**: Follows the official signals proposal specification
- **Production Ready**: Comprehensive error handling, memory management, and performance optimization
- **Zero Dependencies**: Pure JavaScript implementation, no external libraries
- **Fully Tested**: 48 comprehensive test cases covering all functionality
- **Well Documented**: Complete guides for both beginners and experienced developers

## 🚀 Quick Start

### Running the Demo

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Basic Usage

```javascript
import { Signal, effect, batch } from './src/signals/signals_tc39.js';

// Create reactive state
const count = new Signal.State(0);
const doubled = new Signal.Computed(() => count.get() * 2);

// React to changes
effect(() => {
  console.log(`Count: ${count.get()}, Doubled: ${doubled.get()}`);
});

// Update state - effects run automatically
count.set(5); // Logs: "Count: 5, Doubled: 10"
```

## 📚 Documentation

### For Newcomers

- **[Signals Guide](./SIGNALS_GUIDE.md)** - Complete introduction to reactive programming with signals, designed especially for backend engineers transitioning to frontend development

### For Practitioners

- **[Demo Walkthrough](./DEMO_WALKTHROUGH.md)** - Deep dive into the chat application architecture, showing real-world patterns and best practices

### For Reference

- **[API Reference](./API_REFERENCE.md)** - Comprehensive technical documentation of all classes, methods, and APIs

## 🏗️ Architecture

The demo application demonstrates a clean, scalable architecture:

```
src/
├── signals/
│   ├── signals_tc39.js      # TC39-compliant signals implementation
│   └── signals_tc39.test.js # Comprehensive test suite (48 tests)
├── store/
│   └── messageStore.js      # Centralized reactive state management
├── components/
│   ├── MainContent/         # Message display and input
│   ├── Sidebar/            # Thread navigation
│   └── Chat/               # Root component
└── styles/                 # Component-scoped CSS
```

### Key Concepts

1. **Reactive State**: All application state is managed through signals
2. **Automatic Updates**: UI components automatically update when state changes
3. **Performance**: Only necessary computations run, only when needed
4. **Separation of Concerns**: Clear boundaries between state, derived values, and side effects

## 🎯 Core Benefits

### For Development

- **Declarative**: Describe what the UI should look like, not how to update it
- **Automatic**: Dependencies tracked automatically, no manual event handling
- **Efficient**: Only recalculate what's actually changed
- **Debuggable**: Clear data flow and comprehensive error handling

### For Production

- **Memory Safe**: Automatic cleanup prevents leaks
- **Error Resilient**: Isolated failures don't crash the application
- **Performance Optimized**: Batched updates and memoization
- **Framework Agnostic**: Works with any UI library or vanilla JavaScript

## 🧪 Testing

The signals implementation includes comprehensive testing:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run with coverage
pnpm test --coverage
```

**Test Coverage:**

- ✅ Core signal functionality (State, Computed)
- ✅ Effect system with cleanup and error handling
- ✅ Batching and performance optimization
- ✅ Advanced APIs (Signal.subtle namespace)
- ✅ Error handling and edge cases
- ✅ Complex dependency scenarios

## 🔧 API Overview

### Signal.State

```javascript
const count = new Signal.State(0);
count.get(); // Read value
count.set(5); // Update value
count.peek(); // Read without dependency tracking
count.dispose(); // Clean up
```

### Signal.Computed

```javascript
const doubled = new Signal.Computed(() => count.get() * 2);
doubled.get(); // Get computed value
doubled.peek(); // Peek without dependencies
doubled.dispose(); // Clean up
```

### Effects

```javascript
const cleanup = effect(() => {
  console.log('Count changed:', count.get());
  return () => console.log('Cleaning up');
});

cleanup(); // Stop effect
```

### Batching

```javascript
batch(() => {
  state1.set(newValue1);
  state2.set(newValue2);
  // All effects run once after batch
});
```

## 🎨 Demo Application

The included chat application demonstrates:

- **Multiple Components**: Sidebar, main content, and message input
- **Shared State**: All components react to the same signals
- **Real-time Updates**: Messages appear instantly across all UI
- **Performance**: Efficient updates even with complex state

### Live Demo Features

1. **Thread Management**: Switch between conversation threads
2. **Message Sending**: Add messages with automatic timestamp
3. **Live Statistics**: Real-time message counts and thread stats
4. **Responsive UI**: All components stay synchronized automatically

## 🏆 Production Readiness

### Error Handling

- Computation errors are caught and logged
- Effect failures don't crash other effects
- Circular dependency detection prevents infinite loops
- Stack overflow protection with configurable depth limits

### Memory Management

- Automatic cleanup when signals lose subscribers
- Manual disposal for dynamic signals
- Lifecycle callbacks for resource management
- No memory leaks in normal usage patterns

### Performance

- Automatic memoization prevents redundant calculations
- Batched updates reduce DOM thrashing
- Microtask scheduling minimizes event loop pressure
- Efficient change detection with customizable equality

## 🔄 TC39 Compliance

This implementation follows the [TC39 Signals Proposal](https://github.com/tc39/proposal-signals):

- ✅ **Signal.State** and **Signal.Computed** classes
- ✅ **SignalOptions** with custom equality and lifecycle callbacks
- ✅ **Signal.subtle** namespace with introspection APIs
- ✅ **Watcher** for manual observation
- ✅ Full interoperability with other TC39-compliant implementations

### Extensions

Beyond the base proposal, this implementation adds:

- `peek()` method for dependency-free reading
- `batch()` function for performance optimization
- `effect()` function for convenient side effects
- `dispose()` methods for resource cleanup

## 🤝 For Backend Engineers

If you're coming from backend development (especially .NET), signals might seem unfamiliar. Here's the key insight:

**Instead of manually wiring events and callbacks, you describe relationships declaratively, and the system automatically maintains consistency.**

```javascript
// ❌ Manual event handling (complex, error-prone)
class UserService {
  updateUser(user) {
    this.user = user;
    this.notifyComponents('userChanged', user);
    this.updateDatabase(user);
    this.refreshUI();
  }
}

// ✅ Reactive signals (simple, automatic)
const user = new Signal.State(initialUser);

// Components automatically update
effect(() => updateUserDisplay(user.get()));

// Database automatically syncs
effect(() => saveToDatabase(user.get()));

// Just update the signal - everything else happens automatically
user.set(newUserData);
```

## 🔮 Future Enhancements

The demo could be extended with:

- **Persistence**: LocalStorage integration with signals
- **Networking**: WebSocket integration for real-time features
- **Advanced UI**: Drag-and-drop, animations, complex forms
- **Performance Monitoring**: Built-in metrics and debugging tools
- **Framework Integration**: React, Vue, or Svelte adapters

## 📊 Performance Benchmarks

Signals provide excellent performance characteristics:

- **Dependency Tracking**: O(1) for reads, O(n) for updates where n = number of dependents
- **Memory Usage**: Minimal overhead, automatic cleanup
- **Update Efficiency**: Only necessary computations run
- **Batching**: Multiple updates processed in single cycle

## 🤔 When to Use Signals

**Ideal for:**

- Interactive applications with complex state
- Real-time interfaces requiring immediate updates
- Applications where manual event handling becomes unwieldy
- Performance-critical frontends requiring minimal re-computation

**Consider alternatives for:**

- Simple, mostly static interfaces
- Server-side rendering without interactivity
- Applications with very simple state management needs

## 📄 License

MIT License - feel free to use this implementation as a foundation for your own projects.

## 🙏 Contributing

This is a demonstration project, but contributions are welcome:

1. **Bug Reports**: Open an issue with reproduction steps
2. **Feature Requests**: Suggest enhancements or additional examples
3. **Documentation**: Help improve guides and examples
4. **Testing**: Additional test cases for edge scenarios

## 📞 Support

- **Questions**: Review the documentation guides first
- **Issues**: Check existing issues before creating new ones
- **Discussions**: Share how you're using signals in your projects

---

**Ready to build reactive applications?** Start with the [Signals Guide](./SIGNALS_GUIDE.md) to understand the concepts, then explore the [Demo Walkthrough](./DEMO_WALKTHROUGH.md) to see them in action!
