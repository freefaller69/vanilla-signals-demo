class SignalSystem {
  constructor() {
    this.currentComputation = null;
    this.updateQueue = new Set();
    this.isUpdating = false;
    this.computationStack = [];
  }

  // 🆕 Utility to remove a subscriber from a dependency
  removeSubscriber(dep, subscriber) {
    if (dep && dep._subscribers) {
      dep._subscribers.delete(subscriber);
    }
  }

  createSignal(initialValue) {
    const subscribers = new Set();
    let value = initialValue;

    const signal = {
      get: () => {
        if (this.currentComputation) {
          subscribers.add(this.currentComputation);
          this.currentComputation.dependencies.add(signal);
        }
        return value;
      },

      set: (newValue) => {
        if (value !== newValue) {
          value = newValue;
          this.scheduleUpdate(subscribers);
        }
      },

      peek: () => value,

      destroy: () => subscribers.clear(),

      _subscribers: subscribers,
      _isSignal: true,
    };

    return signal;
  }

  createComputed(fn) {
    const subscribers = new Set();
    let isStale = true;
    let cachedValue;
    let isComputing = false;
    let dependencies = new Set();

    const invalidate = () => {
      isStale = true;
      this.scheduleUpdate(subscribers);
    };

    const computed = {
      get: () => {
        if (isComputing) {
          throw new Error('Circular dependency detected in computed signal');
        }

        if (this.currentComputation) {
          subscribers.add(this.currentComputation);
          this.currentComputation.dependencies.add(computed);
        }

        if (isStale && !isComputing) {
          computed.computeValue();
        }

        return cachedValue;
      },

      peek: () => {
        if (isStale && !isComputing) {
          const prevComputation = this.currentComputation;
          this.currentComputation = null;
          try {
            cachedValue = this.safeExecute(fn);
            isStale = false;
          } finally {
            this.currentComputation = prevComputation;
          }
        }
        return cachedValue;
      },

      computeValue: () => {
        if (isComputing) {
          throw new Error('Circular dependency detected in computed signal');
        }

        isComputing = true;
        const prevComputation = this.currentComputation;
        const oldDependencies = dependencies;
        dependencies = new Set();

        const computation = {
          dependencies,
          invalidate,
        };

        this.currentComputation = computation;
        this.computationStack.push(computation);

        try {
          this.detectCycle();
          cachedValue = this.safeExecute(fn);
          isStale = false;

          // 🆕 Use helper for old dependency cleanup
          oldDependencies.forEach((dep) => {
            if (!dependencies.has(dep)) {
              this.removeSubscriber(dep, computation);
            }
          });
        } finally {
          this.currentComputation = prevComputation;
          this.computationStack.pop();
          isComputing = false;
        }
      },

      destroy: () => {
        dependencies.forEach((dep) => this.removeSubscriber(dep, computed));
        dependencies.clear();
        subscribers.clear();
      },

      _subscribers: subscribers,
      _isComputed: true,
    };

    return computed;
  }

  createEffect(fn) {
    let isActive = true;
    let dependencies = new Set();
    let cleanupFn = null; // 🆕 support returned cleanup

    const cleanup = () => {
      dependencies.forEach((dep) => this.removeSubscriber(dep, runEffect));
      dependencies.clear();

      // 🆕 Run user cleanup if present
      if (typeof cleanupFn === 'function') {
        try {
          cleanupFn();
        } catch (e) {
          console.error('Error in effect cleanup:', e);
        }
      }
      cleanupFn = null;
    };

    const runEffect = () => {
      if (!isActive) return;

      cleanup(); // always clean up previous

      const prevComputation = this.currentComputation;
      const oldDependencies = dependencies;
      dependencies = new Set();

      const computation = {
        dependencies,
        invalidate: runEffect,
      };

      this.currentComputation = computation;
      this.computationStack.push(computation);

      try {
        this.detectCycle();
        const possibleCleanup = this.safeExecute(fn);
        if (typeof possibleCleanup === 'function') {
          cleanupFn = possibleCleanup; // 🆕 register user cleanup
        }

        oldDependencies.forEach((dep) => {
          if (!dependencies.has(dep)) {
            this.removeSubscriber(dep, runEffect);
          }
        });
      } finally {
        this.currentComputation = prevComputation;
        this.computationStack.pop();
      }
    };

    runEffect(); // initial run

    return () => {
      isActive = false;
      cleanup();
    };
  }

  detectCycle() {
    const current = this.currentComputation;
    if (!current) return;

    let count = 0;
    for (const comp of this.computationStack) {
      if (comp === current) {
        count++;
        if (count > 1) {
          throw new Error('Circular dependency detected in signal computation');
        }
      }
    }
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
      while (this.updateQueue.size > 0) {
        const updates = Array.from(this.updateQueue);
        this.updateQueue.clear();

        updates.forEach((update) => {
          try {
            update();
          } catch (err) {
            console.error('Error in signal update:', err);
          }
        });
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
}

// Factory & default exports same as yours
function createSignalSystem() {
  const system = new SignalSystem();
  return {
    signal: (v) => system.createSignal(v),
    computed: (fn) => system.createComputed(fn),
    effect: (fn) => system.createEffect(fn),
    batch: (fn) => system.batch(fn),
    system,
  };
}

const defaultSystem = createSignalSystem();
const signal = defaultSystem.signal;
const computed = defaultSystem.computed;
const effect = defaultSystem.effect;
const batch = defaultSystem.batch;

export { signal, computed, effect, batch, createSignalSystem, SignalSystem };

if (typeof window !== 'undefined') {
  window.Signals = {
    signal,
    computed,
    effect,
    batch,
    createSignalSystem,
    SignalSystem,
  };
}
