import EventEmitter from "events";

class SpiritEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  emitEvent(type, payload) {
    this.emit(type, payload);
  }

  subscribe(type, handler) {
    this.on(type, handler);
  }

  unsubscribe(type, handler) {
    this.off(type, handler);
  }
}

const eventBus = new SpiritEventBus();
export default eventBus;
