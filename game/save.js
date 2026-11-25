"use strict";
// Persistent player progression (LocalStorage, with an in-memory fallback).
const SAVE_KEY = "raycasting.save.v1";
function defaultSettings() {
    return { sound: true, volume: 0.6, showFps: false, turnSensitivity: 1, touchControls: "auto" };
}
function defaultSave() {
    return {
        version: 1,
        gold: 0,
        goldEarnedTotal: 0,
        levels: {},
        upgrades: {},
        settings: defaultSettings(),
        run: null,
    };
}
class SaveSystem {
    data;
    persistent = true;
    constructor() {
        this.data = this.load();
    }
    load() {
        try {
            const raw = window.localStorage.getItem(SAVE_KEY);
            if (raw === null)
                return defaultSave();
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1)
                return defaultSave();
            const base = defaultSave();
            return {
                version: 1,
                gold: Math.max(0, Math.floor(Number(parsed.gold) || 0)),
                goldEarnedTotal: Math.max(0, Math.floor(Number(parsed.goldEarnedTotal) || 0)),
                levels: parsed.levels ?? base.levels,
                upgrades: parsed.upgrades ?? base.upgrades,
                settings: { ...base.settings, ...(parsed.settings ?? {}) },
                run: parsed.run ?? null,
            };
        }
        catch {
            this.persistent = false;
            return defaultSave();
        }
    }
    save() {
        try {
            window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        }
        catch {
            this.persistent = false;
        }
    }
    reset() {
        const settings = this.data.settings;
        this.data = defaultSave();
        this.data.settings = settings;
        this.save();
    }
    record(levelId) {
        return (this.data.levels[levelId] ?? { completed: false, stars: 0, bestTime: null, bestGold: 0, plays: 0 });
    }
    // A level is unlocked when it is the first one or when the previous one is completed.
    isUnlocked(index) {
        if (index <= 0)
            return true;
        const prev = LEVELS[index - 1];
        return prev !== undefined && this.record(prev.id).completed;
    }
    completedCount() {
        return LEVELS.filter((l) => this.record(l.id).completed).length;
    }
    totalStars() {
        return LEVELS.reduce((sum, l) => sum + this.record(l.id).stars, 0);
    }
    // The level "Continue" should lead to: first unlocked level not yet completed, else the last one.
    nextLevelIndex() {
        for (let i = 0; i < LEVELS.length; ++i) {
            if (this.isUnlocked(i) && !this.record(LEVELS[i].id).completed)
                return i;
        }
        return LEVELS.length - 1;
    }
    hasUpgrade(id) {
        return this.data.upgrades[id] === true;
    }
    buyUpgrade(id, cost) {
        if (this.hasUpgrade(id) || this.data.gold < cost)
            return false;
        this.data.gold -= cost;
        this.data.upgrades[id] = true;
        this.save();
        return true;
    }
    // Applies a finished level to the save and returns the reward breakdown.
    applyVictory(index, result) {
        const def = LEVELS[index];
        const prev = this.record(def.id);
        const reward = computeRewards(def, index, prev, result);
        const rec = {
            completed: true,
            stars: Math.max(prev.stars, reward.stars),
            bestTime: prev.bestTime === null ? result.elapsed : Math.min(prev.bestTime, result.elapsed),
            bestGold: Math.max(prev.bestGold, result.gold),
            plays: prev.plays + 1,
        };
        this.data.levels[def.id] = rec;
        this.data.gold += reward.total;
        this.data.goldEarnedTotal += reward.total;
        this.data.run = null;
        this.save();
        return reward;
    }
    applyDefeat(index) {
        const def = LEVELS[index];
        const prev = this.record(def.id);
        this.data.levels[def.id] = { ...prev, plays: prev.plays + 1 };
        this.data.run = null;
        this.save();
    }
}
// Reward rules (finite by design):
// - picked-up gold is paid in full on the first clear, half on replays;
// - the clear bonus is only paid once;
// - stars only pay when they beat the previous best;
// - the time bonus only pays when the previous best time is beaten.
function computeStars(def, result) {
    let stars = 1;
    if (result.gold >= result.totalGold)
        stars += 1;
    if (result.elapsed <= def.parTime)
        stars += 1;
    return stars;
}
function computeRewards(def, index, prev, result) {
    const stars = computeStars(def, result);
    const firstClear = !prev.completed;
    const newStars = Math.max(0, stars - prev.stars);
    const newBestTime = prev.bestTime === null || result.elapsed < prev.bestTime;
    const pickup = firstClear ? result.gold : Math.ceil(result.gold / 2);
    const clearBonus = firstClear ? 10 + 5 * index : 0;
    const starBonus = newStars * 10;
    const timeBonus = newBestTime ? Math.floor(result.timeLeft / 10) : 0;
    return {
        stars,
        newStars,
        firstClear,
        newBestTime,
        pickup,
        clearBonus,
        starBonus,
        timeBonus,
        total: pickup + clearBonus + starBonus + timeBonus,
    };
}
//# sourceMappingURL=save.js.map