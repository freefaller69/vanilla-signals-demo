// Enhanced Signals Implementation - TC39 Aligned
class SignalSystem {
  constructor() {
    this.currentComputation = null;
    this.batchDepth = 0;
    this.batchedUpdates = new Set();
  }

  signal(initialValue, options = {}) {
    const subscribers = new Set();
    const equals = options.equals || Object.is;

    function signal(newValue) {
      // Getter
      if (arguments.length === 0) {
        // Track dependency if we're in a computation
        if (SignalSystem.instance.currentComputation) {
          subscribers.add(SignalSystem.instance.currentComputation);
        }
        return signal._value;
      }

      // Setter
      if (!equals(signal._value, newValue)) {
        signal._value = newValue;

        // Batch or immediately notify subscribers
        if (SignalSystem.instance.batchDepth > 0) {
          // Add to batch
          SignalSystem.instance.batchedUpdates.add(() => {
            subscribers.forEach((subscriber) => {
              try {
                subscriber();
              } catch (error) {
                console.error('Effect error in signal update:', error);
              }
            });
          });
        } else {
          // Immediate notification
          subscribers.forEach((subscriber) => {
            try {
              subscriber();
            } catch (error) {
              console.error('Effect error in signal update:', error);
            }
          });
        }
      }
    }

    signal._value = initialValue;
    signal._subscribers = subscribers;
    signal._equals = equals;
    signal.peek = () => signal._value;

    return signal;
  }

  computed(fn, options = {}) {
    const subscribers = new Set();
    const equals = options.equals || Object.is;
    let isStale = true;
    let cachedValue;
    let cachedError = null;
    let hasError = false;
    let isComputing = false;

    function computed() {
      // Track dependency if we're in a computation
      if (SignalSystem.instance.currentComputation) {
        subscribers.add(SignalSystem.instance.currentComputation);
      }

      // Prevent recursive computation
      if (isComputing) {
        throw new Error('Recursive computed signal access detected');
      }

      if (isStale) {
        isComputing = true;
        const prevComputation = SignalSystem.instance.currentComputation;

        const invalidate = () => {
          if (!isStale && !isComputing) {
            isStale = true;
            hasError = false;
            cachedError = null;

            // Notify subscribers (with batching support)
            if (SignalSystem.instance.batchDepth > 0) {
              SignalSystem.instance.batchedUpdates.add(() => {
                subscribers.forEach((subscriber) => {
                  try {
                    subscriber();
                  } catch (error) {
                    console.error('Effect error in computed invalidation:', error);
                  }
                });
              });
            } else {
              subscribers.forEach((subscriber) => {
                try {
                  subscriber();
                } catch (error) {
                  console.error('Effect error in computed invalidation:', error);
                }
              });
            }
          }
        };

        SignalSystem.instance.currentComputation = invalidate;

        try {
          const newValue = fn.call(computed);

          // Check if value actually changed
          if (hasError || !equals(cachedValue, newValue)) {
            cachedValue = newValue;
            hasError = false;
            cachedError = null;
          }

          isStale = false;
        } catch (error) {
          hasError = true;
          cachedError = error;
          cachedValue = undefined;
          isStale = false;
        } finally {
          SignalSystem.instance.currentComputation = prevComputation;
          isComputing = false;
        }
      }

      // Rethrow cached error if present
      if (hasError) {
        throw cachedError;
      }

      return cachedValue;
    }

    computed._subscribers = subscribers;
    computed._equals = equals;
    computed.peek = () => {
      if (isStale) {
        const prevComputation = SignalSystem.instance.currentComputation;
        SignalSystem.instance.currentComputation = null;

        try {
          cachedValue = fn.call(computed);
          hasError = false;
          cachedError = null;
          isStale = false;
        } catch (error) {
          hasError = true;
          cachedError = error;
          cachedValue = undefined;
          isStale = false;
        } finally {
          SignalSystem.instance.currentComputation = prevComputation;
        }
      }

      if (hasError) {
        throw cachedError;
      }

      return cachedValue;
    };

    return computed;
  }

  effect(fn) {
    let cleanup = null;
    let isDisposed = false;
    let isRunning = false;
    let runCount = 0;

    const runEffect = () => {
      if (isDisposed || isRunning) return;
      
      runCount++;
      if (runCount > 100) {
        console.error('Effect runaway detected! Stopping effect execution.');
        isDisposed = true;
        return;
      }

      isRunning = true;

      // Run cleanup from previous effect run
      if (cleanup && typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.error('Effect cleanup error:', error);
        }
        cleanup = null;
      }

      const prevComputation = SignalSystem.instance.currentComputation;
      SignalSystem.instance.currentComputation = runEffect;

      try {
        cleanup = fn() || null;
      } catch (error) {
        console.error('Effect execution error:', error);
      } finally {
        SignalSystem.instance.currentComputation = prevComputation;
        isRunning = false;
      }
    };

    // Run immediately
    runEffect();

    // Return disposal function
    return () => {
      isDisposed = true;
      if (cleanup && typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.error('Effect disposal error:', error);
        }
        cleanup = null;
      }
    };
  }

  batch(fn) {
    this.batchDepth++;

    try {
      const result = fn();

      // Execute all batched updates
      if (this.batchDepth === 1) {
        const updates = Array.from(this.batchedUpdates);
        this.batchedUpdates.clear();

        updates.forEach((update) => {
          try {
            update();
          } catch (error) {
            console.error('Batched update error:', error);
          }
        });
      }

      return result;
    } finally {
      this.batchDepth--;
    }
  }

  untrack(fn) {
    const prevComputation = this.currentComputation;
    this.currentComputation = null;
    try {
      return fn();
    } finally {
      this.currentComputation = prevComputation;
    }
  }
}

// Create singleton instance
const signalSystem = new SignalSystem();
SignalSystem.instance = signalSystem;

// Export the main functions
export const signal = (initialValue, options) => signalSystem.signal(initialValue, options);
export const computed = (fn, options) => signalSystem.computed(fn, options);
export const effect = (fn) => signalSystem.effect(fn);
export const batch = (fn) => signalSystem.batch(fn);
export const untrack = (fn) => signalSystem.untrack(fn);

// Export system for debugging
export { signalSystem };
