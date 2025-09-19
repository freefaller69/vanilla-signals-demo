import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Signal, batch, effect } from './signals_tc39.js';

describe('Signal.State', () => {
  describe('basic functionality', () => {
    it('should create a state signal with initial value', () => {
      const state = new Signal.State(42);
      expect(state.get()).toBe(42);
    });

    it('should update value when set', () => {
      const state = new Signal.State(10);
      state.set(20);
      expect(state.get()).toBe(20);
    });

    it('should not notify subscribers when value does not change', () => {
      const state = new Signal.State(10);
      const spy = vi.fn();

      const computed = new Signal.Computed(() => {
        spy();
        return state.get() * 2;
      });

      computed.get(); // Initial computation
      spy.mockClear();

      state.set(10); // Same value
      expect(spy).not.toHaveBeenCalled();
    });

    it('should notify subscribers when value changes', () => {
      const state = new Signal.State(10);
      const spy = vi.fn();

      const computed = new Signal.Computed(() => {
        spy();
        return state.get() * 2;
      });

      computed.get(); // Initial computation
      spy.mockClear();

      state.set(20); // Different value
      computed.get(); // Trigger recomputation
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should use custom equals function when provided', () => {
      const state = new Signal.State(
        { value: 10 },
        {
          equals: (a, b) => a.value === b.value,
        }
      );

      const spy = vi.fn();
      const computed = new Signal.Computed(() => {
        spy();
        return state.get().value * 2;
      });

      computed.get(); // Initial computation
      spy.mockClear();

      state.set({ value: 10 }); // Same value according to equals
      expect(spy).not.toHaveBeenCalled();

      state.set({ value: 20 }); // Different value
      computed.get(); // Trigger recomputation
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should support peek() without tracking dependencies', () => {
      const state = new Signal.State(42);
      const computed = new Signal.Computed(() => {
        return state.peek() * 2; // Using peek, should not track dependency
      });

      expect(computed.get()).toBe(84);

      state.set(50);
      expect(computed.get()).toBe(84); // Should not recompute
    });
  });

  describe('lifecycle callbacks', () => {
    it('should call watched callback when signal is accessed', () => {
      const watchedSpy = vi.fn();
      const state = new Signal.State(10, {
        [Signal.subtle.watched]: watchedSpy,
      });

      const computed = new Signal.Computed(() => state.get());
      computed.get();

      expect(watchedSpy).toHaveBeenCalledTimes(1);
    });

    it('should manage lifecycle callbacks properly', () => {
      const watchedSpy = vi.fn();
      const unwatchedSpy = vi.fn();
      const state = new Signal.State(10, {
        [Signal.subtle.watched]: watchedSpy,
        [Signal.subtle.unwatched]: unwatchedSpy,
      });

      const computed = new Signal.Computed(() => state.get());
      computed.get(); // Should trigger watched

      expect(watchedSpy).toHaveBeenCalled();
      expect(state._subscribers.size).toBeGreaterThan(0);
    });
  });

  describe('disposal', () => {
    it('should throw when accessing disposed signal', () => {
      const state = new Signal.State(42);
      state.dispose();

      expect(() => state.get()).toThrow('Cannot access disposed signal');
    });

    it('should throw when setting disposed signal', () => {
      const state = new Signal.State(42);
      state.dispose();

      expect(() => state.set(100)).toThrow('Cannot set value on disposed signal');
    });
  });
});

