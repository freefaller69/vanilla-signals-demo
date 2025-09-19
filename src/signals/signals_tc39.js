// Centralized error handling utilities
class ErrorHandler {
  static safeExecute(fn, context, continueOnError = true) {
    try {
      return fn();
    } catch (err) {
      console.error(`Error in ${context}:`, err);
      if (!continueOnError) throw err;
    }
  }

  static withContextIsolation(setup, operation, teardown) {
    const context = setup();
    try {
      return operation();
    } finally {
      teardown(context);
    }
  }

  static safeForEach(collection, fn, context) {
    collection.forEach((item) => {
      this.safeExecute(() => fn(item), `${context} iteration`);
    });
  }

  static withCleanup(operation, cleanup) {
    try {
      return operation();
    } finally {
      if (cleanup) cleanup();
    }
  }
}

class SignalSystem {
  constructor() {
    this.currentComputation = null;
    this.updateQueue = new Set();
    this.isUpdating = false;
    this.computationStack = [];
    this.computationDepth = 0;
    this.maxComputationDepth = 100;

    // Shared microtask scheduler for Watcher notifications
    this.watcherNotificationQueue = new Set();
    this.isWatcherNotificationScheduled = false;
  }

  scheduleUpdate(subscribers) {
    subscribers.forEach((sub) => {
      if (typeof sub === 'function') {
        this.updateQueue.add(sub);
      } else if (sub.invalidate) {
        this.updateQueue.add(sub.invalidate);
      }
    });

    if (!this.isUpdating) {
      this.flushUpdates();
    }
  }

  flushUpdates() {
    if (this.isUpdating) return;

    ErrorHandler.withCleanup(
      () => {
        this.isUpdating = true;
        let flushCount = 0;
        const maxFlushes = 1000;

        while (this.updateQueue.size > 0 && flushCount < maxFlushes) {
          const updates = Array.from(this.updateQueue);
          this.updateQueue.clear();
          flushCount++;

          ErrorHandler.safeForEach(updates, (update) => update(), 'signal update');
        }

        if (flushCount >= maxFlushes) {
          console.error('Maximum flush iterations reached - possible infinite update loop');
          this.updateQueue.clear();
        }
      },
      () => {
        this.isUpdating = false;
      }
    );
  }

  safeExecute(fn) {
    return ErrorHandler.safeExecute(fn, 'signal computation', false);
  }

  batch(fn) {
    const wasUpdating = this.isUpdating;

    return ErrorHandler.withCleanup(
      () => {
        this.isUpdating = true;
        const result = fn();
        if (!wasUpdating) {
          this.isUpdating = false;
          this.flushUpdates();
        }
        return result;
      },
      () => {
        this.isUpdating = wasUpdating;
      }
    );
  }

  removeSubscriber(dep, subscriber) {
    if (dep && dep._subscribers) {
      dep._subscribers.delete(subscriber);
      Signal._triggerUnwatchedCallbacks(dep);
    }
  }

  scheduleWatcherNotification(watcher) {
    this.watcherNotificationQueue.add(watcher);

    if (!this.isWatcherNotificationScheduled) {
      this.isWatcherNotificationScheduled = true;

      // Use a single microtask to batch all watcher notifications
      Promise.resolve().then(() => {
        this.flushWatcherNotifications();
      });
    }
  }

  flushWatcherNotifications() {
    if (this.watcherNotificationQueue.size === 0) {
      this.isWatcherNotificationScheduled = false;
      return;
    }

    const watchers = Array.from(this.watcherNotificationQueue);
    this.watcherNotificationQueue.clear();
    this.isWatcherNotificationScheduled = false;

    ErrorHandler.safeForEach(
      watchers,
      (watcher) => {
        if (watcher._pendingSignals.size > 0 && !watcher._isNotifying) {
          ErrorHandler.withCleanup(
            () => {
              watcher._isNotifying = true;
              watcher._notify();
            },
            () => {
              watcher._pendingSignals.clear();
              watcher._isNotifying = false;
            }
          );
        }
      },
      'watcher notification'
    );
  }
}

const defaultSystem = new SignalSystem();

class Signal {
  constructor() {
    if (new.target === Signal) {
      throw new TypeError('Signal is an abstract class and cannot be instantiated directly');
    }
  }

  get() {
    throw new Error('get() must be implemented by subclass');
  }

  // Shared utility methods
  _initializeLifecycleCallbacks(options) {
    this._watchedCallbacks = new Set();
    this._unwatchedCallbacks = new Set();

    if (options[Signal.subtle.watched]) {
      this._watchedCallbacks.add(options[Signal.subtle.watched]);
    }

    if (options[Signal.subtle.unwatched]) {
      this._unwatchedCallbacks.add(options[Signal.subtle.unwatched]);
    }
  }

