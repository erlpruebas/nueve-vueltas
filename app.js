const $ = (selector) => document.querySelector(selector);

const state = {
  text: "",
  sentences: [],
  stage: 0,
  reads: 0,
  revealed: 0,
  sound: true,
  unlocked: 0,
  parts: [],
  playlist: [],
  playIndex: 0,
  splitMode: false,
  markStart: null,
  markEnd: null,
  partRanges: [],
};

const stages = [
  { kicker: "Calentamiento", title: "Lee el texto", short: "Leer" },
  { kicker: "Nivel 1 · Pistas", title: "Dos palabras y media", short: "2 palabras" },
  { kicker: "Nivel 2 · Siluetas", title: "Mira por debajo", short: "Mitad" },
  { kicker: "Nivel 3 · Formas", title: "Reconoce el ritmo", short: "Bloques" },
  { kicker: "Nivel 4 · Memoria", title: "Ahora, sin pistas", short: "Nada" },
];

const els = {
  setup: $("#setup"), game: $("#game"), finish: $("#finish"),
  input: $("#source-text"), start: $("#start-btn"), hint: $("#text-hint"),
  nav: $("#level-nav"), kicker: $("#stage-kicker"), title: $("#stage-title"), count: $("#stage-count"),
  card: $("#text-card"), readingControls: $("#reading-controls"), revealControls: $("#reveal-controls"),
  readDots: $("#read-dots"), readLabel: $("#read-label"), read: $("#read-btn"),
  hide: $("#hide-btn"), show: $("#show-btn"), exit: $("#exit-btn"), sound: $("#sound-btn"),
  again: $("#again-btn"), fresh: $("#new-btn"), toast: $("#toast"),
  splitMode: $("#split-mode-btn"), splitControls: $("#split-controls"),
  markStart: $("#mark-start-btn"), markEnd: $("#mark-end-btn"),
  splitPart: $("#split-part-btn"), splitHint: $("#split-hint"),
  partsPanel: $("#parts-panel"), partsList: $("#parts-list"), clearParts: $("#clear-parts-btn"),
  historyPanel: $("#history-panel"), historyList: $("#history-list"), clearHistory: $("#clear-history-btn"),
  nextPart: $("#next-part-btn"), finishTitle: $("#finish-title"), finishText: $("#finish-text"),
  backdrop: $("#highlight-backdrop"), fontMinus: $("#font-minus-btn"), fontPlus: $("#font-plus-btn"),
};

const PART_COLORS = 5;

function splitSentences(text) {
  const normalized = text.trim().replace(/\r\n/g, "\n");
  const chunks = normalized.match(/[^.!?…\n]+(?:[.!?…]+|(?=\n|$))/g) || [normalized];
  return chunks.map((part) => part.trim()).filter(Boolean);
}

function showScreen(name) {
  [els.setup, els.game, els.finish].forEach((el) => el.classList.remove("active"));
  els[name].classList.add("active");
}