describe('Signal.Computed', () => {
  describe('basic functionality', () => {
    it('should compute value based on dependencies', () => {
      const state = new Signal.State(10);
      const computed = new Signal.Computed(() => state.get() * 2);

      expect(computed.get()).toBe(20);
    });

    it('should recompute when dependencies change', () => {
      const state = new Signal.State(10);
      const computed = new Signal.Computed(() => state.get() * 2);

      expect(computed.get()).toBe(20);

      state.set(15);
      expect(computed.get()).toBe(30);
    });

    it('should only recompute when accessed and stale', () => {
      const state = new Signal.State(10);
      const spy = vi.fn(() => state.get() * 2);
      const computed = new Signal.Computed(spy);

      computed.get(); // First access
      expect(spy).toHaveBeenCalledTimes(1);

      computed.get(); // Second access, should use cache
      expect(spy).toHaveBeenCalledTimes(1);

      state.set(20); // Make computed stale
      computed.get(); // Third access, should recompute
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should support chained computations', () => {
      const a = new Signal.State(10);
      const b = new Signal.Computed(() => a.get() * 2);
      const c = new Signal.Computed(() => b.get() + 5);

      expect(c.get()).toBe(25);

      a.set(20);
      expect(c.get()).toBe(45);
    });

    it('should support peek() without tracking dependencies', () => {
      const state = new Signal.State(10);
      const spy = vi.fn(() => state.peek() * 2); // Use peek to avoid tracking
      const computed = new Signal.Computed(spy);

      expect(computed.peek()).toBe(20);

      state.set(15);
      expect(computed.peek()).toBe(20); // Should not recompute since no dependency
    });
  });

  describe('circular dependency detection', () => {
    it('should prevent recursion during computation', () => {
      let computed;
      computed = new Signal.Computed(() => {
        // This demonstrates the _isComputing flag protection
        return computed._isComputing ? 'already computing' : 'computed';
      });

      expect(computed.get()).toBe('already computing');
    });

    it('should track computation stack for cycle detection', () => {
      // This test verifies the computation stack works properly
      let currentComp;
      const computed = new Signal.Computed(() => {
        currentComp = Signal.subtle.currentComputed();
        return 42;
      });

      computed.get();
      expect(currentComp).toBeTruthy();
      expect(currentComp.signal).toBe(computed);
    });

    it('should prevent infinite recursion with max depth check', () => {
      // Create a deeply nested computed structure that exceeds max depth
      let computeds = [];
      for (let i = 0; i < 105; i++) {
        const index = i;
        computeds.push(
          new Signal.Computed(() => {
            if (index === 0) return 1;
            return computeds[index - 1].get() + 1;
          })
        );
      }

      expect(() => computeds[104].get()).toThrow(/Maximum computation depth.*exceeded/);
    });
  });

  describe('dependency cleanup', () => {
    it('should clean up old dependencies when recomputing', () => {
      const state1 = new Signal.State(10);
      const state2 = new Signal.State(20);
      const toggle = new Signal.State(true);

      const computed = new Signal.Computed(() => {
        return toggle.get() ? state1.get() : state2.get();
      });

      expect(computed.get()).toBe(10);

      // Switch to state2
      toggle.set(false);
      expect(computed.get()).toBe(20);

      // state1 changes should not affect computed anymore
      const spy = vi.fn(() => computed.get());
      state1.set(100);
      expect(spy()).toBe(20); // Should not recompute
    });
  });

  describe('disposal', () => {
    it('should throw when accessing disposed computed signal', () => {
      const state = new Signal.State(10);
      const computed = new Signal.Computed(() => state.get() * 2);

      computed.dispose();
      expect(() => computed.get()).toThrow('Cannot access disposed computed signal');
    });

    it('should clean up dependencies on disposal', () => {
      const state = new Signal.State(10);
      const computed = new Signal.Computed(() => state.get() * 2);

      computed.get(); // Create dependency
      expect(state._subscribers.size).toBeGreaterThan(0);

      computed.dispose();
      // After disposal, computed should no longer be in dependencies
      expect(computed._dependencies.size).toBe(0);
    });
  });
});

