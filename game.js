(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const gameEl = $("game");
  const canvas = $("stage");
  const ctx = canvas.getContext("2d", { alpha: false });

  const startScreen = $("startScreen");
  const pauseScreen = $("pauseScreen");
  const overScreen = $("overScreen");
  const hud = $("hud");
  const scoreEl = $("score");
  const waveEl = $("wave");
  const comboEl = $("combo");
  const comboMultEl = $("comboMult");
  const comboFillEl = $("comboFill");
  const livesEl = $("lives");
  const bestStartEl = $("bestStart");
  const bestOverEl = $("bestOver");
  const finalScoreEl = $("finalScore");
  const newRecordEl = $("newRecord");
  const toastEl = $("toast");
  const toastTitleEl = $("toastTitle");
  const toastTextEl = $("toastText");
  const soundBtn = $("soundBtn");
  const soundIcon = $("soundIcon");
  const profileScreen = $("profileScreen");
  const profileBtn = $("profileBtn");
  const profileClose = $("profileClose");
  const profileBack = $("profileBack");
  const achList = $("achList");
  const achCount = $("achCount");
  const achPillCount = $("achPillCount");
  const achToast = $("achToast");
  const achToastTitle = $("achToastTitle");
  const achToastDesc = $("achToastDesc");
  const buffStar = $("buffStar");
  const buffBrush = $("buffBrush");
  const buffStarTime = $("buffStarTime");
  const buffBrushTime = $("buffBrushTime");

  const TAU = Math.PI * 2;
  const STORE_BEST = "dushelovka.best.v1";
  const STORE_SOUND = "dushelovka.sound.v1";
  const STORE_ACHIEVEMENTS = "dushelovka.achievements.v1";
  const WAVE_LENGTH = 24;
  const MAX_LIVES = 3;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ACHIEVEMENTS = [
    {
      id: "first_soul",
      title: "Первый лисёнок",
      desc: "Поймать первую душу.",
      icon: "#i-soul",
    },
    {
      id: "combo3",
      title: "Лисий хвост",
      desc: "Дойти до множителя ×3.",
      icon: "#i-star",
    },
    {
      id: "combo5",
      title: "Тайлорн",
      desc: "Дойти до множителя ×5.",
      icon: "#i-fox",
    },
    {
      id: "score500",
      title: "Виджитаун",
      desc: "Набрать 500 очков за забег.",
      icon: "#i-trophy",
    },
    {
      id: "score1500",
      title: "Душеловка",
      desc: "Набрать 1500 очков за забег.",
      icon: "#i-trophy",
    },
    {
      id: "survive60",
      title: "Между стримами",
      desc: "Продержаться 60 секунд.",
      icon: "#i-star",
    },
    {
      id: "flawless45",
      title: "Ни царапины",
      desc: "45 секунд без потери сердец.",
      icon: "#i-heart",
    },
    {
      id: "star",
      title: "Звёздный топ",
      desc: "Поймать звезду.",
      icon: "#i-star",
    },
    {
      id: "brush",
      title: "Вдохновение",
      desc: "Поймать кисть.",
      icon: "#i-brush",
    },
    {
      id: "dodger",
      title: "Хитрый лис",
      desc: "Уклониться от 12 ловушек за забег.",
      icon: "#i-bomb",
    },
    {
      id: "heartsave",
      title: "Второй шанс",
      desc: "Вылечиться на последнем сердце.",
      icon: "#i-heart",
    },
    {
      id: "collector",
      title: "Коллекционер",
      desc: "Поймать 50 душ за забег.",
      icon: "#i-soul",
    },
  ];
  const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (values) => values[(Math.random() * values.length) | 0];

  function readStore(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      /* Storage can be disabled — the game still works. */
    }
  }

  function loadAchievements() {
    try {
      const parsed = JSON.parse(readStore(STORE_ACHIEVEMENTS, "[]"));
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((id) => ACHIEVEMENT_MAP.has(id)));
    } catch {
      return new Set();
    }
  }

  class Sfx {
    constructor(enabled) {
      this.enabled = enabled;
      this.ctx = null;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        this.ctx = new AudioCtor();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    tone(startFreq, endFreq, duration, type = "sine", volume = 0.05, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const audio = this.ctx;
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const start = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, startFreq), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }

    noise(duration = 0.2, volume = 0.08) {
      if (!this.enabled || !this.ctx) return;
      const audio = this.ctx;
      const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, audio.currentTime);
      filter.frequency.exponentialRampToValueAtTime(180, audio.currentTime + duration);
      const gain = audio.createGain();
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start();
    }

    click() {
      this.tone(620, 760, 0.045, "triangle", 0.025);
    }

    start() {
      this.tone(210, 420, 0.22, "triangle", 0.045);
      this.tone(420, 840, 0.3, "sine", 0.03, 0.05);
    }

    pickup(combo) {
      const base = 680 + Math.min(combo, 24) * 13;
      this.tone(base, base * 1.35, 0.09, "triangle", 0.042);
      this.tone(base * 1.5, base * 1.75, 0.1, "sine", 0.028, 0.045);
    }

    heal() {
      this.tone(523, 523, 0.12, "sine", 0.04);
      this.tone(659, 659, 0.12, "sine", 0.04, 0.08);
      this.tone(784, 940, 0.22, "sine", 0.035, 0.16);
    }

    hurt() {
      this.tone(160, 52, 0.35, "sawtooth", 0.055);
      this.noise(0.23, 0.09);
    }

    bomb() {
      this.tone(105, 34, 0.38, "sawtooth", 0.05);
      this.noise(0.3, 0.11);
    }

    bone() {
      this.tone(420, 150, 0.11, "square", 0.025);
      this.tone(260, 120, 0.12, "square", 0.02, 0.05);
    }

    star() {
      this.tone(660, 660, 0.1, "sine", 0.04);
      this.tone(880, 880, 0.1, "sine", 0.04, 0.07);
      this.tone(1320, 1500, 0.2, "sine", 0.03, 0.14);
    }

    brush() {
      this.tone(330, 440, 0.14, "triangle", 0.03);
      this.tone(440, 660, 0.18, "triangle", 0.03, 0.1);
      this.noise(0.1, 0.025);
    }

    achievement() {
      this.tone(523, 523, 0.11, "sine", 0.032);
      this.tone(659, 659, 0.11, "sine", 0.032, 0.08);
      this.tone(784, 784, 0.11, "sine", 0.032, 0.16);
      this.tone(1046, 1180, 0.25, "sine", 0.028, 0.24);
    }

    wave() {
      this.tone(170, 255, 0.28, "square", 0.022);
      this.tone(255, 340, 0.24, "triangle", 0.022, 0.08);
    }

    gameOver() {
      this.tone(260, 105, 0.72, "sawtooth", 0.045);
      this.tone(130, 48, 0.95, "triangle", 0.04, 0.1);
    }
  }

  const soundEnabled = readStore(STORE_SOUND, "1") !== "0";
  const sfx = new Sfx(soundEnabled);
  let soundOn = soundEnabled;

  const view = {
    width: 0,
    height: 0,
    dpr: 1,
    baseY: 0,
    heroW: 0,
    heroH: 0,
  };

  const player = {
    x: 0,
    targetX: 0,
    vx: 0,
    tilt: 0,
  };

  const state = {
    score: 0,
    shownScore: 0,
    lives: MAX_LIVES,
    livesLost: 0,
    combo: 0,
    lastMult: 1,
    wave: 1,
    elapsed: 0,
    waveTime: 0,
    spawnTimer: 0.6,
    heartTimer: 13,
    bonusTimer: 10,
    soulsCaught: 0,
    trapsDodged: 0,
    starTime: 0,
    brushTime: 0,
    invuln: 0,
    shake: 0,
    flash: 0,
    trapFlash: 0,
  };

  let mode = "menu";
  let items = [];
  let particles = [];
  let rings = [];
  let floats = [];
  let embers = [];
  let bgGrad = null;
  let heroReady = false;
  let pointerDown = false;
  let overTimeout = null;
  let toastTimeout = null;
  let lastPaintedScore = -1;
  let profileReturnFocus = null;
  let achQueue = [];
  let achToastTimer = null;
  let achToastBusy = false;
  let best = Math.max(0, Math.floor(Number(readStore(STORE_BEST, "0")) || 0));
  const unlockedAchievements = loadAchievements();

  const keys = { left: false, right: false };
  const heartEls = [];

  const heroImg = new Image();
  heroImg.decoding = "async";
  heroImg.addEventListener("load", () => {
    heroReady = true;
  });
  heroImg.addEventListener("error", () => {
    heroReady = false;
  });
  heroImg.src = "assets/hero.png";
  if (heroImg.complete && heroImg.naturalWidth > 0) {
    heroReady = true;
  }

  function createSprite(rows, palette, scale = 3) {
    const width = rows[0].length;
    const height = rows.length;
    const sprite = document.createElement("canvas");
    sprite.width = width * scale;
    sprite.height = height * scale;
    const g = sprite.getContext("2d");
    g.imageSmoothingEnabled = false;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const color = palette[row[x]];
        if (!color) continue;
        g.fillStyle = color;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    });
    return sprite;
  }

  const sprites = {
    soul: createSprite(
      [
        "....#....",
        "...###...",
        "..#OOO#..",
        ".#OOlOO#.",
        ".#OlWlO#.",
        "#OOlWlOO#",
        "#OOOOOOO#",
        ".#OOOOO#.",
        "..#OOO#..",
        "...###...",
        "....#....",
      ],
      {
        "#": "#05222b",
        O: "#12b9d8",
        l: "#7df7ff",
        W: "#efffff",
      },
    ),
    skull: createSprite(
      [
        "..#####..",
        ".#WWWWW#.",
        "#WWWWWWW#",
        "#WrWWWrW#",
        "#WrWWWrW#",
        "#WWWWWWW#",
        ".#W#W#W#.",
        "..#WWW#..",
        "...###...",
      ],
      {
        "#": "#1b060d",
        W: "#ffe3d4",
        r: "#ff2948",
      },
    ),
    heart: createSprite(
      [
        ".##..##.",
        "#rr##rr#",
        "#rlrrrr#",
        "#rrrrrr#",
        ".#rrrr#.",
        "..#rr#..",
        "...##...",
      ],
      {
        "#": "#3a0715",
        r: "#ff4a68",
        l: "#ffdce2",
      },
    ),
    bomb: createSprite(
      [
        "....#....",
        "...#f#...",
        "..#s#....",
        ".#OOOOO#.",
        "#OOllOOO#",
        "#OOllOOO#",
        "#OOOOOOO#",
        ".#OOOOO#.",
        "..#####..",
      ],
      {
        "#": "#17060b",
        O: "#2a1822",
        l: "#583040",
        f: "#ff7a4d",
        s: "#ffd166",
      },
    ),
    bone: createSprite(
      [
        "##.......##",
        "#W#.....#W#",
        ".#WWWWWWW#.",
        "..#WWWWW#..",
        ".#WWWWWWW#.",
        "#W#.....#W#",
        "##.......##",
      ],
      {
        "#": "#2a0c14",
        W: "#ffe3d4",
      },
    ),
    star: createSprite(
      [
        "....#....",
        "...#O#...",
        "...#O#...",
        ".##OOO##.",
        "#OOOlOOO#",
        ".##OOO##.",
        "...#O#...",
        "...#O#...",
        "....#....",
      ],
      {
        "#": "#3a2105",
        O: "#ffc94f",
        l: "#fff3c4",
      },
    ),
    brush: createSprite(
      [
        "...###..",
        "..#OOO#.",
        "..#OOO#.",
        "..#OOO#.",
        "...#b#..",
        "...#b#..",
        "...#b#..",
        "...#b#..",
        "...#b#..",
        "..##b##.",
        "..#WWW#.",
        "...###..",
      ],
      {
        "#": "#1b060d",
        O: "#d92a3c",
        b: "#d39a6a",
        W: "#67f4ff",
      },
    ),
  };

  function buildLives() {
    livesEl.innerHTML = "";
    heartEls.length = 0;
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 20 18");
      svg.setAttribute("aria-hidden", "true");
      svg.classList.add("heart");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-heart");
      svg.appendChild(use);
      livesEl.appendChild(svg);
      heartEls.push(svg);
    }
    paintLives();
  }

  function paintLives(hitIndex = -1) {
    heartEls.forEach((heart, index) => {
      heart.classList.toggle("is-lost", index >= state.lives);
    });
    if (hitIndex >= 0 && heartEls[hitIndex]) {
      const heart = heartEls[hitIndex];
      heart.classList.remove("is-hit");
      void heart.getBoundingClientRect();
      heart.classList.add("is-hit");
      window.setTimeout(() => heart.classList.remove("is-hit"), 480);
    }
    livesEl.setAttribute("aria-label", `Жизни: ${state.lives} из ${MAX_LIVES}`);
  }

  function formatScore(value, pad = false) {
    const number = Math.max(0, Math.round(value));
    if (pad && number < 10000) return String(number).padStart(4, "0");
    return number.toLocaleString("ru-RU");
  }

  function updateBestLabels() {
    bestStartEl.textContent = formatScore(best);
    bestOverEl.textContent = formatScore(best);
  }

  function updateAchCounters() {
    const short = `${unlockedAchievements.size}/${ACHIEVEMENTS.length}`;
    achPillCount.textContent = short;
    achCount.textContent = `${unlockedAchievements.size} / ${ACHIEVEMENTS.length}`;
  }

  function renderAchievements() {
    const fragment = document.createDocumentFragment();
    ACHIEVEMENTS.forEach((achievement) => {
      const unlocked = unlockedAchievements.has(achievement.id);
      const item = document.createElement("li");
      item.className = `ach-item ${unlocked ? "is-unlocked" : "is-locked"}`;

      const icon = document.createElement("span");
      icon.className = "ach-icon";
      icon.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><use href="${achievement.icon}"></use></svg>`;

      const copy = document.createElement("span");
      copy.className = "ach-copy";
      const title = document.createElement("b");
      title.textContent = achievement.title;
      const desc = document.createElement("span");
      desc.textContent = achievement.desc;
      copy.append(title, desc);
      item.append(icon, copy);
      fragment.append(item);
    });
    achList.replaceChildren(fragment);
  }

  function showNextAchievementToast() {
    if (achQueue.length === 0) {
      achToastBusy = false;
      return;
    }
    achToastBusy = true;
    const achievement = achQueue.shift();
    achToastTitle.textContent = achievement.title;
    achToastDesc.textContent = achievement.desc;
    achToast.classList.add("is-visible");
    sfx.achievement();
    window.clearTimeout(achToastTimer);
    achToastTimer = window.setTimeout(() => {
      achToast.classList.remove("is-visible");
      achToastTimer = window.setTimeout(showNextAchievementToast, 260);
    }, 2600);
  }

  function queueAchievementToast(achievement) {
    achQueue.push(achievement);
    if (!achToastBusy) showNextAchievementToast();
  }

  function hideAchievementToast() {
    achQueue = [];
    achToastBusy = false;
    window.clearTimeout(achToastTimer);
    achToast.classList.remove("is-visible");
  }

  function unlockAchievement(id) {
    const achievement = ACHIEVEMENT_MAP.get(id);
    if (!achievement || unlockedAchievements.has(id)) return;
    unlockedAchievements.add(id);
    writeStore(STORE_ACHIEVEMENTS, JSON.stringify([...unlockedAchievements]));
    updateAchCounters();
    if (!profileScreen.hidden) renderAchievements();
    queueAchievementToast(achievement);
  }

  function checkScoreAchievements() {
    if (state.score >= 500) unlockAchievement("score500");
    if (state.score >= 1500) unlockAchievement("score1500");
  }

  function openProfile() {
    if (mode === "playing" || mode === "paused") return;
    hideAchievementToast();
    profileReturnFocus = document.activeElement;
    renderAchievements();
    profileScreen.hidden = false;
    profileBtn.setAttribute("aria-expanded", "true");
    profileClose.focus({ preventScroll: true });
  }

  function closeProfile() {
    if (profileScreen.hidden) return;
    profileScreen.hidden = true;
    profileBtn.setAttribute("aria-expanded", "false");
    if (profileReturnFocus instanceof HTMLElement) {
      profileReturnFocus.focus({ preventScroll: true });
    }
  }

  function multiplier() {
    return Math.min(5, 1 + Math.floor(state.combo / 5));
  }

  function paintCombo() {
    const mult = multiplier();
    comboMultEl.textContent = `×${mult}`;
    comboEl.classList.toggle("is-on", mult > 1);
    const progress = (state.combo % 5) / 5;
    comboFillEl.style.transform = `scaleX(${mult >= 5 ? 1 : progress})`;
    state.lastMult = mult;
  }

  function paintScore(force = false) {
    const value = formatScore(state.shownScore, true);
    if (!force && value === lastPaintedScore) return;
    scoreEl.textContent = value;
    lastPaintedScore = value;
  }

  function setSoundUi() {
    soundOn = sfx.enabled;
    soundBtn.classList.toggle("is-muted", !soundOn);
    soundBtn.setAttribute("aria-label", soundOn ? "Выключить звук" : "Включить звук");
    soundBtn.title = soundOn ? "Выключить звук" : "Включить звук";
    soundIcon.setAttribute("href", soundOn ? "#i-sound" : "#i-muted");
  }

  function showToast(title, text = "") {
    toastTitleEl.textContent = title;
    toastTextEl.textContent = text;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, 1850);
  }

  function showScreen(target) {
    startScreen.hidden = target !== startScreen;
    pauseScreen.hidden = target !== pauseScreen;
    overScreen.hidden = target !== overScreen;
  }

  function resize() {
    const rect = gameEl.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width);
    const nextHeight = Math.max(1, rect.height);
    const relativeX = view.width > 0 ? player.x / view.width : 0.5;

    view.width = nextWidth;
    view.height = nextHeight;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.heroH = Math.max(
      78,
      Math.min(
        view.height * (view.height < 640 ? 0.215 : 0.26),
        view.width * 0.46,
        190,
        view.height * 0.36,
      ),
    );
    view.heroW = view.heroH * (84 / 128);
    view.baseY = view.height - Math.max(16, view.height * 0.034);

    canvas.width = Math.round(view.width * view.dpr);
    canvas.height = Math.round(view.height * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    player.x = clamp(relativeX * view.width, view.heroW * 0.5, view.width - view.heroW * 0.5);
    player.targetX = clamp(player.targetX || player.x, view.heroW * 0.5, view.width - view.heroW * 0.5);

    bgGrad = ctx.createLinearGradient(0, 0, 0, view.height);
    bgGrad.addColorStop(0, "#0d0410");
    bgGrad.addColorStop(0.46, "#18050f");
    bgGrad.addColorStop(1, "#28070f");

    buildEmbers();
  }

  function buildEmbers() {
    const count = clamp(Math.round((view.width * view.height) / 17500), 24, 62);
    embers = Array.from({ length: count }, () => ({
      x: rand(0, view.width),
      y: rand(0, view.height),
      size: rand(0.7, 2.2),
      speed: rand(6, 25),
      drift: rand(1.5, 7),
      phase: rand(0, TAU),
      alpha: rand(0.12, 0.48),
      cyan: Math.random() < 0.09,
    }));
  }

  function startGame() {
    window.clearTimeout(overTimeout);
    overTimeout = null;
    closeProfile();
    sfx.unlock();
    sfx.start();

    mode = "playing";
    state.score = 0;
    state.shownScore = 0;
    state.lives = MAX_LIVES;
    state.livesLost = 0;
    state.combo = 0;
    state.lastMult = 1;
    state.wave = 1;
    state.elapsed = 0;
    state.waveTime = 0;
    state.spawnTimer = 0.54;
    state.heartTimer = 13;
    state.bonusTimer = 10;
    state.soulsCaught = 0;
    state.trapsDodged = 0;
    state.starTime = 0;
    state.brushTime = 0;
    state.invuln = 0.9;
    state.shake = 0;
    state.flash = 0;
    state.trapFlash = 0;
    items = [];
    particles = [];
    rings = [];
    floats = [];
    hideAchievementToast();
    keys.left = false;
    keys.right = false;
    pointerDown = false;

    player.x = view.width / 2;
    player.targetX = view.width / 2;
    player.vx = 0;
    player.tilt = 0;

    paintScore(true);
    paintCombo();
    paintLives();
    paintBuffs();
    waveEl.textContent = "1";
    updateBestLabels();
    updateAchCounters();

    gameEl.classList.remove("is-menu", "is-over", "is-paused");
    gameEl.classList.add("is-playing");
    hud.setAttribute("aria-hidden", "false");
    showScreen(null);
    gameEl.focus({ preventScroll: true });
    showToast("ЛОВИ ДУШИ", "Виджи вышла на охоту");
  }

  function endGame() {
    if (mode !== "playing") return;
    mode = "over";
    hideAchievementToast();
    const previousBest = best;
    if (state.score > best) {
      best = state.score;
      writeStore(STORE_BEST, best);
    }
    const isRecord = state.score > 0 && state.score > previousBest;

    finalScoreEl.textContent = formatScore(state.score);
    bestOverEl.textContent = formatScore(best);
    newRecordEl.hidden = !isRecord;
    updateBestLabels();

    gameEl.classList.remove("is-playing", "is-menu");
    gameEl.classList.add("is-over");
    hud.setAttribute("aria-hidden", "true");
    sfx.gameOver();

    window.clearTimeout(overTimeout);
    overTimeout = window.setTimeout(() => {
      if (mode !== "over") return;
      showScreen(overScreen);
      overScreen.focus({ preventScroll: true });
    }, 620);
  }

  function pauseGame() {
    if (mode !== "playing") return;
    mode = "paused";
    hideAchievementToast();
    pointerDown = false;
    keys.left = false;
    keys.right = false;
    gameEl.classList.add("is-paused");
    showScreen(pauseScreen);
    pauseScreen.focus({ preventScroll: true });
    sfx.click();
  }

  function resumeGame() {
    if (mode !== "paused") return;
    mode = "playing";
    gameEl.classList.remove("is-paused");
    showScreen(null);
    gameEl.focus({ preventScroll: true });
    sfx.click();
  }

  function goMenu() {
    window.clearTimeout(overTimeout);
    overTimeout = null;
    closeProfile();
    hideAchievementToast();
    mode = "menu";
    state.score = 0;
    state.shownScore = 0;
    state.lives = MAX_LIVES;
    state.livesLost = 0;
    state.combo = 0;
    state.wave = 1;
    state.invuln = 0;
    state.starTime = 0;
    state.brushTime = 0;
    state.trapsDodged = 0;
    state.soulsCaught = 0;
    items = [];
    particles = [];
    rings = [];
    floats = [];
    keys.left = false;
    keys.right = false;
    pointerDown = false;
    player.x = view.width / 2;
    player.targetX = view.width / 2;
    player.vx = 0;
    player.tilt = 0;
    paintScore(true);
    paintCombo();
    paintLives();
    paintBuffs();
    updateBestLabels();
    updateAchCounters();
    gameEl.classList.remove("is-playing", "is-paused", "is-over");
    gameEl.classList.add("is-menu");
    hud.setAttribute("aria-hidden", "true");
    showScreen(startScreen);
    gameEl.focus({ preventScroll: true });
    sfx.click();
  }

  function nextWave() {
    state.wave += 1;
    state.waveTime = 0;
    waveEl.textContent = String(state.wave);
    sfx.wave();
    const notes = ["души не спят", "жарче", "держитесь", "пекло", "бездна"];
    showToast(`ВОЛНА ${state.wave}`, notes[Math.min(notes.length - 1, state.wave - 2)]);
  }

  function waveSpawnInterval() {
    return Math.max(0.36, 0.84 - (state.wave - 1) * 0.06);
  }

  function pickFallingType() {
    const roll = Math.random();
    const skullChance = Math.min(0.3, 0.16 + (state.wave - 1) * 0.025);
    if (roll < skullChance) return "skull";
    if (roll < skullChance + 0.11) return "bomb";
    if (roll < skullChance + 0.18) return "bone";
    return "soul";
  }

  function spawnItem(forceType) {
    if (mode !== "playing" || view.width < 80) return;
    const type = forceType || pickFallingType();
    const margin = Math.max(24, view.width * 0.055);
    const baseX = rand(margin, view.width - margin);
    const speedBase = (138 + state.wave * 15 + state.elapsed * 0.45) * (view.height / 800);
    let vy = speedBase * rand(0.88, 1.14);
    if (type === "heart") vy *= 0.64;
    if (type === "star" || type === "brush") vy *= 0.88;
    if (type === "skull") vy *= 1.04;
    if (type === "bone") vy *= 1.06;

    const scaleByType = {
      soul: rand(0.92, 1.12),
      heart: 1.08,
      star: 1.05,
      brush: 1,
      bomb: 1,
      bone: 1,
      skull: 1,
    };

    items.push({
      type,
      baseX,
      x: baseX,
      y: -42,
      vy,
      sway: type === "skull" || type === "bomb" || type === "bone" ? rand(1, 6) : rand(5, 17),
      phase: rand(0, TAU),
      t: 0,
      spin: rand(-0.55, 0.55),
      scale: scaleByType[type] || 1,
    });
  }

  function burst(x, y, colors, count, power = 1) {
    for (let i = 0; i < count; i += 1) {
      if (particles.length > 260) particles.shift();
      const angle = rand(0, TAU);
      const speed = rand(35, 170) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(10, 50),
        gravity: rand(90, 240),
        life: rand(0.32, 0.78),
        max: 0.78,
        size: rand(1.3, 3.4),
        color: pick(colors),
      });
    }
  }

  function addRing(x, y, color, maxRadius = 42) {
    rings.push({
      x,
      y,
      radius: 5,
      maxRadius,
      life: 0.5,
      maxLife: 0.5,
      color,
    });
  }

  function addFloat(x, y, text, color, size = 13) {
    floats.push({
      x,
      y,
      text,
      color,
      size,
      life: 1,
      maxLife: 1,
    });
  }

  function paintBuffs() {
    const hasStar = state.starTime > 0.05;
    const hasBrush = state.brushTime > 0.05;
    buffStar.hidden = !hasStar;
    buffBrush.hidden = !hasBrush;
    if (hasStar) buffStarTime.textContent = state.starTime.toFixed(1);
    if (hasBrush) buffBrushTime.textContent = state.brushTime.toFixed(1);
  }

  function collectItem(item) {
    if (item.type === "soul") {
      const previousMult = state.lastMult;
      state.combo += 1;
      state.soulsCaught += 1;
      const mult = multiplier();
      const starBoost = state.starTime > 0 ? 2 : 1;
      const gain = 10 * mult * starBoost;
      state.score += gain;
      paintCombo();
      paintScore();
      burst(item.x, item.y, ["#baffff", "#36e2ff", "#0f9fc1", "#ffffff"], 11, 1);
      addRing(item.x, item.y, "rgba(103,244,255,.7)", 36);
      addFloat(item.x, item.y - 12, `+${gain}`, starBoost > 1 ? "#ffe4a8" : "#a9fbff", 13);
      if (mult > previousMult) {
        addFloat(player.x, view.baseY - view.heroH - 16, `×${mult}`, "#67f4ff", 21);
        addRing(player.x, view.baseY - view.heroH * 0.52, "rgba(103,244,255,.45)", 60);
      }
      unlockAchievement("first_soul");
      if (mult >= 3) unlockAchievement("combo3");
      if (mult >= 5) unlockAchievement("combo5");
      if (state.soulsCaught >= 50) unlockAchievement("collector");
      checkScoreAchievements();
      sfx.pickup(state.combo);
      return;
    }

    if (item.type === "heart") {
      if (state.lives < MAX_LIVES) {
        if (state.lives === 1) unlockAchievement("heartsave");
        state.lives += 1;
        paintLives();
        addFloat(item.x, item.y - 12, "+1 ЖИЗНЬ", "#ffd9df", 12);
        showToast("СЕРДЦЕ", "+1 жизнь");
      } else {
        state.score += 150;
        addFloat(item.x, item.y - 12, "+150", "#ffd9df", 13);
      }
      paintScore();
      checkScoreAchievements();
      burst(item.x, item.y, ["#ffd9df", "#ff6f88", "#ffe9a8", "#ffffff"], 16, 1.15);
      addRing(item.x, item.y, "rgba(255,215,225,.75)", 52);
      sfx.heal();
      return;
    }

    if (item.type === "star") {
      state.starTime = Math.max(state.starTime, 8);
      state.score += 25;
      paintScore();
      paintBuffs();
      checkScoreAchievements();
      unlockAchievement("star");
      burst(item.x, item.y, ["#fff3c4", "#ffd166", "#ff9b5e", "#ffffff"], 18, 1.2);
      addRing(item.x, item.y, "rgba(255,209,102,.8)", 55);
      addFloat(item.x, item.y - 12, "+25 · ×2", "#ffe4a8", 13);
      showToast("ЗВЕЗДА", "души ×2 на 8 секунд");
      sfx.star();
      return;
    }

    if (item.type === "brush") {
      state.brushTime = Math.max(state.brushTime, 8);
      paintBuffs();
      unlockAchievement("brush");
      burst(item.x, item.y, ["#a9fbff", "#67f4ff", "#ff6f88", "#ffffff"], 18, 1.2);
      addRing(item.x, item.y, "rgba(103,244,255,.8)", 55);
      addFloat(item.x, item.y - 12, "МАГНИТ", "#a9fbff", 12);
      showToast("ВДОХНОВЕНИЕ", "магнит на 8 секунд");
      sfx.brush();
      return;
    }
  }

  function hitTrap(item) {
    const isBomb = item.type === "bomb";
    const penalty = isBomb ? 75 : 25;
    state.score = Math.max(0, state.score - penalty);
    if (isBomb) {
      state.combo = 0;
      paintCombo();
    }
    paintScore();
    state.shake = reducedMotion ? 2 : isBomb ? 11 : 5;
    state.trapFlash = isBomb ? 0.7 : 0.35;
    addFloat(item.x, item.y - 12, `−${penalty}`, isBomb ? "#ff9b5e" : "#ffd0a6", isBomb ? 17 : 14);
    if (isBomb) {
      burst(item.x, item.y, ["#ff7a4d", "#ffd166", "#2a1822", "#17060b"], 24, 1.35);
      addRing(item.x, item.y, "rgba(255,122,77,.75)", 70);
      sfx.bomb();
    } else {
      burst(item.x, item.y, ["#ffe3d4", "#c08f86", "#2a0c14"], 12, 0.85);
      addRing(item.x, item.y, "rgba(255,208,166,.55)", 46);
      sfx.bone();
    }
  }

  function hurt(item) {
    state.lives = Math.max(0, state.lives - 1);
    state.livesLost += 1;
    state.combo = 0;
    paintCombo();
    state.invuln = 1.45;
    state.shake = reducedMotion ? 3 : 14;
    state.flash = reducedMotion ? 0.2 : 0.7;
    burst(item.x, item.y, ["#ff2948", "#ff754d", "#ffd1b8", "#651021"], 22, 1.3);
    addRing(item.x, item.y, "rgba(255,65,90,.72)", 66);
    paintLives(state.lives);
    sfx.hurt();

    if (state.lives <= 0) {
      endGame();
    } else {
      showToast("ОЙ!", "минус одно сердце");
    }
  }

  function catches(item, rx, ry) {
    const centerY = view.baseY - view.heroH * 0.48;
    const dx = (item.x - player.x) / (view.heroW * rx);
    const dy = (item.y - centerY) / (view.heroH * ry);
    return dx * dx + dy * dy < 1;
  }

  function updatePlayer(dt) {
    const half = view.heroW * 0.5;
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (direction !== 0) {
      player.targetX += direction * 760 * dt;
    }
    player.targetX = clamp(player.targetX, half, view.width - half);
    const previous = player.x;
    player.x += (player.targetX - player.x) * Math.min(1, dt * 15);
    player.vx = (player.x - previous) / Math.max(dt, 0.0001);
    const targetTilt = clamp(player.vx * 0.00014, -0.075, 0.075);
    player.tilt += (targetTilt - player.tilt) * Math.min(1, dt * 9);
  }

  function updateItems(dt, t) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      item.t += dt;
      item.y += item.vy * dt;
      item.x = item.baseX + Math.sin(item.phase + item.t * (item.type === "skull" ? 1.5 : 2.15)) * item.sway;
      if (item.type === "skull") item.x += Math.sin(t * 2.1 + item.phase) * 1.5;

      if (item.type !== "skull" && item.type !== "bomb" && item.type !== "bone") {
        const dx = player.x - item.x;
        const magnetRange = view.heroW * (state.brushTime > 0 ? 1.7 : 0.78);
        const magnetPull = state.brushTime > 0 ? 5.2 : 2.4;
        const catchZoneTop = view.baseY - view.heroH * 1.45;
        if (item.y > catchZoneTop && item.y < view.baseY - view.heroH * 0.1 && Math.abs(dx) < magnetRange) {
          item.x += dx * Math.min(1, dt * magnetPull);
        }
      }

      if (item.type === "skull") {
        if (state.invuln <= 0 && catches(item, 0.4, 0.47)) {
          hurt(item);
          items.splice(index, 1);
          if (mode !== "playing") break;
          continue;
        }
      } else if (item.type === "bomb" || item.type === "bone") {
        if (catches(item, 0.46, 0.5)) {
          hitTrap(item);
          items.splice(index, 1);
          continue;
        }
      } else if (catches(item, state.brushTime > 0 ? 0.59 : 0.52, 0.54)) {
        collectItem(item);
        items.splice(index, 1);
        continue;
      }

      if (item.y > view.height + 48) {
        if (item.type === "skull") {
          burst(item.x, view.baseY + 4, ["#ff2948", "#8c0c23"], 6, 0.55);
        } else if (item.type === "bomb" || item.type === "bone") {
          state.trapsDodged += 1;
          if (state.trapsDodged >= 12) unlockAchievement("dodger");
        }
        items.splice(index, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.vx *= 1 - Math.min(0.9, dt * 1.7);
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    for (let index = rings.length - 1; index >= 0; index -= 1) {
      const ring = rings[index];
      ring.life -= dt;
      if (ring.life <= 0) {
        rings.splice(index, 1);
        continue;
      }
      ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, dt * 12);
    }

    for (let index = floats.length - 1; index >= 0; index -= 1) {
      const float = floats[index];
      float.life -= dt;
      if (float.life <= 0) {
        floats.splice(index, 1);
        continue;
      }
      float.y -= 32 * dt;
    }
  }

  function updateEmbers(dt, t) {
    embers.forEach((ember) => {
      ember.y -= ember.speed * dt;
      ember.x += Math.sin(t * 0.7 + ember.phase) * ember.drift * dt;
      if (ember.y < -12) {
        ember.y = view.height + rand(4, 40);
        ember.x = rand(0, view.width);
      }
    });
  }

  function update(dt, t) {
    updateEmbers(dt, t);
    updateParticles(dt);

    state.shake = Math.max(0, state.shake - dt * 48);
    state.flash = Math.max(0, state.flash - dt * 2.4);
    state.trapFlash = Math.max(0, state.trapFlash - dt * 2.6);

    if (mode === "playing") {
      state.invuln = Math.max(0, state.invuln - dt);
      state.starTime = Math.max(0, state.starTime - dt);
      state.brushTime = Math.max(0, state.brushTime - dt);
      paintBuffs();
      state.elapsed += dt;
      state.waveTime += dt;
      if (state.waveTime >= WAVE_LENGTH) nextWave();
      if (state.elapsed >= 60) unlockAchievement("survive60");
      if (state.elapsed >= 45 && state.livesLost === 0) unlockAchievement("flawless45");

      updatePlayer(dt);

      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnItem();
        state.spawnTimer = waveSpawnInterval() * rand(0.78, 1.18);
        if (state.wave >= 4 && Math.random() < 0.22) spawnItem();
      }

      state.heartTimer -= dt;
      if (state.heartTimer <= 0) {
        spawnItem("heart");
        state.heartTimer = rand(21, 30);
      }

      state.bonusTimer -= dt;
      if (state.bonusTimer <= 0) {
        spawnItem(Math.random() < 0.5 ? "star" : "brush");
        state.bonusTimer = rand(20, 27);
      }

      updateItems(dt, t);

      const delta = state.score - state.shownScore;
      if (Math.abs(delta) < 0.5) {
        state.shownScore = state.score;
      } else {
        state.shownScore += delta * Math.min(1, dt * 11);
      }
      paintScore();
    } else if (mode === "menu") {
      updatePlayer(dt);
    }
  }

  function drawBackground(t) {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, view.width, view.height);

    const moonX = view.width * 0.5;
    const moonY = view.height * 0.18;
    const moonR = Math.min(view.width * 0.34, 175);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.08, moonX, moonY, moonR * 2);
    moonGlow.addColorStop(0, "rgba(255, 72, 96, 0.18)");
    moonGlow.addColorStop(0.4, "rgba(216, 33, 63, 0.1)");
    moonGlow.addColorStop(1, "rgba(150, 0, 32, 0)");
    ctx.fillStyle = moonGlow;
    ctx.fillRect(moonX - moonR * 2, moonY - moonR * 2, moonR * 4, moonR * 4);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255, 122, 139, 0.085)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 122, 139, 0.045)";
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 0.78, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    embers.forEach((ember) => {
      const alpha = ember.alpha * (0.65 + Math.sin(t * 1.6 + ember.phase) * 0.35);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = ember.cyan ? "#5de9f7" : "#ff5d54";
      ctx.fillRect(ember.x, ember.y, ember.size, ember.size);
    });
    ctx.restore();
  }

  function drawFloor(t) {
    const floorY = view.baseY - 5;
    const floorGradient = ctx.createLinearGradient(0, floorY, 0, view.height);
    floorGradient.addColorStop(0, "rgba(24, 5, 16, 0.97)");
    floorGradient.addColorStop(0.5, "rgba(13, 3, 10, 0.99)");
    floorGradient.addColorStop(1, "#050107");

    ctx.beginPath();
    ctx.moveTo(0, view.height);
    ctx.lineTo(0, floorY + 11);
    ctx.bezierCurveTo(view.width * 0.24, floorY - 3, view.width * 0.72, floorY + 8, view.width, floorY + 1);
    ctx.lineTo(view.width, view.height);
    ctx.closePath();
    ctx.fillStyle = floorGradient;
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const floorGlow = ctx.createRadialGradient(
      view.width * 0.5,
      floorY + 18,
      0,
      view.width * 0.5,
      floorY + 18,
      view.width * 0.72,
    );
    floorGlow.addColorStop(0, "rgba(255, 55, 79, 0.14)");
    floorGlow.addColorStop(1, "rgba(255, 55, 79, 0)");
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, floorY - 10, view.width, 90);

    const rim = ctx.createLinearGradient(0, floorY - 8, 0, floorY + 28);
    rim.addColorStop(0, "rgba(255, 84, 101, 0)");
    rim.addColorStop(0.42, "rgba(255, 84, 101, 0.14)");
    rim.addColorStop(1, "rgba(255, 84, 101, 0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, floorY - 8, view.width, 38);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#040107";
    ctx.beginPath();
    ctx.ellipse(player.x, view.baseY + 2, view.heroW * 0.47, Math.max(4, view.heroH * 0.034), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (Math.sin(t * 0.7) > -0.9) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.45 + Math.sin(t * 2.1) * 0.1;
      ctx.fillStyle = "rgba(255, 61, 86, 0.12)";
      ctx.beginPath();
      ctx.ellipse(player.x, view.baseY + 1, view.heroW * 0.3, 3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawItem(item, t) {
    const entryAlpha = clamp((item.y - 96) / 44, 0, 1);
    if (entryAlpha <= 0) return;

    if (item.type === "soul") {
      const bob = Math.sin(t * 4 + item.phase) * 2;
      const scale = item.scale * (1 + Math.sin(t * 5 + item.phase) * 0.035);
      const width = sprites.soul.width * scale;
      const height = sprites.soul.height * scale;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y + bob);
      ctx.rotate(Math.sin(t * 2.3 + item.phase) * 0.1);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
      glow.addColorStop(0, "rgba(89, 240, 255, 0.34)");
      glow.addColorStop(1, "rgba(89, 240, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-32, -34, 64, 68);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.soul, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    if (item.type === "heart") {
      const pulse = 1 + Math.sin(t * 5.2) * 0.08;
      const width = sprites.heart.width * item.scale * pulse;
      const height = sprites.heart.height * item.scale * pulse;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 31);
      glow.addColorStop(0, "rgba(255, 206, 219, 0.42)");
      glow.addColorStop(0.55, "rgba(255, 72, 107, 0.2)");
      glow.addColorStop(1, "rgba(255, 72, 107, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-34, -32, 68, 64);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.heart, -width / 2, -height / 2, width, height);
      const sparkle = 0.5 + Math.sin(t * 4) * 0.5;
      ctx.globalAlpha = 0.5 + sparkle * 0.5;
      ctx.strokeStyle = "rgba(255, 227, 210, 0.9)";
      ctx.lineWidth = 1.2;
      const sx = width * 0.64;
      const sy = -height * 0.42;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy);
      ctx.lineTo(sx + 3, sy);
      ctx.moveTo(sx, sy - 3);
      ctx.lineTo(sx, sy + 3);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (item.type === "star") {
      const pulse = 1 + Math.sin(t * 5.4 + item.phase) * 0.08;
      const width = sprites.star.width * item.scale * pulse;
      const height = sprites.star.height * item.scale * pulse;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.sin(t * 2 + item.phase) * 0.22 + item.t * 0.55);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 33);
      glow.addColorStop(0, "rgba(255, 226, 151, 0.5)");
      glow.addColorStop(0.55, "rgba(255, 193, 70, 0.18)");
      glow.addColorStop(1, "rgba(255, 193, 70, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-36, -36, 72, 72);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.star, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    if (item.type === "brush") {
      const bob = Math.sin(t * 3.8 + item.phase) * 2;
      const width = sprites.brush.width * item.scale;
      const height = sprites.brush.height * item.scale;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y + bob);
      ctx.rotate(Math.sin(t * 2.4 + item.phase) * 0.18);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 3, 1, 0, 3, 32);
      glow.addColorStop(0, "rgba(169, 251, 255, 0.36)");
      glow.addColorStop(0.55, "rgba(255, 93, 120, 0.12)");
      glow.addColorStop(1, "rgba(103, 244, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-35, -31, 70, 70);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.brush, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    if (item.type === "bomb") {
      const pulse = 1 + Math.sin(t * 7 + item.phase) * 0.025;
      const width = sprites.bomb.width * item.scale * pulse;
      const height = sprites.bomb.height * item.scale * pulse;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.sin(t * 2 + item.phase) * 0.12 + item.t * item.spin * 0.25);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 32);
      glow.addColorStop(0, "rgba(255, 122, 77, 0.38)");
      glow.addColorStop(1, "rgba(255, 72, 53, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-35, -35, 70, 70);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.bomb, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    if (item.type === "bone") {
      const width = sprites.bone.width * item.scale;
      const height = sprites.bone.height * item.scale;
      ctx.save();
      ctx.globalAlpha = entryAlpha;
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.sin(t * 2.2 + item.phase) * 0.35 + item.t * item.spin * 0.2);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 31);
      glow.addColorStop(0, "rgba(255, 208, 166, 0.3)");
      glow.addColorStop(0.55, "rgba(191, 104, 140, 0.12)");
      glow.addColorStop(1, "rgba(255, 208, 166, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-34, -30, 68, 60);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(sprites.bone, -width / 2, -height / 2, width, height);
      ctx.restore();
      return;
    }

    const angle = Math.sin(t * 2.6 + item.phase) * 0.14 + item.t * item.spin * 0.3;
    const width = sprites.skull.width * item.scale;
    const height = sprites.skull.height * item.scale;
    ctx.save();
    ctx.globalAlpha = entryAlpha;
    ctx.translate(item.x, item.y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    glow.addColorStop(0, "rgba(255, 40, 70, 0.32)");
    glow.addColorStop(1, "rgba(255, 40, 70, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-32, -32, 64, 64);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(sprites.skull, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  function drawHero(t) {
    if (!heroReady) return;

    const moving = clamp(Math.abs(player.vx) / 500, 0, 1);
    const bob = Math.sin(t * 3.4) * 2.2 + Math.sin(t * 9.2) * 1.7 * moving;
    const blink = state.invuln > 0 && Math.floor(t * 17) % 2 === 0 ? 0.34 : 1;

    ctx.save();
    ctx.translate(player.x, view.baseY + bob);
    ctx.rotate(player.tilt);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(0, -view.heroH * 0.48, 4, 0, -view.heroH * 0.48, view.heroW * 0.95);
    aura.addColorStop(0, "rgba(255, 42, 79, 0.15)");
    aura.addColorStop(0.5, "rgba(255, 42, 79, 0.055)");
    aura.addColorStop(1, "rgba(255, 42, 79, 0)");
    ctx.fillStyle = aura;
    ctx.fillRect(-view.heroW, -view.heroH * 1.25, view.heroW * 2, view.heroH * 1.6);
    ctx.restore();

    ctx.globalAlpha = blink;
    ctx.drawImage(heroImg, -view.heroW / 2, -view.heroH, view.heroW, view.heroH);
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    rings.forEach((ring) => {
      const alpha = clamp(ring.life / ring.maxLife, 0, 1);
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, TAU);
      ctx.stroke();
    });

    particles.forEach((particle) => {
      const alpha = clamp(particle.life / particle.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      const size = particle.size * (0.55 + alpha * 0.45);
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    });
    ctx.restore();
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    floats.forEach((float) => {
      const alpha = clamp(float.life / float.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${float.size}px "Unbounded", "Arial Black", sans-serif`;
      ctx.fillStyle = float.color;
      ctx.shadowColor = float.color;
      ctx.shadowBlur = 10;
      ctx.fillText(float.text, float.x, float.y);
    });
    ctx.restore();
  }

  function render(t) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = "#0b040a";
    ctx.fillRect(0, 0, view.width, view.height);

    const shakeX = state.shake > 0.15 ? rand(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0.15 ? rand(-state.shake, state.shake) * 0.65 : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground(t);
    drawFloor(t);
    items.forEach((item) => drawItem(item, t));
    drawHero(t);
    drawParticles();
    drawFloats();
    ctx.restore();

    if (state.flash > 0.002) {
      ctx.fillStyle = `rgba(255, 39, 70, ${state.flash * 0.17})`;
      ctx.fillRect(0, 0, view.width, view.height);
    }
    if (state.trapFlash > 0.002) {
      ctx.fillStyle = `rgba(255, 132, 70, ${state.trapFlash * 0.14})`;
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 0.034);
    lastFrame = now;
    const seconds = now / 1000;
    update(dt, seconds);
    render(seconds);
    window.requestAnimationFrame(frame);
  }

  function pointerToX(event) {
    const rect = canvas.getBoundingClientRect();
    return clamp(event.clientX - rect.left, view.heroW * 0.5, view.width - view.heroW * 0.5);
  }

  function onKeyDown(event) {
    if (!profileScreen.hidden) {
      if (event.code === "Escape") {
        event.preventDefault();
        closeProfile();
      }
      return;
    }

    if (event.code === "Space" || event.code === "Enter") {
      if (event.target instanceof Element && event.target.closest("button")) return;
      if (mode === "menu" || (mode === "over" && !overScreen.hidden) || mode === "paused") {
        event.preventDefault();
        if (mode === "paused") resumeGame();
        else startGame();
        return;
      }
    }

    if (event.code === "KeyP" || event.code === "Escape") {
      if (mode === "playing") {
        event.preventDefault();
        pauseGame();
      } else if (mode === "paused") {
        event.preventDefault();
        resumeGame();
      }
      return;
    }

    if (mode === "playing") {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        keys.left = true;
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        keys.right = true;
      }
    }
  }

  function onKeyUp(event) {
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
  }

  function bind() {
    $("startBtn").addEventListener("click", () => {
      sfx.unlock();
      startGame();
    });
    $("restartBtn").addEventListener("click", () => {
      sfx.unlock();
      startGame();
    });
    $("menuBtn").addEventListener("click", goMenu);
    $("pauseMenuBtn").addEventListener("click", goMenu);
    $("pauseBtn").addEventListener("click", pauseGame);
    $("resumeBtn").addEventListener("click", resumeGame);

    profileBtn.addEventListener("click", openProfile);
    profileClose.addEventListener("click", closeProfile);
    profileBack.addEventListener("click", closeProfile);
    profileScreen.addEventListener("pointerdown", (event) => {
      if (event.target === profileScreen) closeProfile();
    });

    soundBtn.addEventListener("click", () => {
      sfx.unlock();
      sfx.enabled = !sfx.enabled;
      writeStore(STORE_SOUND, sfx.enabled ? "1" : "0");
      setSoundUi();
      if (sfx.enabled) sfx.click();
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    canvas.addEventListener("pointerdown", (event) => {
      if (mode !== "playing") return;
      pointerDown = true;
      sfx.unlock();
      player.targetX = pointerToX(event);
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          /* pointer capture is optional */
        }
      }
      event.preventDefault();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (mode !== "playing") return;
      if (pointerDown || event.pointerType === "mouse") {
        player.targetX = pointerToX(event);
      }
    });

    window.addEventListener("pointermove", (event) => {
      if (mode === "playing" && pointerDown) {
        player.targetX = pointerToX(event);
      }
    });

    window.addEventListener("pointerup", () => {
      pointerDown = false;
    });
    window.addEventListener("pointercancel", () => {
      pointerDown = false;
    });

    gameEl.addEventListener("pointermove", (event) => {
      if (mode === "menu" && event.pointerType === "mouse") {
        const rect = gameEl.getBoundingClientRect();
        player.targetX = clamp(event.clientX - rect.left, view.heroW * 0.5, view.width - view.heroW * 0.5);
      }
    });

    window.addEventListener("resize", resize);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && mode === "playing") pauseGame();
    });

    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("pointerdown", () => sfx.unlock(), { once: true, passive: true });
  }

  function init() {
    buildLives();
    updateBestLabels();
    updateAchCounters();
    setSoundUi();
    gameEl.classList.add("is-menu");
    bind();
    resize();
    paintScore(true);
    paintCombo();
    paintBuffs();
    window.requestAnimationFrame(frame);
  }

  init();
})();