function makeSpan(className, text = "") {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function appendOriginal(container, text) {
  container.append(document.createTextNode(text));
}

function renderLevelOne(container, sentence) {
  const parts = sentence.split(/(\s+)/);
  let wordIndex = 0;
  parts.forEach((part) => {
    if (/^\s+$/.test(part)) return appendOriginal(container, part);
    wordIndex += 1;
    if (wordIndex <= 2) return appendOriginal(container, part);
    [...part].forEach((char, i) => {
      if (!/[\p{L}\p{N}]/u.test(char) || i % 2 === 0) appendOriginal(container, char);
      else container.append(makeSpan("masked-letter", char));
    });
  });
}

function renderLevelTwo(container, sentence) {
  const parts = sentence.split(/(\s+)/);
  let wordIndex = 0;
  parts.forEach((part) => {
    if (/^\s+$/.test(part)) return appendOriginal(container, part);
    wordIndex += 1;
    if (wordIndex === 1) return appendOriginal(container, part);
    [...part].forEach((char) => {
      if (!/[\p{L}\p{N}]/u.test(char)) return appendOriginal(container, char);
      const half = makeSpan("half-letter");
      half.append(makeSpan("", char));
      container.append(half);
    });
  });
}

const NUMBER_WORDS = new Set([
  "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciseis", "dieciséis", "diecisiete",
  "dieciocho", "diecinueve", "veinte",
  "primero", "primera", "segundo", "segunda", "tercero", "tercera", "cuarto", "cuarta",
  "quinto", "quinta", "sexto", "sexta", "septimo", "séptimo", "octavo", "noveno", "decimo", "décimo",
]);

function isNumberToken(token) {
  const clean = token.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  if (!clean) return false;
  if (/^\d+$/.test(clean)) return true;
  return NUMBER_WORDS.has(clean);
}

function renderLevelThree(container, sentence) {
  const parts = sentence.split(/(\s+)/);
  let wordIndex = 0;
  let visibleWords = 1;
  parts.forEach((part) => {
    if (/^\s+$/.test(part)) return;
    wordIndex += 1;
    if (wordIndex === 1 && isNumberToken(part)) visibleWords = 2;
    if (wordIndex <= visibleWords) {
      appendOriginal(container, part + " ");
      return;
    }
    const letters = part.replace(/[^\p{L}\p{N}]/gu, "").length;
    const block = makeSpan("word-block");
    block.style.width = `${Math.max(0.75, letters * 0.52)}em`;
    block.setAttribute("aria-label", "palabra oculta");
    container.append(block);
  });
}

function renderMasked(sentenceEl, sentence, stage) {
  if (stage === 1) renderLevelOne(sentenceEl, sentence);
  else if (stage === 2) renderLevelTwo(sentenceEl, sentence);
  else if (stage === 3) renderLevelThree(sentenceEl, sentence);
  else sentenceEl.append(makeSpan("ghost-dash", "—"));
}

function renderCard() {
  els.card.replaceChildren();
  state.sentences.forEach((sentence, index) => {
    const sentenceEl = makeSpan("sentence");
    if (state.stage === 0 || index < state.revealed) {
      sentenceEl.classList.add("revealed");
      sentenceEl.textContent = sentence;
    } else {
      renderMasked(sentenceEl, sentence, state.stage);
    }
    els.card.append(sentenceEl);
  });
}

function renderNav() {
  els.nav.replaceChildren();
  stages.forEach((item, index) => {
    const button = document.createElement("button");
    button.className = `level-tab${index === state.stage ? " active" : ""}${index < state.unlocked ? " done" : ""}`;
    button.textContent = `${index + 1}. ${item.short}`;
    button.title = item.title;
    button.addEventListener("click", () => goToStage(index));
    els.nav.append(button);
  });
}

function render() {
  const config = stages[state.stage];
  const partBadge = state.playlist.length > 1 ? `Parte ${state.playIndex + 1} de ${state.playlist.length} · ` : "";
  els.kicker.textContent = partBadge + config.kicker;
  els.title.textContent = config.title;
  els.count.textContent = state.stage === 0 ? `${state.reads} de 9` : `${state.revealed} de ${state.sentences.length} frases`;
  els.readingControls.hidden = state.stage !== 0;
  els.revealControls.hidden = state.stage === 0;
  els.readLabel.textContent = `${state.reads} / 9 lecturas`;
  [...els.readDots.children].forEach((dot, i) => dot.classList.toggle("on", i < state.reads));
  els.hide.disabled = state.revealed === 0;
  els.show.innerHTML = state.revealed === state.sentences.length
    ? (state.stage === stages.length - 1 ? "Terminar <span aria-hidden=\"true\">✦</span>" : "Siguiente nivel →")
    : "Mostrar →";
  renderNav();
  renderCard();
}

function goToStage(index) {
  state.stage = index;
  state.unlocked = Math.max(state.unlocked, index);
  state.revealed = 0;
  window.scrollTo({ top: 0 });
  render();
  beep(330 + index * 65, .055, "square");
}

let audioContext;
function beep(frequency = 440, duration = .07, type = "square") {
  if (!state.sound) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function successSound() {
  [523, 659, 784].forEach((freq, i) => setTimeout(() => beep(freq, .1), i * 85));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 1400);
}

function begin() {
  const text = els.input.value.trim();
  if (text.length < 3) {
    els.hint.textContent = "Escribe un poco más para empezar";
    els.input.focus();
    beep(120, .12, "sawtooth");
    return;
  }
  state.playlist = state.parts.length ? [...state.parts] : [text];
  state.playIndex = 0;
  addToHistory(text, [...state.parts]);
  startPart();
}

function startPart() {
  state.text = state.playlist[state.playIndex];
  state.sentences = splitSentences(state.text);
  state.stage = 0;
  state.reads = 0;
  state.revealed = 0;
  state.unlocked = 0;
  showScreen("game");
  window.scrollTo({ top: 0 });
  render();
  beep(440);
}

for (let i = 0; i < 9; i += 1) els.readDots.append(makeSpan("read-dot"));

els.input.addEventListener("input", () => {
  const count = splitSentences(els.input.value).length;
  els.hint.textContent = els.input.value.trim() ? `${count} ${count === 1 ? "frase detectada" : "frases detectadas"}` : "Mínimo una frase";
  recomputePartRanges();
  renderHighlights();
});
els.input.addEventListener("scroll", () => {
  els.backdrop.scrollTop = els.input.scrollTop;
});

const FONT_KEY = "nueve-vueltas-letra";
let fontScale = parseFloat(localStorage.getItem(FONT_KEY)) || 1;
function applyFontScale() {
  fontScale = Math.min(1.8, Math.max(0.7, Math.round(fontScale * 10) / 10));
  document.documentElement.style.setProperty("--font-scale", fontScale);
  try { localStorage.setItem(FONT_KEY, String(fontScale)); } catch { /* sin almacenamiento */ }
}
els.fontMinus.addEventListener("click", () => { fontScale -= 0.1; applyFontScale(); beep(280, .04); });
els.fontPlus.addEventListener("click", () => { fontScale += 0.1; applyFontScale(); beep(360, .04); });
applyFontScale();
els.start.addEventListener("click", begin);
els.read.addEventListener("click", () => {
  state.reads = Math.min(9, state.reads + 1);
  beep(310 + state.reads * 30);
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (state.reads === 9) {
    state.unlocked = 1;
    successSound();
    toast("¡Nueve lecturas! Nivel 1 desbloqueado");
    setTimeout(() => goToStage(1), 650);
  }
  render();
});
els.show.addEventListener("click", () => {
  if (state.revealed < state.sentences.length) {
    state.revealed += 1;
    beep(480 + state.revealed * 18);
    render();
    return;
  }
  if (state.stage === stages.length - 1) {
    successSound();
    const hasNext = state.playIndex < state.playlist.length - 1;
    els.nextPart.hidden = !hasNext;
    els.finishTitle.textContent = hasNext ? `Parte ${state.playIndex + 1} completada` : "Ya es tuyo.";
    els.finishText.textContent = hasNext
      ? "Esta parte ya está en tu cabeza. Sigue con la siguiente."
      : "Has leído, reconstruido y recordado el texto completo.";
    window.scrollTo({ top: 0 });
    showScreen("finish");
  } else {
    state.unlocked = Math.max(state.unlocked, state.stage + 1);
    goToStage(state.stage + 1);
  }
});
els.hide.addEventListener("click", () => {
  state.revealed = Math.max(0, state.revealed - 1);
  beep(210, .05);
  render();
});
els.exit.addEventListener("click", () => showScreen("setup"));
els.sound.addEventListener("click", () => {
  state.sound = !state.sound;
  els.sound.textContent = state.sound ? "♪" : "×";
  els.sound.setAttribute("aria-label", state.sound ? "Desactivar sonido" : "Activar sonido");
  if (state.sound) beep(440);
});
els.again.addEventListener("click", () => {
  state.stage = 0; state.reads = 0; state.revealed = 0; state.unlocked = 0;
  showScreen("game"); render();
});
els.fresh.addEventListener("click", () => {
  els.input.value = "";
  els.hint.textContent = "Mínimo una frase";
  state.parts = [];
  renderParts();
  resetMarks();
  showScreen("setup");
  els.input.focus();
});

function snippet(text, max = 60) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function recomputePartRanges() {
  const text = els.input.value;
  let from = 0;
  state.partRanges = state.parts.map((part) => {
    const idx = text.indexOf(part, from);
    if (idx === -1) return null;
    from = idx + part.length;
    return { start: idx, end: idx + part.length };
  });
}

function renderHighlights() {
  const text = els.input.value;
  const fragment = document.createDocumentFragment();
  let pos = 0;
  state.partRanges.forEach((range, index) => {
    if (!range || range.start < pos || range.end > text.length) return;
    fragment.append(document.createTextNode(text.slice(pos, range.start)));
    const mark = document.createElement("mark");
    mark.className = `hl hl-${index % PART_COLORS}`;
    mark.textContent = text.slice(range.start, range.end);
    fragment.append(mark);
    pos = range.end;
  });
  fragment.append(document.createTextNode(text.slice(pos)));
  els.backdrop.replaceChildren(fragment);
  els.backdrop.scrollTop = els.input.scrollTop;
}

function renderParts() {
  els.partsPanel.hidden = state.parts.length === 0;
  els.start.innerHTML = state.parts.length
    ? `Empezar ${state.parts.length} ${state.parts.length === 1 ? "parte" : "partes"} <span aria-hidden="true">→</span>`
    : 'Empezar <span aria-hidden="true">→</span>';
  recomputePartRanges();
  renderHighlights();
  els.partsList.replaceChildren();
  state.parts.forEach((part, index) => {
    const item = document.createElement("li");
    item.className = `part-item pc-${index % PART_COLORS}`;
    const remove = document.createElement("button");
    remove.className = "part-delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Borrar parte ${index + 1}`);
    remove.addEventListener("click", () => {
      state.parts.splice(index, 1);
      renderParts();
      beep(210, .05);
    });
    item.append(makeSpan("part-label", `Parte ${index + 1}`), makeSpan("part-snippet", snippet(part, 90)), remove);
    els.partsList.append(item);
  });
}

function resetMarks() {
  state.markStart = null;
  state.markEnd = null;
  els.markEnd.disabled = true;
  els.splitPart.hidden = true;
  els.splitHint.textContent = "Coloca el cursor donde empieza la parte (o selecciona el trozo entero) y pulsa «Marcar inicio».";
}

function updateSplitPreview() {
  if (state.markStart === null) return;
  if (state.markEnd === null || state.markEnd <= state.markStart) {
    els.splitPart.hidden = true;
    els.splitHint.textContent = "Inicio marcado. Coloca el cursor donde termina y pulsa «Marcar final».";
    return;
  }
  const fragment = els.input.value.slice(state.markStart, state.markEnd).trim();
  if (!fragment) {
    els.splitPart.hidden = true;
    els.splitHint.textContent = "El trozo marcado está vacío. Vuelve a marcar.";
    return;
  }
  els.splitPart.hidden = false;
  els.splitHint.textContent = `Parte ${state.parts.length + 1}: «${snippet(fragment, 46)}»`;
}

els.splitMode.addEventListener("click", () => {
  state.splitMode = !state.splitMode;
  els.splitControls.hidden = !state.splitMode;
  els.splitMode.classList.toggle("active", state.splitMode);
  if (state.splitMode) resetMarks();
  beep(state.splitMode ? 500 : 300, .05);
});

els.markStart.addEventListener("click", () => {
  state.markStart = els.input.selectionStart ?? 0;
  state.markEnd = els.input.selectionEnd > state.markStart ? els.input.selectionEnd : null;
  els.markEnd.disabled = false;
  updateSplitPreview();
  beep(430, .05);
});

els.markEnd.addEventListener("click", () => {
  state.markEnd = els.input.selectionEnd ?? els.input.value.length;
  updateSplitPreview();
  beep(470, .05);
});

els.splitPart.addEventListener("click", () => {
  const fragment = els.input.value.slice(state.markStart, state.markEnd).trim();
  if (!fragment) return;
  state.parts.push(fragment);
  renderParts();
  resetMarks();
  toast(`Parte ${state.parts.length} creada`);
  beep(560, .07);
});

els.clearParts.addEventListener("click", () => {
  state.parts = [];
  renderParts();
  resetMarks();
  beep(210, .05);
});

const HISTORY_KEY = "nueve-vueltas-historial";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20))); }
  catch { /* almacenamiento no disponible */ }
}