  _trackDependency() {
    if (defaultSystem.currentComputation) {
      this._subscribers.add(defaultSystem.currentComputation);
      defaultSystem.currentComputation.dependencies.add(this);

      this._watchedCallbacks.forEach((callback) => {
        this._safeExecuteCallback(callback, 'watched callback');
      });
    }
  }

  _clearLifecycleCallbacks() {
    if (this._subscribers) {
      this._subscribers.clear();
    }
    if (this._watchedCallbacks) {
      this._watchedCallbacks.clear();
    }
    if (this._unwatchedCallbacks) {
      this._unwatchedCallbacks.clear();
    }
  }

  _safeExecuteCallback(callback, context) {
    ErrorHandler.safeExecute(() => callback.call(this), context);
  }

  static _triggerUnwatchedCallbacks(signal) {
    if (
      signal._subscribers.size === 0 &&
      signal._unwatchedCallbacks &&
      signal._unwatchedCallbacks.size > 0
    ) {
      ErrorHandler.safeForEach(
        signal._unwatchedCallbacks,
        (callback) => callback.call(signal),
        'unwatched callback'
      );
    }
  }

  static _safeCleanup(cleanupFn, context) {
    if (cleanupFn && typeof cleanupFn === 'function') {
      ErrorHandler.safeExecute(cleanupFn, context);
    }
  }

  static State = class State extends Signal {
    constructor(initialValue, options = {}) {
      super();
      this._value = initialValue;
      this._subscribers = new Set();
      this._options = options;
      this._initializeLifecycleCallbacks(options);
    }

    get() {
      if (this._disposed) {
        throw new Error('Cannot access disposed signal');
      }

      this._trackDependency();
      return this._value;
    }

    set(newValue) {
      if (this._disposed) {
        throw new Error('Cannot set value on disposed signal');
      }

      const equals = this._options.equals || ((a, b) => a === b);

      if (!equals.call(this, this._value, newValue)) {
        this._value = newValue;
        defaultSystem.scheduleUpdate(this._subscribers);
      }
    }

    peek() {
      return this._value;
    }

    dispose() {
      this._clearLifecycleCallbacks();
      this._value = undefined;
      this._disposed = true;
    }
  };

  static Computed = class Computed extends Signal {
    constructor(callback, options = {}) {
      super();
      this._callback = callback;
      this._subscribers = new Set();
      this._dependencies = new Set();
      this._options = options;
      this._isStale = true;
      this._cachedValue = undefined;
      this._isComputing = false;
      this._initializeLifecycleCallbacks(options);
    }

    get() {
      if (this._disposed) {
        throw new Error('Cannot access disposed computed signal');
      }

      this._trackDependency();

      if (this._isStale && !this._isComputing) {
        this._computeValue();
      }

      return this._cachedValue;
    }

    peek() {
      if (this._isStale && !this._isComputing) {
        ErrorHandler.withContextIsolation(
          () => {
            const prev = defaultSystem.currentComputation;
            defaultSystem.currentComputation = null;
            return prev;
          },
          () => {
            this._cachedValue = defaultSystem.safeExecute(() => this._callback.call(this));
            this._isStale = false;
          },
          (prevComputation) => {
            defaultSystem.currentComputation = prevComputation;
          }
        );
      }
      return this._cachedValue;
    }

    _computeValue() {
      if (this._isComputing) {
        throw new Error('Circular dependency detected in computed signal');
      }

      // Check for stack depth before starting computation
      defaultSystem.computationDepth++;
      if (defaultSystem.computationDepth > defaultSystem.maxComputationDepth) {
        defaultSystem.computationDepth--;
        throw new Error(
          `Maximum computation depth of ${defaultSystem.maxComputationDepth} exceeded - possible infinite recursion`
        );
      }

      // Check for actual circular dependency by looking for this signal in the computation stack
      const isAlreadyComputing = defaultSystem.computationStack.some(
        (comp) => comp.signal === this
      );
      if (isAlreadyComputing) {
        defaultSystem.computationDepth--;
        throw new Error('Circular dependency detected in computed signal');
      }

      this._isComputing = true;
      const prevComputation = defaultSystem.currentComputation;
      const oldDependencies = this._dependencies;
      this._dependencies = new Set();

      const computation = {
        dependencies: this._dependencies,
        signal: this,
        invalidate: () => {
          this._isStale = true;
          defaultSystem.scheduleUpdate(this._subscribers);
        },
      };

      defaultSystem.currentComputation = computation;
      defaultSystem.computationStack.push(computation);

      ErrorHandler.withCleanup(
        () => {
          this._cachedValue = defaultSystem.safeExecute(() => this._callback.call(this));
          this._isStale = false;

          oldDependencies.forEach((dep) => {
            if (!this._dependencies.has(dep)) {
              defaultSystem.removeSubscriber(dep, computation);
            }
          });
        },
        () => {
          defaultSystem.currentComputation = prevComputation;
          defaultSystem.computationStack.pop();
          this._isComputing = false;
          defaultSystem.computationDepth--;
        }
      );
    }

    dispose() {
      // Clean up dependencies first
      this._dependencies.forEach((dep) => defaultSystem.removeSubscriber(dep, this));
      this._dependencies.clear();

      this._clearLifecycleCallbacks();

      // Clear computation state
      this._callback = null;
      this._cachedValue = undefined;
      this._disposed = true;
    }
  };

