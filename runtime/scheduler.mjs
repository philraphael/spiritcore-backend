export default class Scheduler {
  constructor(interval = 1000) {
    this.interval = interval;
    this.tasks = [];
    this.running = false;
    this.loop = null;
  }

  addTask(task) {
    if (typeof task !== "function") {
      throw new Error("Task must be a function");
    }
    this.tasks.push(task);
  }

  start() {
    if (this.running) return;

    this.running = true;

    this.loop = setInterval(() => {
      for (const task of this.tasks) {
        try {
          task();
        } catch (err) {
          console.error("[Scheduler error]", err);
        }
      }
    }, this.interval);
  }

  stop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.running = false;
  }
}
