"use strict";
// DOM user interface: screens, HUD, world map, shop, dialogs.
// Positions of the level nodes on the world map board, in % of the board.
const MAP_NODES = [
    [9, 72],
    [19, 36],
    [27, 70],
    [42, 30],
    [52, 70],
    [61, 34],
    [76, 66],
    [90, 32],
];
const HEART_SVG = '<svg viewBox="0 0 24 24"><path fill="#ef5b5b" stroke="#2a0b0b" stroke-width="1.2" d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/></svg>';
const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0110 0v3h1a1 1 0 011 1v10H5V11a1 1 0 011-1zm2 0h6V7a3 3 0 00-6 0z"/></svg>';
function $(id) {
    const el = document.getElementById(id);
    if (el === null)
        throw new Error(`Missing element #${id}`);
    return el;
}
function formatTime(seconds) {
    if (seconds === null)
        return "—";
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function starsHtml(n) {
    let html = '<span class="stars">';
    for (let i = 0; i < 3; ++i)
        html += `<span class="${i < n ? "on" : ""}">★</span>`;
    return html + "</span>";
}
// Absolute URL: CSS variables resolve relative URLs against the stylesheet, not the page.
function textureUrl(name) {
    return new URL(`assets/wlftex/${name}.png`, document.baseURI).href;
}
class UI {
    save;
    hud = {
        name: "",
        timer: "",
        timerWarn: false,
        gold: "",
        exitOpen: null,
        hearts: -1,
        fps: "",
    };
    hintTimer = 0;
    menuIndex = 0;
    mapSelection = 0;
    constructor(save) {
        this.save = save;
    }
    // ----- Screens -----
    showScreen(id) {
        document.querySelectorAll(".screen").forEach((s) => {
            s.classList.toggle("active", s.id === `screen-${id}`);
        });
        if (id === "menu") {
            this.menuSelect(this.menuIndex);
            return;
        }
        const active = id === null ? null : document.getElementById(`screen-${id}`);
        const focus = active?.querySelector(".btn.primary:not(:disabled)");
        if (focus)
            focus.focus({ preventScroll: true });
    }
    setLoading(progress, text) {
        $("loading-bar").style.width = `${Math.round(progress * 100)}%`;
        $("loading-text").textContent = text;
    }
    refreshWallets() {
        document.querySelectorAll(".wallet-gold").forEach((el) => (el.textContent = String(this.save.data.gold)));
    }
    // ----- Main menu -----
    // Keyboard-driven list: one selected item, moved by the arrows or the mouse.
    // The selection is kept between visits, so "back" returns to the same item.
    menuItems() {
        return Array.from(document.querySelectorAll("#menu-list .retro-item"));
    }
    menuSelect(index) {
        const items = this.menuItems();
        if (items.length === 0)
            return;
        this.menuIndex = (index + items.length) % items.length;
        items.forEach((item, i) => item.classList.toggle("selected", i === this.menuIndex));
        const item = items[this.menuIndex];
        if (document.activeElement !== item)
            item.focus({ preventScroll: true });
        $("menu-desc").textContent = item.dataset["desc"] ?? "";
    }
    menuMove(step) {
        this.menuSelect(this.menuIndex + step);
    }
    menuIndexOf(item) {
        return this.menuItems().indexOf(item);
    }
    menuActivate() {
        this.menuItems()[this.menuIndex]?.click();
    }
    renderMenu() {
        const save = this.save;
        const run = save.data.run;
        const label = $("menu-continue-label");
        const item = $("menu-continue");
        const runIndex = run === null ? -1 : LEVELS.findIndex((l) => l.id === run.levelId);
        if (run !== null && runIndex >= 0) {
            label.textContent = "Continuer";
            item.dataset["desc"] = `Reprendre « ${LEVELS[runIndex].name} » — ${formatTime(run.timeLeft)} restantes`;
        }
        else {
            const next = save.nextLevelIndex();
            label.textContent = save.completedCount() === 0 ? "Nouvelle partie" : "Continuer";
            item.dataset["desc"] = `Niveau ${next + 1} — ${LEVELS[next].name}`;
        }
        const done = save.completedCount();
        $("stat-levels").textContent = `${done}/${LEVELS.length}`;
        $("stat-progress").innerHTML = LEVELS.map((_, i) => `<i class="${i < done ? "on" : ""}"></i>`).join("");
        $("stat-stars").textContent = `${save.totalStars()}/${LEVELS.length * 3}`;
        $("stat-gold").textContent = String(save.data.gold);
        $("stat-upgrades").textContent = `${UPGRADES.filter((u) => save.hasUpgrade(u.id)).length}/${UPGRADES.length}`;
        this.refreshWallets();
    }
    // ----- Level selection -----
    renderLevels() {
        const save = this.save;
        const current = save.nextLevelIndex();
        let html = "";
        ZONES.forEach((zone, z) => {
            html += `<section><div class="zone-title"><h3 style="color:${zone.accent}">${zone.name}</h3><span>${zone.subtitle}</span></div><div class="cards">`;
            LEVELS.forEach((def, i) => {
                if (def.zone !== z)
                    return;
                const rec = save.record(def.id);
                const unlocked = save.isUnlocked(i);
                const cls = ["level-card", unlocked ? "" : "locked", i === current && unlocked ? "current" : ""].join(" ");
                html += `<button class="${cls}" data-action="select-level" data-index="${i}" style="--tex:url(${textureUrl(def.walls["#"] ?? zone.texture)});--accent:${zone.accent}" ${unlocked ? "" : 'aria-disabled="true"'}>
          ${unlocked ? "" : LOCK_SVG}
          <span class="num">${i + 1}</span>
          <span class="name">${def.name}</span>
          ${starsHtml(rec.stars)}
          <span class="meta"><span>${unlocked ? (rec.completed ? "Terminé" : "Disponible") : "Verrouillé"}</span><span>${rec.bestTime !== null ? "Record " + formatTime(rec.bestTime) : ""}</span></span>
        </button>`;
            });
            html += "</div></section>";
        });
        $("levels-grid").innerHTML = html;
        this.refreshWallets();
    }
    // ----- World map -----
    renderMap() {
        const save = this.save;
        const board = $("map-board");
        const current = save.nextLevelIndex();
        let html = "";
        ZONES.forEach((zone, z) => {
            const first = LEVELS.findIndex((l) => l.zone === z);
            const locked = !save.isUnlocked(first);
            html += `<div class="map-zone ${locked ? "locked" : ""}" style="--tex:url(${textureUrl(zone.texture)})">
        <div class="map-zone-label" style="color:${zone.accent}">${zone.name}<small>${locked ? "Verrouillée" : zone.subtitle}</small></div></div>`;
        });
        // Path between nodes: full path dimmed, then the unlocked part highlighted.
        const pathFor = (count) => MAP_NODES.slice(0, count)
            .map(([x, y], i) => {
            if (i === 0)
                return `M ${x} ${y}`;
            const [px, py] = MAP_NODES[i - 1];
            return `C ${(px + x) / 2} ${py}, ${(px + x) / 2} ${y}, ${x} ${y}`;
        })
            .join(" ");
        const unlockedCount = LEVELS.filter((_, i) => save.isUnlocked(i)).length;
        html += `<svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="${pathFor(MAP_NODES.length)}" stroke="rgba(255,255,255,0.18)" stroke-width="3" stroke-dasharray="2 8"/>
      <path d="${pathFor(unlockedCount)}" stroke="#f5c542" stroke-width="4" opacity="0.85"/>
    </svg>`;
        LEVELS.forEach((def, i) => {
            const [x, y] = MAP_NODES[i] ?? [50, 50];
            const rec = save.record(def.id);
            const unlocked = save.isUnlocked(i);
            const zone = ZONES[def.zone];
            const cls = ["map-node", rec.completed ? "done" : "", unlocked ? "" : "locked", i === this.mapSelection ? "selected" : ""].join(" ");
            html += `<button class="${cls}" style="left:${x}%;top:${y}%;--accent:${zone.accent}" data-action="map-node" data-index="${i}" title="${def.name}">
        ${unlocked ? i + 1 : "🔒"}${rec.completed ? `<span class="node-stars">${starsHtml(rec.stars)}</span>` : ""}
      </button>`;
        });
        const [cx, cy] = MAP_NODES[current] ?? [50, 50];
        html += `<div class="map-player" style="left:${cx}%;top:${cy}%"></div>`;
        board.innerHTML = html;
        this.renderMapPanel();
        this.refreshWallets();
    }
    renderMapPanel() {
        const i = this.mapSelection;
        const def = LEVELS[i];
        const zone = ZONES[def.zone];
        const rec = this.save.record(def.id);
        const unlocked = this.save.isUnlocked(i);
        const coins = def.map.join("").split("c").length - 1;
        $("map-panel").innerHTML = `
      <p class="eyebrow" style="color:${zone.accent}">${zone.name} · Niveau ${i + 1}</p>
      <h4>${def.name}</h4>
      <p class="muted">${def.intro}</p>
      <div class="stat"><span>Étoiles</span>${starsHtml(rec.stars)}</div>
      <div class="stat"><span>Meilleur temps</span><strong>${formatTime(rec.bestTime)}</strong></div>
      <div class="stat"><span>Or (record)</span><strong>${rec.bestGold} / ${coins}</strong></div>
      <div class="stat"><span>Objectif</span><strong>${def.coinsRequired} pièces + sortie</strong></div>
      ${unlocked
            ? `<button class="btn primary" data-action="select-level" data-index="${i}">${rec.completed ? "Rejouer" : "Jouer"}</button>`
            : `<p class="muted">🔒 Termine « ${LEVELS[i - 1].name} » pour débloquer ce niveau.</p>`}`;
    }
    // ----- Shop -----
    renderShop() {
        const save = this.save;
        $("shop-grid").innerHTML = UPGRADES.map((u) => {
            const owned = save.hasUpgrade(u.id);
            const affordable = save.data.gold >= u.cost;
            return `<div class="panel shop-card ${owned ? "owned" : ""}">
        <div class="icon">${u.icon}</div>
        <h4>${u.name}</h4>
        <p>${u.description}</p>
        <div class="buy-row">
          <span class="price"><span class="coin-icon"></span>${u.cost}</span>
          ${owned
                ? '<span class="owned-tag">✓ Acquis</span>'
                : `<button class="btn small ${affordable ? "primary" : ""}" data-action="buy" data-id="${u.id}" ${affordable ? "" : "disabled"}>${affordable ? "Acheter" : `Il manque ${u.cost - save.data.gold}`}</button>`}
        </div>
      </div>`;
        }).join("");
        this.refreshWallets();
    }
    // ----- Settings -----
    renderSettings() {
        const s = this.save.data.settings;
        $("set-sound").checked = s.sound;
        $("set-volume").value = String(s.volume);
        $("set-turn").value = String(s.turnSensitivity);
        $("set-fps").checked = s.showFps;
        $("set-touch").value = s.touchControls;
        $("save-warning").classList.toggle("hidden", this.save.persistent);
    }
    // ----- Briefing -----
    renderBriefing(session, resume) {
        const def = session.def;
        const zone = ZONES[def.zone];
        $("brief-zone").textContent = `${zone.name} · Niveau ${session.index + 1} / ${LEVELS.length}`;
        $("brief-zone").style.color = zone.accent;
        $("brief-title").textContent = resume ? `Reprise : ${def.name}` : def.name;
        $("brief-intro").textContent = def.intro;
        const objectives = [
            `<li><span>🪙</span><span>Ramasse au moins <b>${def.coinsRequired}</b> pièces d'or (${session.totalGold} cachées dans le niveau)</span></li>`,
            `<li><span>🟩</span><span>Rejoins la <b>sortie</b> (lumière verte) une fois déverrouillée</span></li>`,
            `<li><span>⏳</span><span>Avant la fin du temps : <b>${formatTime(session.timeLimit)}</b></span></li>`,
        ];
        if (session.guardians.length > 0) {
            objectives.push(`<li><span>👻</span><span>Évite les <b>${session.guardians.length}</b> gardien${session.guardians.length > 1 ? "s" : ""} : tu as <b>${session.maxHearts}</b> cœurs</span></li>`);
        }
        if (resume) {
            objectives.push(`<li><span>💾</span><span>Partie sauvegardée : <b>${session.gold}</b> pièces, <b>${formatTime(session.timeLeft)}</b> restantes, <b>${session.hearts}</b> cœurs</span></li>`);
        }
        $("brief-objectives").innerHTML = objectives.join("");
        $("brief-stars").innerHTML = `
      <div><b>★</b>Terminer le niveau</div>
      <div><b>★★</b>Toutes les pièces (${session.totalGold})</div>
      <div><b>★★★</b>En moins de ${formatTime(def.parTime)}</div>`;
        $("brief-start").textContent = resume ? "Reprendre" : "Commencer";
    }
    // ----- Pause -----
    renderPause(session) {
        $("pause-info").textContent = `${session.def.name} — ${session.gold}/${session.def.coinsRequired} pièces · ${formatTime(session.timeLeft)} restantes`;
    }
    // ----- Results -----
    renderVictory(session, reward) {
        $("win-title").textContent = session.def.name;
        $("win-stars").innerHTML = [0, 1, 2]
            .map((i) => `<span class="${i < reward.stars ? "on" : ""}" style="animation-delay:${0.15 + i * 0.25}s">★</span>`)
            .join("");
        $("win-stats").innerHTML = `
      <div><b>${formatTime(session.elapsed)}</b>Temps${reward.newBestTime ? " · record !" : ""}</div>
      <div><b>${session.gold} / ${session.totalGold}</b>Pièces</div>
      <div><b>${session.hearts} / ${session.maxHearts}</b>Cœurs</div>`;
        const row = (label, value, note = "") => `<div class="row ${value === 0 ? "dim" : ""}"><span>${label}${note ? ` <small class="muted">${note}</small>` : ""}</span><span>+${value}</span></div>`;
        $("win-rewards").innerHTML =
            row("Pièces ramassées", reward.pickup, reward.firstClear ? "" : "(rejouer : 50 %)") +
                row("Bonus de première victoire", reward.clearBonus, reward.firstClear ? "" : "(déjà obtenu)") +
                row("Nouvelles étoiles", reward.starBonus, `(${reward.newStars} × 10)`) +
                row("Bonus de temps", reward.timeBonus, reward.newBestTime ? "(nouveau record)" : "(pas de record)") +
                `<div class="row total"><span>Total</span><span><span class="coin-icon"></span> +${reward.total}</span></div>`;
        const nextDef = LEVELS[session.index + 1];
        const unlockEl = $("win-unlock");
        unlockEl.textContent = !reward.firstClear
            ? ""
            : nextDef !== undefined
                ? `🔓 Nouveau niveau débloqué : ${nextDef.name}`
                : "🏆 Tu as traversé toute la forteresse !";
        unlockEl.classList.toggle("hidden", unlockEl.textContent === "");
        const next = $("win-next");
        const isLast = session.index >= LEVELS.length - 1;
        next.disabled = false;
        next.textContent = isLast ? "Voir la carte" : "Niveau suivant";
        next.dataset["action"] = isLast ? "result-map" : "next-level";
    }
    renderDefeat(session) {
        $("lose-title").textContent = session.def.name;
        $("lose-reason").textContent =
            session.lostReason === "time"
                ? "Le temps est écoulé avant que tu atteignes la sortie."
                : "Les gardiens spectraux t'ont rattrapé.";
        $("lose-stats").innerHTML = `
      <div><b>${formatTime(session.elapsed)}</b>Temps</div>
      <div><b>${session.gold} / ${session.def.coinsRequired}</b>Pièces requises</div>
      <div><b>${session.hearts} / ${session.maxHearts}</b>Cœurs</div>`;
    }
    // ----- HUD -----
    resetHud(session, showCompass) {
        this.hud = { name: "", timer: "", timerWarn: false, gold: "", exitOpen: null, hearts: -1, fps: "" };
        $("hud-zone").textContent = `${ZONES[session.def.zone].name} · ${session.index + 1}/${LEVELS.length}`;
        $("hud-compass").classList.toggle("hidden", !showCompass);
        this.hint(`Ramasse ${session.def.coinsRequired} pièces d'or pour ouvrir la sortie`, 6);
    }
    hint(text, seconds) {
        const el = $("hud-hint");
        el.textContent = text;
        el.style.opacity = "1";
        window.clearTimeout(this.hintTimer);
        this.hintTimer = window.setTimeout(() => (el.style.opacity = "0"), seconds * 1000);
    }
    updateHud(session, fps, compassAngle) {
        const h = this.hud;
        if (h.name !== session.def.name) {
            h.name = session.def.name;
            $("hud-name").textContent = session.def.name;
        }
        const timer = formatTime(session.timeLeft);
        if (h.timer !== timer) {
            h.timer = timer;
            $("hud-timer").textContent = timer;
        }
        const warn = session.timeLeft <= 20;
        if (h.timerWarn !== warn) {
            h.timerWarn = warn;
            $("hud-timer").classList.toggle("warn", warn);
        }
        const gold = `${session.gold} / ${session.def.coinsRequired}${session.totalGold > session.def.coinsRequired ? ` (${session.totalGold})` : ""}`;
        if (h.gold !== gold) {
            const bump = h.gold !== "";
            h.gold = gold;
            $("hud-gold").textContent = gold;
            if (bump)
                this.bump($("hud-gold").parentElement);
        }
        if (h.exitOpen !== session.exitOpen) {
            h.exitOpen = session.exitOpen;
            const el = $("hud-exit");
            el.textContent = session.exitOpen ? "Sortie ouverte" : "Sortie verrouillée";
            el.className = `chip ${session.exitOpen ? "exit-open" : "exit-locked"}`;
        }
        if (h.hearts !== session.hearts) {
            const lost = h.hearts > session.hearts;
            h.hearts = session.hearts;
            let html = "";
            for (let i = 0; i < session.maxHearts; ++i) {
                const cls = i < session.hearts ? "" : i === session.hearts && lost ? "empty lost" : "empty";
                html += HEART_SVG.replace("<svg", `<svg class="${cls}"`);
            }
            $("hud-hearts").innerHTML = html;
        }
        const fpsText = fps === null ? "" : `${Math.round(fps)} FPS`;
        if (h.fps !== fpsText) {
            h.fps = fpsText;
            const el = $("hud-fps");
            el.textContent = fpsText;
            el.classList.toggle("hidden", fps === null);
        }
        if (compassAngle !== null) {
            $("hud-compass").firstElementChild.style.transform = `rotate(${compassAngle}rad)`;
        }
    }
    bump(el) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
    }
    flash() {
        const el = $("flash");
        el.classList.add("on");
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("on")));
    }
    toast(text, kind = "", life = 2.2) {
        const zone = $("toasts");
        const el = document.createElement("div");
        el.className = `toast ${kind}`;
        el.style.setProperty("--life", `${life}s`);
        el.textContent = text;
        zone.appendChild(el);
        while (zone.children.length > 3)
            zone.firstElementChild.remove();
        window.setTimeout(() => el.remove(), (life + 0.5) * 1000);
    }
    confirm(title, text, okLabel = "Confirmer") {
        const modal = $("modal");
        $("modal-title").textContent = title;
        $("modal-text").textContent = text;
        $("modal-ok").textContent = okLabel;
        modal.classList.remove("hidden");
        $("modal-cancel").focus();
        return new Promise((resolve) => {
            const done = (value) => {
                modal.classList.add("hidden");
                $("modal-ok").onclick = null;
                $("modal-cancel").onclick = null;
                resolve(value);
            };
            $("modal-ok").onclick = () => done(true);
            $("modal-cancel").onclick = () => done(false);
        });
    }
}
//# sourceMappingURL=ui.js.map