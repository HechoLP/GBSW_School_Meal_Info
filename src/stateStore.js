const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE_PATH = path.join(__dirname, "..", "data", "state.json");

function createDefaultState(maxCapacity) {
  return {
    congestion: {
      currentCount: 0,
      maxCapacity,
      updatedAt: null,
      lastSensorEvent: null,
      recentEvents: [],
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StateStore {
  constructor(maxCapacity) {
    this.maxCapacity = Number(maxCapacity) || 132;
    this.dataFilePath = DATA_FILE_PATH;
    this.state = createDefaultState(this.maxCapacity);
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFilePath)) {
        this.save();
        return;
      }

      const raw = fs.readFileSync(this.dataFilePath, "utf8");
      const parsed = JSON.parse(raw);
      this.state = this.mergeState(parsed);
    } catch {
      const backupPath = `${this.dataFilePath}.broken.${Date.now()}`;
      try {
        if (fs.existsSync(this.dataFilePath)) {
          fs.copyFileSync(this.dataFilePath, backupPath);
        }
      } catch {
        // Ignore backup copy failure.
      }

      this.state = createDefaultState(this.maxCapacity);
      this.save();
    }
  }

  mergeState(parsed) {
    const base = createDefaultState(this.maxCapacity);

    if (!parsed || typeof parsed !== "object") {
      return base;
    }

    const merged = {
      ...base,
      ...parsed,
      congestion: {
        ...base.congestion,
        ...(parsed.congestion || {}),
      },
    };

    if (!Array.isArray(merged.congestion.recentEvents)) {
      merged.congestion.recentEvents = [];
    }

    merged.congestion.maxCapacity = this.maxCapacity;

    return merged;
  }

  save() {
    const dirPath = path.dirname(this.dataFilePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(this.dataFilePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  getState() {
    return clone(this.state);
  }

  update(mutator) {
    const nextState = clone(this.state);
    mutator(nextState);
    this.state = this.mergeState(nextState);
    this.save();
    return this.getState();
  }
}

module.exports = {
  StateStore,
};