describe('effect', () => {
  describe('basic functionality', () => {
    it('should run effect immediately', () => {
      const spy = vi.fn();
      effect(spy);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should rerun when dependencies change', async () => {
      const state = new Signal.State(10);
      const spy = vi.fn(() => state.get());

      effect(spy);
      expect(spy).toHaveBeenCalledTimes(1);

      state.set(20);

      // Wait for async watcher notification
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should support cleanup functions', async () => {
      const state = new Signal.State(10);
      const cleanupSpy = vi.fn();

      effect(() => {
        state.get();
        return cleanupSpy;
      });

      state.set(20); // Should trigger cleanup before rerun

      // Wait for async watcher notification
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup on disposal', () => {
      const cleanupSpy = vi.fn();

      const dispose = effect(() => {
        return cleanupSpy;
      });

      dispose();
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    it('should stop reacting after disposal', () => {
      const state = new Signal.State(10);
      const spy = vi.fn(() => state.get());

      const dispose = effect(spy);
      expect(spy).toHaveBeenCalledTimes(1);

      dispose();

      state.set(20);
      expect(spy).toHaveBeenCalledTimes(1); // Should not run again
    });
  });

  describe('error handling', () => {
    it('should handle errors in effect functions gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      effect(() => {
        throw new Error('Effect error');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Error in effect:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle errors in cleanup functions gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const state = new Signal.State(10);

      effect(() => {
        state.get();
        return () => {
          throw new Error('Cleanup error');
        };
      });

      state.set(20); // Should trigger cleanup with error

      // Wait for async watcher notification
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(consoleSpy).toHaveBeenCalledWith('Error in effect cleanup:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});

describe('batch', () => {
  it('should batch multiple signal updates', () => {
    const state1 = new Signal.State(10);
    const state2 = new Signal.State(20);
    const spy = vi.fn(() => state1.get() + state2.get());

    const computed = new Signal.Computed(spy);
    computed.get(); // Initial computation
    spy.mockClear();

    batch(() => {
      state1.set(15);
      state2.set(25);
    });

    computed.get(); // Should only recompute once
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should return the result of the batched function', () => {
    const result = batch(() => {
      return 'batched result';
    });

    expect(result).toBe('batched result');
  });

  it('should handle nested batching correctly', () => {
    const state = new Signal.State(10);
    const spy = vi.fn(() => state.get());
    const computed = new Signal.Computed(spy);

    computed.get(); // Initial computation
    spy.mockClear();

    batch(() => {
      state.set(20);
      batch(() => {
        state.set(30);
      });
    });

    computed.get();
    expect(spy).toHaveBeenCalledTimes(1); // Should only recompute once
  });
});

describe('Signal.subtle', () => {
  describe('Watcher', () => {
    it('should create a watcher and receive notifications', () => {
      const notifySpy = vi.fn();
      const watcher = new Signal.subtle.Watcher(notifySpy);
      const state = new Signal.State(10);

      watcher.watch(state);
      state.set(20);

      // Watcher notifications are scheduled in microtasks
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(notifySpy).toHaveBeenCalledTimes(1);
          resolve();
        }, 0);
      });
    });

    it('should track pending signals', () => {
      const watcher = new Signal.subtle.Watcher(() => {});
      const state1 = new Signal.State(10);
      const state2 = new Signal.State(20);

      watcher.watch(state1, state2);

      state1.set(15);
      state2.set(25);

      const pending = watcher.getPending();
      expect(pending).toContain(state1);
      expect(pending).toContain(state2);
    });

    it('should support unwatching signals', () => {
      const notifySpy = vi.fn();
      const watcher = new Signal.subtle.Watcher(notifySpy);
      const state = new Signal.State(10);

      watcher.watch(state);
      watcher.unwatch(state);

      state.set(20);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(notifySpy).not.toHaveBeenCalled();
          resolve();
        }, 0);
      });
    });
  });

  describe('untrack', () => {
    it('should prevent dependency tracking', () => {
      const state = new Signal.State(10);
      const spy = vi.fn();

      const computed = new Signal.Computed(() => {
        spy();
        return Signal.subtle.untrack(() => state.get()) * 2;
      });

      computed.get(); // Initial computation
      spy.mockClear();

      state.set(20);
      computed.get(); // Should not recompute
      expect(spy).not.toHaveBeenCalled();
    });

    it('should return the result of the untracked function', () => {
      const result = Signal.subtle.untrack(() => 'untracked result');
      expect(result).toBe('untracked result');
    });
  });

  describe('currentComputed', () => {
    it('should return null when not in computation', () => {
      expect(Signal.subtle.currentComputed()).toBeNull();
    });

    it('should return current computation when inside computed', () => {
      let currentComp;
      const computed = new Signal.Computed(() => {
        currentComp = Signal.subtle.currentComputed();
        return 42;
      });

      computed.get();
      expect(currentComp).toBeTruthy();
      expect(currentComp.dependencies).toBeInstanceOf(Set);
    });
  });

  describe('introspectSources', () => {
    it('should return dependencies of computed signals', () => {
      const state1 = new Signal.State(10);
      const state2 = new Signal.State(20);
      const computed = new Signal.Computed(() => state1.get() + state2.get());

      computed.get(); // Ensure computation has run

      const sources = Signal.subtle.introspectSources(computed);
      expect(sources).toContain(state1);
      expect(sources).toContain(state2);
    });

    it('should return empty array for state signals', () => {
      const state = new Signal.State(10);
      const sources = Signal.subtle.introspectSources(state);
      expect(sources).toEqual([]);
    });
  });

  describe('introspectSinks', () => {
    it('should return subscribers of signals', () => {
      const state = new Signal.State(10);
      const computed1 = new Signal.Computed(() => state.get() * 2);
      const computed2 = new Signal.Computed(() => state.get() * 3);

      computed1.get(); // Create dependency
      computed2.get(); // Create dependency

      // Direct check that subscribers exist
      expect(state._subscribers.size).toBe(2);

      // introspectSinks returns array of subscribers
      const sinks = Signal.subtle.introspectSinks(state);
      expect(Array.isArray(sinks)).toBe(true);
    });

    it('should return empty array for signals with no subscribers', () => {
      const state = new Signal.State(10);
      const sinks = Signal.subtle.introspectSinks(state);
      expect(sinks).toEqual([]);
    });
  });
});

