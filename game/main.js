"use strict";
// Game bootstrap: canvas setup (from the original index.ts), asset loading,
// state machine, input and the single requestAnimationFrame loop.
const WALL_TEXTURES = [
    "eagle",
    "mossy",
    "greystone",
    "bluestone",
    "colorstone",
    "purplestone",
    "redbrick",
    "wood",
];
const DECOR_TEXTURES = ["barrel", "pillar", "greenlight"];
const MAX_DELTA_TIME = 0.1; // avoids tunnelling through walls after a long frame
class InputState {
    keys = { forward: false, backward: false, turnLeft: false, turnRight: false };
    touch = { forward: false, backward: false, turnLeft: false, turnRight: false };
    get controls() {
        return {
            forward: this.keys.forward || this.touch.forward,
            backward: this.keys.backward || this.touch.backward,
            turnLeft: this.keys.turnLeft || this.touch.turnLeft,
            turnRight: this.keys.turnRight || this.touch.turnRight,
        };
    }
    clear() {
        for (const c of [this.keys, this.touch]) {
            c.forward = c.backward = c.turnLeft = c.turnRight = false;
        }
        document.querySelectorAll("#touch .held").forEach((b) => b.classList.remove("held"));
    }
}
// Original key bindings (W/S/A/D by physical key, i.e. Z/S/Q/D on AZERTY) plus arrows.
const KEY_BINDINGS = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "backward",
    ArrowDown: "backward",
    KeyA: "turnLeft",
    ArrowLeft: "turnLeft",
    KeyD: "turnRight",
    ArrowRight: "turnRight",
};
class Game {
    ctx;
    backCtx;
    backImageData;
    save = new SaveSystem();
    ui = new UI(this.save);
    sfx = new Sfx();
    input = new InputState();
    sprites = new SpriteRenderer();
    textures = {};
    spriteTextures;
    mode = "loading";
    screens = [];
    session = null;
    resumeRun = false;
    showMinimap = true;
    original; // original prototype scene (Mode libre)
    attract; // menu background camera
    time = 0;
    fps = 60;
    constructor(canvas) {
        // Same canvas setup as the original bootstrap.
        const ctx = canvas.getContext("2d");
        const factor = 80;
        canvas.width = 16 * factor;
        canvas.height = 9 * factor;
        if (ctx === null)
            throw new Error("2d context is not supported ");
        ctx.imageSmoothingEnabled = false;
        this.ctx = ctx;
        this.backImageData = new ImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
        const backCanvas = new OffscreenCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
        const backCtx = backCanvas.getContext("2d");
        if (backCtx === null)
            throw new Error("2D context is not supported");
        backCtx.imageSmoothingEnabled = false;
        this.backCtx = backCtx;
        this.applySettings();
    }
    async load() {
        const names = [...WALL_TEXTURES, ...DECOR_TEXTURES];
        let loaded = 0;
        const results = await Promise.all(names.map((name) => loadImageData(`assets/wlftex/${name}.png`)
            .catch(() => null)
            .then((img) => {
            loaded += 1;
            this.ui.setLoading(loaded / names.length, `Chargement des textures… ${loaded}/${names.length}`);
            return img;
        })));
        const decor = {};
        names.forEach((name, i) => {
            const img = results[i];
            if (DECOR_TEXTURES.includes(name)) {
                if (img)
                    decor[name] = keyOutBlack(img);
            }
            else {
                this.textures[name] = img ?? RGBA.purple();
            }
        });
        this.spriteTextures = {
            coin: makeCoinTexture(),
            guardian: makeGuardianTexture(),
            portalOpen: makePortalTexture(true),
            portalLocked: makePortalTexture(false),
            decor,
        };
        this.original = buildOriginalScene(this.textures);
        this.attract = buildOriginalScene(this.textures);
    }
    // ----- Settings -----
    applySettings() {
        const s = this.save.data.settings;
        this.sfx.configure(s.sound, s.volume);
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        const touch = s.touchControls === "on" || (s.touchControls === "auto" && coarse);
        document.getElementById("touch").dataset["enabled"] = touch ? "1" : "0";
        this.updateTouchVisibility();
    }
    updateTouchVisibility() {
        const el = document.getElementById("touch");
        const active = (this.mode === "playing" || this.mode === "sandbox") && el.dataset["enabled"] === "1";
        el.classList.toggle("hidden", !active);
    }
    // ----- Navigation -----
    setMode(mode) {
        this.mode = mode;
        if (mode !== "playing" && mode !== "sandbox")
            this.input.clear();
        document.getElementById("hud").classList.toggle("hidden", !(mode === "playing" || mode === "paused" || mode === "result"));
        document.getElementById("sandbox-bar").classList.toggle("hidden", mode !== "sandbox");
        this.updateTouchVisibility();
    }
    openScreen(id, replace = false) {
        if (replace)
            this.screens.pop();
        this.screens.push(id);
        this.renderScreen(id);
        this.ui.showScreen(id);
    }
    renderScreen(id) {
        switch (id) {
            case "menu":
                this.ui.renderMenu();
                break;
            case "levels":
                this.ui.renderLevels();
                break;
            case "map":
                this.ui.renderMap();
                break;
            case "shop":
                this.ui.renderShop();
                break;
            case "settings":
                this.ui.renderSettings();
                break;
        }
    }
    back() {
        const leaving = this.screens.pop();
        const target = this.screens[this.screens.length - 1];
        if (leaving === "briefing") {
            this.session = null;
            this.setMode("menu");
        }
        if (target === undefined) {
            this.goToMenu();
            return;
        }
        this.renderScreen(target);
        this.ui.showScreen(target);
    }
    goToMenu() {
        this.session = null;
        this.setMode("menu");
        this.screens = [];
        this.openScreen("menu");
    }
    goToMap(selected) {
        this.session = null;
        this.setMode("menu");
        this.screens = ["menu"];
        this.ui.mapSelection = selected ?? this.save.nextLevelIndex();
        this.openScreen("map");
    }
    // ----- Levels -----
    newSession(index) {
        return new LevelSession(index, this.textures, sessionModifiers(this.save));
    }
    openBriefing(index) {
        if (!this.save.isUnlocked(index)) {
            this.ui.toast(`Termine « ${LEVELS[index - 1].name} » pour débloquer ce niveau.`, "bad");
            return;
        }
        this.session = this.newSession(index);
        this.resumeRun = false;
        this.ui.renderBriefing(this.session, false);
        this.setMode("briefing");
        this.openScreen("briefing");
    }
    resumeSavedRun() {
        const run = this.save.data.run;
        if (run === null)
            return false;
        const index = LEVELS.findIndex((l) => l.id === run.levelId);
        if (index < 0 || !this.save.isUnlocked(index)) {
            this.save.data.run = null;
            this.save.save();
            return false;
        }
        const session = this.newSession(index);
        session.restore(run);
        this.session = session;
        this.resumeRun = true;
        this.ui.renderBriefing(session, true);
        this.setMode("briefing");
        this.openScreen("briefing");
        return true;
    }
    startLevel() {
        if (this.session === null)
            return;
        if (!this.resumeRun) {
            this.save.data.run = null;
            this.save.save();
        }
        this.screens = [];
        this.ui.showScreen(null);
        this.ui.resetHud(this.session, this.save.hasUpgrade("compass"));
        this.setMode("playing");
    }
    restartLevel() {
        if (this.session === null)
            return;
        this.session = this.newSession(this.session.index);
        this.resumeRun = false;
        this.startLevel();
    }
    pause() {
        if (this.mode !== "playing" || this.session === null)
            return;
        this.setMode("paused");
        this.ui.renderPause(this.session);
        this.screens = [];
        this.openScreen("pause");
    }
    resume() {
        if (this.mode !== "paused")
            return;
        this.screens = [];
        this.ui.showScreen(null);
        this.setMode("playing");
    }
    // Keeps the level in progress so "Continuer" can resume it later.
    storeRun() {
        if (this.session !== null && this.session.state === "playing" && (this.mode === "playing" || this.mode === "paused")) {
            this.save.data.run = this.session.snapshot();
            this.save.save();
        }
    }
    finishLevel(session) {
        this.setMode("result");
        this.screens = [];
        if (session.state === "won") {
            const reward = this.save.applyVictory(session.index, session.result());
            this.sfx.play("win");
            this.ui.renderVictory(session, reward);
            this.openScreen("victory");
        }
        else {
            this.save.applyDefeat(session.index);
            this.sfx.play("lose");
            this.ui.renderDefeat(session);
            this.openScreen("defeat");
        }
    }
    // ----- Actions from the UI -----
    async handleAction(action, el) {
        this.sfx.unlock();
        this.sfx.play("click");
        switch (action) {
            case "continue":
                if (!this.resumeSavedRun())
                    this.openBriefing(this.save.nextLevelIndex());
                break;
            case "open-levels":
                this.openScreen("levels");
                break;
            case "open-map":
                this.ui.mapSelection = this.save.nextLevelIndex();
                this.openScreen("map");
                break;
            case "open-shop":
                this.openScreen("shop");
                break;
            case "open-settings":
                this.openScreen("settings");
                break;
            case "back":
                this.back();
                break;
            case "select-level":
                this.openBriefing(Number(el.dataset["index"]));
                break;
            case "map-node": {
                const index = Number(el.dataset["index"]);
                if (!this.save.isUnlocked(index)) {
                    this.ui.toast(`Termine « ${LEVELS[index - 1].name} » pour débloquer ce niveau.`, "bad");
                }
                this.ui.mapSelection = index;
                this.ui.renderMap();
                break;
            }
            case "start-level":
                this.startLevel();
                break;
            case "resume":
                this.resume();
                break;
            case "restart":
                this.restartLevel();
                break;
            case "pause-to-menu":
                this.storeRun();
                this.goToMenu();
                this.ui.toast("Partie sauvegardée — « Continuer » pour la reprendre", "good", 3);
                break;
            case "pause-to-map":
                this.storeRun();
                this.goToMap(this.session?.index);
                break;
            case "next-level":
                if (this.session !== null) {
                    const next = this.session.index + 1;
                    this.goToMenu();
                    this.openBriefing(next);
                }
                break;
            case "result-map":
                this.goToMap(this.session === null ? undefined : Math.min(LEVELS.length - 1, this.session.index + 1));
                break;
            case "result-menu":
                this.goToMenu();
                break;
            case "buy": {
                const upgrade = UPGRADES.find((u) => u.id === el.dataset["id"]);
                if (upgrade !== undefined && this.save.buyUpgrade(upgrade.id, upgrade.cost)) {
                    this.sfx.play("buy");
                    this.ui.toast(`${upgrade.name} acquis !`, "gold");
                }
                this.ui.renderShop();
                break;
            }
            case "reset-save":
                if (await this.ui.confirm("Réinitialiser ?", "Tous les niveaux, l'or et les améliorations seront effacés.", "Réinitialiser")) {
                    this.save.reset();
                    this.ui.toast("Progression réinitialisée", "bad");
                    this.renderScreen("settings");
                }
                break;
            case "sandbox":
                this.screens = [];
                this.ui.showScreen(null);
                this.original = buildOriginalScene(this.textures);
                this.setMode("sandbox");
                break;
            case "sandbox-exit":
                this.goToMenu();
                break;
            case "quit":
                if (await this.ui.confirm("Quitter le jeu ?", "Ta progression est déjà sauvegardée.", "Quitter")) {
                    // Browsers only let a script close a window it opened itself.
                    if (window.opener !== null)
                        window.close();
                    this.setMode("quit");
                    this.screens = [];
                    this.openScreen("quit");
                }
                break;
            case "back-to-menu":
                this.goToMenu();
                break;
        }
    }
    onSettingChanged() {
        const s = this.save.data.settings;
        s.sound = document.getElementById("set-sound").checked;
        s.volume = Number(document.getElementById("set-volume").value);
        s.turnSensitivity = Number(document.getElementById("set-turn").value);
        s.showFps = document.getElementById("set-fps").checked;
        s.touchControls = document.getElementById("set-touch").value;
        this.save.save();
        this.applySettings();
    }
    onEscape() {
        const top = this.screens[this.screens.length - 1];
        if (!document.getElementById("modal").classList.contains("hidden")) {
            document.getElementById("modal-cancel").click();
        }
        else if (this.mode === "playing") {
            this.pause();
        }
        else if (this.mode === "paused" && top === "pause") {
            this.resume();
        }
        else if (this.mode === "sandbox") {
            this.goToMenu();
        }
        else if (top !== undefined && top !== "menu" && top !== "victory" && top !== "defeat" && top !== "quit") {
            this.sfx.play("click");
            this.back();
        }
    }
    onEnter() {
        const top = this.screens[this.screens.length - 1];
        if (top === "briefing")
            this.startLevel();
        else if (top === "victory")
            document.getElementById("win-next").click();
    }
    // ----- Session events -> feedback -----
    processEvents(session) {
        for (const event of session.events) {
            switch (event.type) {
                case "coin":
                    this.sfx.play("coin");
                    break;
                case "exit-open":
                    this.sfx.play("exit-open");
                    this.ui.toast("La sortie est ouverte ! Suis la lumière verte.", "good", 3);
                    break;
                case "exit-locked":
                    this.sfx.play("locked");
                    this.ui.toast(`Sortie verrouillée : encore ${event.missing} pièce${event.missing > 1 ? "s" : ""}`, "bad");
                    break;
                case "hurt":
                    this.sfx.play("hurt");
                    this.ui.flash();
                    this.ui.toast(session.hearts > 0 ? "Un gardien t'a touché !" : "Plus de cœurs…", "bad");
                    break;
                case "time-warning":
                    this.sfx.play("warning");
                    this.ui.toast("Plus que 20 secondes !", "bad");
                    break;
                case "won":
                case "lost":
                    break;
            }
        }
        session.events = [];
        if (session.state !== "playing")
            this.finishLevel(session);
    }
    // ----- Rendering -----
    renderWorld(player, scene, sprites) {
        const img = this.backImageData;
        img.data.fill(255);
        renderCeilingToImageData(img, player, scene);
        renderFloorToImageData(img, player, scene);
        renderWallsToImageData(img, player, scene);
        if (sprites !== null)
            this.sprites.render(img, player, scene, sprites);
        this.backCtx.putImageData(img, 0, 0);
        this.ctx.drawImage(this.backCtx.canvas, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }
    renderSession(session) {
        this.renderWorld(session.player, session.level.scene, session.sprites(this.time, this.spriteTextures));
        if (this.save.hasUpgrade("map") && this.showMinimap)
            this.renderLevelMinimap(session);
    }
    // Uses the original renderMinimap, with markers drawn on top in the same grid space.
    renderLevelMinimap(session) {
        const ctx = this.ctx;
        const scene = session.level.scene;
        const cell = Math.min(14, 300 / scene.width);
        const size = scene.size().scale(cell);
        const position = new Vector2(ctx.canvas.width - size.x - 26, 112);
        ctx.save();
        ctx.globalAlpha = 0.85;
        renderMinimap(ctx, session.player, position, size, scene);
        ctx.translate(position.x, position.y);
        ctx.scale(cell, cell);
        ctx.fillStyle = session.exitOpen ? "#57d98a" : "#ef5b5b";
        ctx.fillRect(scene.exitX + 0.15, scene.exitY + 0.15, 0.7, 0.7);
        ctx.fillStyle = "#f5c542";
        session.level.coins.forEach((c, i) => {
            if (!session.collected[i])
                fillCircle(ctx, c, 0.2);
        });
        ctx.fillStyle = "#ff4d6d";
        for (const g of session.guardians)
            fillCircle(ctx, g.pos, 0.3);
        ctx.restore();
    }
    compassAngle(session) {
        if (!this.save.hasUpgrade("compass"))
            return null;
        const d = session.level.exit.sub(session.player.position);
        return Math.atan2(d.y, d.x) - session.player.direction;
    }
    frame(deltaTime) {
        this.time += deltaTime;
        if (deltaTime > 0)
            this.fps = this.fps * 0.92 + (1 / deltaTime) * 0.08;
        const settings = this.save.data.settings;
        const turnSpeed = Math.PI * settings.turnSensitivity;
        switch (this.mode) {
            case "menu":
                // Slow camera turn inside the original prototype scene.
                this.attract.player.direction += deltaTime * 0.12;
                this.renderWorld(this.attract.player, this.attract.scene, null);
                break;
            case "briefing":
                if (this.session !== null)
                    this.renderSession(this.session);
                break;
            case "playing": {
                const session = this.session;
                if (session === null)
                    break;
                session.update(Math.min(deltaTime, MAX_DELTA_TIME), this.input.controls, turnSpeed);
                this.renderSession(session);
                this.ui.updateHud(session, settings.showFps ? this.fps : null, this.compassAngle(session));
                this.processEvents(session);
                break;
            }
            case "sandbox":
                // The original prototype, rendered by the original renderGameIntoImageData.
                stepPlayer(this.original.scene, this.original.player, this.input.controls, Math.min(deltaTime, MAX_DELTA_TIME), PLAYER_SPEED, turnSpeed);
                renderGameIntoImageData(this.ctx, this.backCtx, this.backImageData, deltaTime, this.original.player, this.original.scene);
                break;
            default:
                // Paused, result and quit screens keep the last rendered frame.
                break;
        }
    }
}
function bindInput(game) {
    window.addEventListener("keydown", (e) => {
        const binding = KEY_BINDINGS[e.code];
        if (binding !== undefined && (game.mode === "playing" || game.mode === "sandbox")) {
            game.input.keys[binding] = true;
            e.preventDefault();
            return;
        }
        if (e.repeat)
            return;
        switch (e.code) {
            case "Escape":
                game.onEscape();
                break;
            case "KeyP":
                if (game.mode === "playing" || game.mode === "paused")
                    game.onEscape();
                break;
            case "Enter":
            case "NumpadEnter":
                // A focused button already reacts to Enter natively.
                if (!(document.activeElement instanceof HTMLButtonElement))
                    game.onEnter();
                break;
            case "Semicolon": // "M" on AZERTY
            case "KeyM":
                if (game.mode === "playing" && game.save.hasUpgrade("map")) {
                    game.showMinimap = !game.showMinimap;
                }
                break;
        }
    });
    window.addEventListener("keyup", (e) => {
        const binding = KEY_BINDINGS[e.code];
        if (binding !== undefined)
            game.input.keys[binding] = false;
    });
    // Losing focus releases keys and pauses the level.
    window.addEventListener("blur", () => {
        game.input.clear();
        game.pause();
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            game.pause();
            game.storeRun();
        }
    });
    window.addEventListener("pagehide", () => game.storeRun());
    // UI buttons (event delegation on data-action).
    document.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (target === null || target.disabled)
            return;
        void game.handleAction(target.dataset["action"], target);
    });
    document.getElementById("hud-pause").addEventListener("click", () => game.pause());
    document.querySelectorAll("#screen-settings input, #screen-settings select").forEach((el) => el.addEventListener("input", () => game.onSettingChanged()));
    window.addEventListener("pointerdown", () => game.sfx.unlock());
    // Touch controls.
    document.querySelectorAll("#touch [data-key]").forEach((button) => {
        const key = button.dataset["key"];
        const set = (value) => (e) => {
            e.preventDefault();
            game.input.touch[key] = value;
            button.classList.toggle("held", value);
        };
        button.addEventListener("pointerdown", set(true));
        button.addEventListener("pointerup", set(false));
        button.addEventListener("pointercancel", set(false));
        button.addEventListener("pointerleave", set(false));
        button.addEventListener("contextmenu", (e) => e.preventDefault());
    });
}
(async () => {
    const canvas = document.getElementById("game");
    if (canvas === null)
        throw new Error("No canvas with id 'game' is found");
    const game = new Game(canvas);
    window.raycastingGame = game;
    await game.load();
    bindInput(game);
    game.goToMenu();
    let prevTimestamp = 0;
    const loop = (timestamp) => {
        const deltaTime = (timestamp - prevTimestamp) / 1000;
        prevTimestamp = timestamp;
        game.frame(deltaTime);
        window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(loop);
    });
})();
//# sourceMappingURL=main.js.map