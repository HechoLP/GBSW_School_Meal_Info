function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateWaitMinutes(currentCount, maxCapacity) {
  const ratio = maxCapacity === 0 ? 0 : currentCount / maxCapacity;
  if (ratio < 0.4) {
    return 0;
  }
  if (ratio < 0.65) {
    return Math.round((ratio - 0.4) * 10);
  }
  if (ratio < 0.9) {
    return Math.round(3 + (ratio - 0.65) * 25);
  }
  return Math.round(9 + (ratio - 0.9) * 45);
}

function levelFromRatio(ratio) {
  if (ratio < 0.5) {
    return { code: "comfortable", label: "쾌적", color: "green" };
  }
  if (ratio < 0.8) {
    return { code: "normal", label: "보통", color: "amber" };
  }
  return { code: "crowded", label: "혼잡", color: "red" };
}

class CongestionService {
  constructor(store) {
    this.store = store;
  }

  getStatus() {
    const { congestion } = this.store.getState();
    const maxCapacity = Number(congestion.maxCapacity) || 132;
    const currentCount = Number(congestion.currentCount) || 0;
    const ratio = maxCapacity === 0 ? 0 : currentCount / maxCapacity;

    return {
      currentCount,
      maxCapacity,
      ratio,
      percent: Math.round(clamp(ratio * 100, 0, 100)),
      waitMinutes: calculateWaitMinutes(currentCount, maxCapacity),
      level: levelFromRatio(ratio),
      updatedAt: congestion.updatedAt,
      lastSensorEvent: congestion.lastSensorEvent,
    };
  }

  applySensorEvent(payload) {
    const eventType = payload?.eventType;
    const sensorId = payload?.sensorId || "unknown";
    const amountRaw = Number(payload?.amount);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.floor(amountRaw) : 1;
    const customCountRaw = Number(payload?.count);
    const eventAt = payload?.eventAt || new Date().toISOString();

    if (!["entry", "exit", "set"].includes(eventType)) {
      const error = new Error("eventType must be one of entry, exit, set");
      error.statusCode = 400;
      throw error;
    }

    if (eventType === "set" && !Number.isFinite(customCountRaw)) {
      const error = new Error("set event requires numeric count");
      error.statusCode = 400;
      throw error;
    }

    this.store.update((draft) => {
      const maxCapacity = Number(draft.congestion.maxCapacity) || 132;
      const previous = Number(draft.congestion.currentCount) || 0;

      let next = previous;
      if (eventType === "entry") {
        next = previous + amount;
      } else if (eventType === "exit") {
        next = previous - amount;
      } else {
        next = customCountRaw;
      }

      draft.congestion.currentCount = clamp(Math.round(next), 0, Math.max(maxCapacity * 2, maxCapacity + 100));
      draft.congestion.updatedAt = new Date().toISOString();
      draft.congestion.lastSensorEvent = {
        eventType,
        sensorId,
        amount,
        eventAt,
        previous,
        currentCount: draft.congestion.currentCount,
      };

      draft.congestion.recentEvents.push(draft.congestion.lastSensorEvent);
      if (draft.congestion.recentEvents.length > 120) {
        draft.congestion.recentEvents = draft.congestion.recentEvents.slice(-120);
      }
    });

    return this.getStatus();
  }

  setCurrentCount(count, sensorId = "manual") {
    return this.applySensorEvent({ eventType: "set", count, sensorId });
  }
}

module.exports = {
  CongestionService,
};