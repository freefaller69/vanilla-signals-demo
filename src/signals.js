class SignalSystem {
  constructor() {
    this.currentComputation = null;
    this.updateQueue = new Set();
    this.isUpdating = false;
    this.computationStack = [];
  }

  createSignal(initialValue) {
    const subscribers = new Set();
    let value = initialValue;

    const signal = {
      get value() {
        if (thisSystem.currentComputation) {
          subscribers.add(thisSystem.currentComputation);
          thisSystem.currentComputation.dependencies.add(signal);
        }
        return value;
      },

      set value(newValue) {
        if (value !== newValue) {
          value = newValue;
          thisSystem.scheduleUpdate(subscribers);
        }
      },

      peek() {
        return value;
      },

      destroy() {
        subscribers.clear();
      },

      _subscribers: subscribers,
      _isSignal: true,
    };

    // Save reference to this SignalSystem to support `this` inside accessors
    const thisSystem = this;

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
      get value() {
        if (isComputing) {
          throw new Error('Circular dependency detected in computed signal');
        }

        if (thisSystem.currentComputation) {
          subscribers.add(thisSystem.currentComputation);
          thisSystem.currentComputation.dependencies.add(computed);
        }

        if (isStale && !isComputing) {
          computed.computeValue();
        }

        return cachedValue;
      },

      peek() {
        if (isStale && !isComputing) {
          const prevComputation = thisSystem.currentComputation;
          thisSystem.currentComputation = null;
          try {
            cachedValue = thisSystem.safeExecute(fn);
            isStale = false;
          } finally {
            thisSystem.currentComputation = prevComputation;
          }
        }
        return cachedValue;
      },

      computeValue() {
        if (isComputing) {
          throw new Error('Circular dependency detected in computed signal');
        }

        isComputing = true;
        const prevComputation = thisSystem.currentComputation;
        const oldDependencies = dependencies;
        dependencies = new Set();

        const computation = {
          dependencies,
          invalidate,
        };

        thisSystem.currentComputation = computation;
        thisSystem.computationStack.push(computation);

        try {
          thisSystem.detectCycle();
          cachedValue = thisSystem.safeExecute(fn);
          isStale = false;

          oldDependencies.forEach((dep) => {
            if (!dependencies.has(dep) && dep._subscribers) {
              for (const subscriber of dep._subscribers) {
                if (subscriber.invalidate === invalidate) {
                  dep._subscribers.delete(subscriber);
                  break;
                }
              }
            }
          });
        } finally {
          thisSystem.currentComputation = prevComputation;
          thisSystem.computationStack.pop();
          isComputing = false;
        }
      },

      destroy() {
        dependencies.forEach((dep) => {
          if (dep._subscribers) {
            for (const subscriber of dep._subscribers) {
              if (subscriber.invalidate === invalidate) {
                dep._subscribers.delete(subscriber);
                break;
              }
            }
          }
        });
        dependencies.clear();
        subscribers.clear();
      },

      _subscribers: subscribers,
      _isComputed: true,
    };

    // Save reference to this SignalSystem to support `this` inside accessors
    const thisSystem = this;

    return computed;
  }

  createEffect(fn) {
    let isActive = true;
    let dependencies = new Set();

    const cleanup = () => {
      isActive = false;
      dependencies.forEach((dep) => {
        if (dep._subscribers) {
          for (const subscriber of dep._subscribers) {
            if (subscriber === runEffect || subscriber.invalidate === runEffect) {
              dep._subscribers.delete(subscriber);
              break;
            }
          }
        }
      });
      dependencies.clear();
    };

    const runEffect = () => {
      if (!isActive) return;

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
        this.safeExecute(fn);

        oldDependencies.forEach((dep) => {
          if (!dependencies.has(dep) && dep._subscribers) {
            for (const subscriber of dep._subscribers) {
              if (subscriber === runEffect || subscriber.invalidate === runEffect) {
                dep._subscribers.delete(subscriber);
                break;
              }
            }
          }
        });
      } finally {
        this.currentComputation = prevComputation;
        this.computationStack.pop();
      }
    };

    runEffect();

    return cleanup;
  }

  detectCycle() {
    const currentComputation = this.currentComputation;
    if (!currentComputation) return;

    let count = 0;
    for (let i = 0; i < this.computationStack.length; i++) {
      if (this.computationStack[i] === currentComputation) {
        count++;
        if (count > 1) {
          throw new Error('Circular dependency detected in signal computation');
        }
      }
    }
  }

  scheduleUpdate(subscribers) {
    subscribers.forEach((subscriber) => {
      if (typeof subscriber === 'function') {
        this.updateQueue.add(subscriber);
      } else if (subscriber.invalidate) {
        this.updateQueue.add(subscriber.invalidate);
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
          } catch (error) {
            console.error('Error in signal update:', error);
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
    } catch (error) {
      console.error('Error in signal computation:', error);
      throw error;
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

// Factory functions to match the ergonomic API of the TC39 proposal
function createSignalSystem() {
  const system = new SignalSystem();

  return {
    signal: (initialValue) => system.createSignal(initialValue),
    computed: (fn) => system.createComputed(fn),
    effect: (fn) => system.createEffect(fn),
    batch: (fn) => system.batch(fn),
    system,
  };
}

// Default instance for global convenience
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
