class SignalSystem {
  constructor() {
    this.currentComputation = null;
    this.updateQueue = new Set();
    this.isUpdating = false;
    this.computationStack = [];
    this.computationDepth = 0;
    this.maxComputationDepth = 100;
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

    this.isUpdating = true;
    try {
      let flushCount = 0;
      const maxFlushes = 1000;

      while (this.updateQueue.size > 0 && flushCount < maxFlushes) {
        const updates = Array.from(this.updateQueue);
        this.updateQueue.clear();
        flushCount++;

        updates.forEach((update) => {
          try {
            update();
          } catch (err) {
            console.error('Error in signal update:', err);
          }
        });
      }

      if (flushCount >= maxFlushes) {
        console.error('Maximum flush iterations reached - possible infinite update loop');
        this.updateQueue.clear();
      }
    } finally {
      this.isUpdating = false;
    }
  }

  safeExecute(fn) {
    try {
      return fn();
    } catch (err) {
      console.error('Error in signal computation:', err);
      throw err;
    }
  }

  batch(fn) {
    const wasUpdating = this.isUpdating;
    this.isUpdating = true;

    try {
      const result = fn();
      if (!wasUpdating) {
        this.isUpdating = false;
        this.flushUpdates();
      }
      return result;
    } finally {
      this.isUpdating = wasUpdating;
    }
  }

  removeSubscriber(dep, subscriber) {
    if (dep && dep._subscribers) {
      dep._subscribers.delete(subscriber);

      // Check if signal has no more watchers and trigger unwatched callback
      if (
        dep._subscribers.size === 0 &&
        dep._unwatchedCallbacks &&
        dep._unwatchedCallbacks.size > 0
      ) {
        dep._unwatchedCallbacks.forEach((callback) => {
          try {
            callback.call(dep);
          } catch (err) {
            console.error('Error in unwatched callback:', err);
          }
        });
      }
    }
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

  static State = class State extends Signal {
    constructor(initialValue, options = {}) {
      super();
      this._value = initialValue;
      this._subscribers = new Set();
      this._options = options;
      this._watchedCallbacks = new Set();
      this._unwatchedCallbacks = new Set();

      if (options[Signal.subtle.watched]) {
        this._watchedCallbacks.add(options[Signal.subtle.watched]);
      }

      if (options[Signal.subtle.unwatched]) {
        this._unwatchedCallbacks.add(options[Signal.subtle.unwatched]);
      }
    }

    get() {
      if (defaultSystem.currentComputation) {
        this._subscribers.add(defaultSystem.currentComputation);
        defaultSystem.currentComputation.dependencies.add(this);

        this._watchedCallbacks.forEach((callback) => {
          try {
            callback.call(this);
          } catch (err) {
            console.error('Error in watched callback:', err);
          }
        });
      }
      return this._value;
    }

    set(newValue) {
      const equals = this._options.equals || ((a, b) => a === b);

      if (!equals.call(this, this._value, newValue)) {
        this._value = newValue;
        defaultSystem.scheduleUpdate(this._subscribers);
      }
    }

    peek() {
      return this._value;
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
      this._watchedCallbacks = new Set();
      this._unwatchedCallbacks = new Set();

      if (options[Signal.subtle.watched]) {
        this._watchedCallbacks.add(options[Signal.subtle.watched]);
      }

      if (options[Signal.subtle.unwatched]) {
        this._unwatchedCallbacks.add(options[Signal.subtle.unwatched]);
      }
    }

    get() {
      if (defaultSystem.currentComputation) {
        this._subscribers.add(defaultSystem.currentComputation);
        defaultSystem.currentComputation.dependencies.add(this);

        this._watchedCallbacks.forEach((callback) => {
          try {
            callback.call(this);
          } catch (err) {
            console.error('Error in watched callback:', err);
          }
        });
      }

      if (this._isStale && !this._isComputing) {
        this._computeValue();
      }

      return this._cachedValue;
    }

    peek() {
      if (this._isStale && !this._isComputing) {
        const prevComputation = defaultSystem.currentComputation;
        defaultSystem.currentComputation = null;
        try {
          this._cachedValue = defaultSystem.safeExecute(() => this._callback.call(this));
          this._isStale = false;
        } finally {
          defaultSystem.currentComputation = prevComputation;
        }
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

      try {
        this._cachedValue = defaultSystem.safeExecute(() => this._callback.call(this));
        this._isStale = false;

        oldDependencies.forEach((dep) => {
          if (!this._dependencies.has(dep)) {
            defaultSystem.removeSubscriber(dep, computation);
          }
        });
      } finally {
        defaultSystem.currentComputation = prevComputation;
        defaultSystem.computationStack.pop();
        this._isComputing = false;
        defaultSystem.computationDepth--;
      }
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
                  this._scheduleNotify();
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

                  // Check if signal has no more watchers and trigger unwatched callback
                  if (
                    signal._subscribers.size === 0 &&
                    signal._unwatchedCallbacks &&
                    signal._unwatchedCallbacks.size > 0
                  ) {
                    signal._unwatchedCallbacks.forEach((callback) => {
                      try {
                        callback.call(signal);
                      } catch (err) {
                        console.error('Error in unwatched callback:', err);
                      }
                    });
                  }
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

      _scheduleNotify() {
        if (this._isNotifying) return;

        // Use microtask to batch notifications
        Promise.resolve().then(() => {
          if (this._pendingSignals.size > 0) {
            this._isNotifying = true;
            try {
              this._notify();
            } finally {
              this._pendingSignals.clear();
              this._isNotifying = false;
            }
          }
        });
      }
    },

    untrack(callback) {
      const prevComputation = defaultSystem.currentComputation;
      defaultSystem.currentComputation = null;
      try {
        return callback();
      } finally {
        defaultSystem.currentComputation = prevComputation;
      }
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
    if (cleanup && typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (err) {
        console.error('Error in effect cleanup:', err);
      }
      cleanup = null;
    }

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

    try {
      const result = fn();
      if (typeof result === 'function') {
        cleanup = result;
      }

      // Watch all accessed signals
      if (dependencies.size > 0) {
        watcher.watch(...Array.from(dependencies));
      }
    } catch (err) {
      console.error('Error in effect:', err);
    } finally {
      defaultSystem.currentComputation = prevComputation;
    }
  }

  // Initial run
  runEffect();

  // Return disposal function
  return () => {
    isActive = false;
    if (cleanup && typeof cleanup === 'function') {
      try {
        cleanup();
      } catch (err) {
        console.error('Error in effect cleanup:', err);
      }
    }
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