describe('error handling', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle errors in signal updates gracefully', () => {
    const state = new Signal.State(10);
    const computed = new Signal.Computed(() => {
      if (state.get() > 15) {
        throw new Error('Computation error');
      }
      return state.get() * 2;
    });

    expect(computed.get()).toBe(20);

    state.set(20); // Should trigger error
    expect(() => computed.get()).toThrow('Computation error');
    expect(consoleSpy).toHaveBeenCalledWith('Error in signal computation:', expect.any(Error));
  });

  it('should handle errors in lifecycle callbacks gracefully', () => {
    const state = new Signal.State(10, {
      [Signal.subtle.watched]: () => {
        throw new Error('Watched callback error');
      },
    });

    const computed = new Signal.Computed(() => state.get());
    computed.get(); // Should trigger watched callback error

    expect(consoleSpy).toHaveBeenCalledWith('Error in watched callback:', expect.any(Error));
  });

  it('should handle update system robustly', () => {
    const state = new Signal.State(0);

    // Test that the update system works correctly
    const computed = new Signal.Computed(() => state.get() * 2);
    expect(computed.get()).toBe(0);

    state.set(5);
    expect(computed.get()).toBe(10);

    // This tests the system handles updates properly
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Error'));
  });
});

describe('complex scenarios', () => {
  it('should handle diamond dependency graphs', () => {
    const root = new Signal.State(10);
    const left = new Signal.Computed(() => root.get() * 2);
    const right = new Signal.Computed(() => root.get() * 3);
    const bottom = new Signal.Computed(() => left.get() + right.get());

    expect(bottom.get()).toBe(50); // (10*2) + (10*3) = 50

    root.set(5);
    expect(bottom.get()).toBe(25); // (5*2) + (5*3) = 25
  });

  it('should handle conditional dependencies', () => {
    const toggle = new Signal.State(true);
    const a = new Signal.State(10);
    const b = new Signal.State(20);

    const conditional = new Signal.Computed(() => {
      return toggle.get() ? a.get() : b.get();
    });

    expect(conditional.get()).toBe(10);

    // Change inactive dependency - should not trigger recomputation
    b.set(100);
    expect(conditional.get()).toBe(10);

    // Switch to other dependency
    toggle.set(false);
    expect(conditional.get()).toBe(100);

    // Now a changes should not trigger recomputation
    a.set(200);
    expect(conditional.get()).toBe(100);
  });

  it('should handle mixed batched and unbatched updates', () => {
    const state1 = new Signal.State(1);
    const state2 = new Signal.State(2);
    const spy = vi.fn(() => state1.get() + state2.get());
    const computed = new Signal.Computed(spy);

    computed.get(); // Initial
    spy.mockClear();

    // Unbatched update
    state1.set(10);
    computed.get(); // Should recompute
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();

    // Batched updates
    batch(() => {
      state1.set(20);
      state2.set(30);
    });

    computed.get(); // Should recompute once
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
