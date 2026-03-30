import { createId } from "../utils/id.mjs";

class EventBus {
  constructor() {
    this.handlers = new Map(); // eventName -> Set(fn)
    this.anyHandlers = new Set(); // fn(event)
  }

  on(eventName, fn) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName).add(fn);
    return () => this.off(eventName, fn);
  }

  onAny(fn) {
    this.anyHandlers.add(fn);
    return () => this.anyHandlers.delete(fn);
  }

  off(eventName, fn) {
    const set = this.handlers.get(eventName);
    if (!set) return;
    set.delete(fn);
  }

  emit(eventName, payload = {}) {
    const event = {
      id: createId("evt"),
      name: eventName,
      ts: Date.now(),
      payload
    };

    // Any handlers first (useful for logging/analytics)
    for (const fn of this.anyHandlers) {
      try {
        fn(event);
      } catch {}
    }

    const set = this.handlers.get(eventName);
    if (!set) return event;
    for (const fn of set) {
      try {
        fn(event);
      } catch {}
    }
    return event;
  }
}

export const eventBus = new EventBus();
