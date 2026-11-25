"use strict";
// Rules of one playable level: timer, gold, guardians, hearts, exit.
const COIN_PICK_RADIUS = 0.45;
const GUARDIAN_HIT_RADIUS = 0.5;
const INVULNERABILITY_TIME = 1.5;
class LevelSession {
    index;
    def;
    level;
    player;
    timeLimit;
    maxHearts;
    speedMultiplier;
    timeLeft;
    elapsed = 0;
    hearts;
    invulnerable = 0;
    collected;
    gold = 0;
    guardians;
    state = "playing";
    lostReason = null;
    events = [];
    lockedHintCooldown = 0;
    warnedTime = false;
    constructor(index, textures, mods) {
        this.index = index;
        this.def = LEVELS[index];
        this.level = buildLevel(this.def, textures);
        this.player = new Player(this.level.start, this.def.startDir);
        this.timeLimit = this.def.timeLimit + mods.bonusTime;
        this.timeLeft = this.timeLimit;
        this.maxHearts = mods.maxHearts;
        this.hearts = mods.maxHearts;
        this.speedMultiplier = mods.speedMultiplier;
        this.collected = this.level.coins.map(() => false);
        this.guardians = this.level.guardians.map((g) => ({ pos: g.pos, axis: g.axis, sign: 1 }));
    }
    get totalGold() {
        return this.level.coins.length;
    }
    get exitOpen() {
        return this.level.scene.exitOpen;
    }
    update(deltaTime, controls, turnSpeed) {
        if (this.state !== "playing")
            return;
        const scene = this.level.scene;
        this.elapsed += deltaTime;
        this.timeLeft = Math.max(0, this.timeLeft - deltaTime);
        this.invulnerable = Math.max(0, this.invulnerable - deltaTime);
        this.lockedHintCooldown = Math.max(0, this.lockedHintCooldown - deltaTime);
        stepPlayer(scene, this.player, controls, deltaTime, PLAYER_SPEED * this.speedMultiplier, turnSpeed);
        const pos = this.player.position;
        // Gold pick-up.
        this.level.coins.forEach((coin, i) => {
            if (!this.collected[i] && coin.sqrDistanceTo(pos) < COIN_PICK_RADIUS * COIN_PICK_RADIUS) {
                this.collected[i] = true;
                this.gold += 1;
                this.events.push({ type: "coin" });
                if (this.gold === this.def.coinsRequired) {
                    scene.exitOpen = true;
                    this.events.push({ type: "exit-open" });
                }
            }
        });
        // Guardians bounce between walls along their axis.
        const speed = this.def.guardianSpeed;
        for (const g of this.guardians) {
            const step = g.axis.scale(g.sign * speed * deltaTime);
            const next = g.pos.add(step);
            const probe = next.add(g.axis.scale(g.sign * 0.45));
            if (scene.isWall(probe)) {
                g.sign = -g.sign;
            }
            else {
                g.pos = next;
            }
            if (this.invulnerable <= 0 && g.pos.sqrDistanceTo(pos) < GUARDIAN_HIT_RADIUS * GUARDIAN_HIT_RADIUS) {
                this.hearts -= 1;
                this.invulnerable = INVULNERABILITY_TIME;
                this.events.push({ type: "hurt" });
                if (this.hearts <= 0) {
                    this.lose("caught");
                    return;
                }
            }
        }
        if (!this.warnedTime && this.timeLeft <= 20) {
            this.warnedTime = true;
            this.events.push({ type: "time-warning" });
        }
        // Exit.
        if (Math.floor(pos.x) === scene.exitX && Math.floor(pos.y) === scene.exitY) {
            if (scene.exitOpen) {
                this.state = "won";
                this.events.push({ type: "won" });
                return;
            }
            else if (this.lockedHintCooldown <= 0) {
                this.lockedHintCooldown = 2.5;
                this.events.push({ type: "exit-locked", missing: this.def.coinsRequired - this.gold });
            }
        }
        if (this.timeLeft <= 0)
            this.lose("time");
    }
    lose(reason) {
        this.state = "lost";
        this.lostReason = reason;
        this.events.push({ type: "lost", reason });
    }
    result() {
        return { gold: this.gold, totalGold: this.totalGold, elapsed: this.elapsed, timeLeft: this.timeLeft };
    }
    sprites(t, tex) {
        const list = [];
        for (const d of this.level.decor) {
            const texture = tex.decor[d.texture];
            if (texture === undefined)
                continue;
            list.push({ pos: d.pos, texture, width: 1, height: 1, z: 0, emissive: false, scaleX: 1, alpha: 1 });
        }
        const open = this.exitOpen;
        list.push({
            pos: this.level.exit,
            texture: open ? tex.portalOpen : tex.portalLocked,
            width: 0.62,
            height: 0.86,
            z: 0.02,
            emissive: true,
            scaleX: 1,
            alpha: 0.75 + 0.2 * Math.sin(t * 3),
        });
        this.level.coins.forEach((pos, i) => {
            if (this.collected[i])
                return;
            list.push({
                pos,
                texture: tex.coin,
                width: 0.32,
                height: 0.32,
                z: 0.28 + 0.04 * Math.sin(t * 2.2 + i),
                emissive: true,
                scaleX: Math.abs(Math.cos(t * 2.5 + i * 0.7)),
                alpha: 1,
            });
        });
        this.guardians.forEach((g, i) => {
            list.push({
                pos: g.pos,
                texture: tex.guardian,
                width: 0.7,
                height: 0.8,
                z: 0.08 + 0.06 * Math.sin(t * 3 + i),
                emissive: true,
                scaleX: 1,
                alpha: 0.92,
            });
        });
        return list;
    }
    snapshot() {
        return {
            levelId: this.def.id,
            x: this.player.position.x,
            y: this.player.position.y,
            direction: this.player.direction,
            timeLeft: this.timeLeft,
            elapsed: this.elapsed,
            hearts: this.hearts,
            collected: this.collected.flatMap((c, i) => (c ? [i] : [])),
            guardians: this.guardians.map((g) => ({ x: g.pos.x, y: g.pos.y, sign: g.sign })),
        };
    }
    restore(snap) {
        this.player.position = new Vector2(snap.x, snap.y);
        this.player.direction = snap.direction;
        this.timeLeft = Math.min(this.timeLimit, Math.max(1, snap.timeLeft));
        this.elapsed = Math.max(0, snap.elapsed);
        this.hearts = Math.min(this.maxHearts, Math.max(1, snap.hearts));
        for (const i of snap.collected) {
            if (i >= 0 && i < this.collected.length && !this.collected[i]) {
                this.collected[i] = true;
                this.gold += 1;
            }
        }
        snap.guardians.forEach((g, i) => {
            const guardian = this.guardians[i];
            if (guardian !== undefined) {
                guardian.pos = new Vector2(g.x, g.y);
                guardian.sign = g.sign >= 0 ? 1 : -1;
            }
        });
        this.level.scene.exitOpen = this.gold >= this.def.coinsRequired;
        this.warnedTime = this.timeLeft <= 20;
    }
}
//# sourceMappingURL=session.js.map