function addToHistory(text, parts) {
  const items = loadHistory().filter((item) => item.text !== text);
  items.unshift({ text, parts, date: new Date().toISOString() });
  saveHistory(items);
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  els.historyPanel.hidden = items.length === 0;
  els.historyList.replaceChildren();
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "history-item";
    const load = document.createElement("button");
    load.className = "history-load";
    const when = new Date(item.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    const partsInfo = item.parts?.length ? ` · ${item.parts.length} partes` : "";
    load.append(makeSpan("history-snippet", snippet(item.text, 90)), makeSpan("history-meta", `${when}${partsInfo}`));
    load.addEventListener("click", () => {
      els.input.value = item.text;
      state.parts = Array.isArray(item.parts) ? [...item.parts] : [];
      renderParts();
      els.input.dispatchEvent(new Event("input"));
      toast("Texto cargado del histórico");
      beep(500, .06);
    });
    const remove = document.createElement("button");
    remove.className = "part-delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Borrar del histórico");
    remove.addEventListener("click", () => {
      const rest = loadHistory();
      rest.splice(index, 1);
      saveHistory(rest);
      renderHistory();
      beep(210, .05);
    });
    li.append(load, remove);
    els.historyList.append(li);
  });
}

els.clearHistory.addEventListener("click", () => {
  saveHistory([]);
  renderHistory();
  toast("Histórico vaciado");
});

els.nextPart.addEventListener("click", () => {
  state.playIndex += 1;
  startPart();
});

renderHistory();
resetMarks();