  static subtle = {
    watched: Symbol('Signal.subtle.watched'),
    unwatched: Symbol('Signal.subtle.unwatched'),

    Watcher: class Watcher {
      constructor(notify) {
        this._notify = notify;
        this._watchedSignals = new Set();
        this._pendingSignals = new Set();
        this._isNotifying = false;
      }

      watch(...signals) {
        signals.forEach((signal) => {
          if (!this._watchedSignals.has(signal)) {
            this._watchedSignals.add(signal);

            // Add this watcher as a subscriber to the signal
            if (signal._subscribers) {
              const watcherCallback = () => {
                this._pendingSignals.add(signal);
                if (!this._isNotifying) {
                  defaultSystem.scheduleWatcherNotification(this);
                }
              };
              watcherCallback._watcher = this;
              signal._subscribers.add(watcherCallback);
            }
          }
        });
      }

      unwatch(...signals) {
        signals.forEach((signal) => {
          if (this._watchedSignals.has(signal)) {
            this._watchedSignals.delete(signal);
            this._pendingSignals.delete(signal);

            // Remove this watcher from signal's subscribers
            if (signal._subscribers) {
              for (const subscriber of signal._subscribers) {
                if (subscriber._watcher === this) {
                  signal._subscribers.delete(subscriber);
                  Signal._triggerUnwatchedCallbacks(signal);
                  break;
                }
              }
            }
          }
        });
      }

      getPending() {
        return Array.from(this._pendingSignals);
      }
    },

    untrack(callback) {
      return ErrorHandler.withContextIsolation(
        () => {
          const prev = defaultSystem.currentComputation;
          defaultSystem.currentComputation = null;
          return prev;
        },
        callback,
        (prevComputation) => {
          defaultSystem.currentComputation = prevComputation;
        }
      );
    },

    currentComputed() {
      return defaultSystem.currentComputation;
    },

    introspectSources(signal) {
      if (signal instanceof Signal.Computed) {
        return Array.from(signal._dependencies);
      }
      return [];
    },

    introspectSinks(signal) {
      if (signal._subscribers) {
        return Array.from(signal._subscribers)
          .map((sub) => {
            if (sub.invalidate) {
              return defaultSystem.computationStack.find(
                (comp) => comp.invalidate === sub.invalidate
              );
            }
            return sub;
          })
          .filter(Boolean);
      }
      return [];
    },
  };
}

function batch(fn) {
  return defaultSystem.batch(fn);
}

function effect(fn) {
  let cleanup = null;
  let isActive = true;
  let dependencies = new Set();

  const watcher = new Signal.subtle.Watcher(() => {
    if (isActive) {
      runEffect();
    }
  });

  function runEffect() {
    // Clean up previous run
    Signal._safeCleanup(cleanup, 'effect cleanup');
    cleanup = null;

    // Unwatch old dependencies
    if (dependencies.size > 0) {
      watcher.unwatch(...Array.from(dependencies));
    }
    dependencies.clear();

    // Track new dependencies
    const prevComputation = defaultSystem.currentComputation;
    const computation = {
      dependencies,
      invalidate: () => {}, // Effects don't need invalidation
    };
    defaultSystem.currentComputation = computation;

    ErrorHandler.withCleanup(
      () => {
        ErrorHandler.safeExecute(() => {
          const result = fn();
          if (typeof result === 'function') {
            cleanup = result;
          }
        }, 'effect');

        // Watch all accessed signals
        if (dependencies.size > 0) {
          watcher.watch(...Array.from(dependencies));
        }
      },
      () => {
        defaultSystem.currentComputation = prevComputation;
      }
    );
  }

  // Initial run
  runEffect();

  // Return disposal function
  return () => {
    isActive = false;
    Signal._safeCleanup(cleanup, 'effect cleanup');
    if (dependencies.size > 0) {
      watcher.unwatch(...Array.from(dependencies));
    }
    dependencies.clear();
  };
}

export { Signal, batch, effect };

if (typeof window !== 'undefined') {
  window.Signal = Signal;
  window.batch = batch;
  window.effect = effect;
}
