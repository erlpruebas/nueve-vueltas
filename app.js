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
  partRanges: [],
  partsSource: "",
  partsUndo: [],
  selectedBoundary: null,
};

const stages = [
  { kicker: "Calentamiento", title: "Lee el texto", short: "Leer" },
  { kicker: "Nivel 1 · Siluetas", title: "Mira por debajo", short: "Mitad" },
  { kicker: "Nivel 2 · Pistas", title: "Sí no", short: "Sí no" },
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
  autoSplit: $("#auto-split-btn"), markEnd: $("#mark-end-btn"), undoParts: $("#undo-parts-btn"),
  splitPart: $("#split-part-btn"), splitHint: $("#split-hint"),
  boundaryPanel: $("#boundary-panel"), boundaryEditor: $("#boundary-editor"), boundaryStatus: $("#boundary-status"),
  partsPanel: $("#parts-panel"), partsList: $("#parts-list"), clearParts: $("#clear-parts-btn"),
  historyPanel: $("#history-panel"), historyList: $("#history-list"), clearHistory: $("#clear-history-btn"),
  nextPart: $("#next-part-btn"), finishTitle: $("#finish-title"), finishText: $("#finish-text"),
  backdrop: $("#highlight-backdrop"), fontMinus: $("#font-minus-btn"), fontPlus: $("#font-plus-btn"),
  finishParts: $("#finish-parts"), finishPartsList: $("#finish-parts-list"),
  picker: $("#picker"), pickerList: $("#picker-list"), pickerTitle: $("#picker-title"),
  pickerBack: $("#picker-back-btn"), viewParts: $("#view-parts-btn"),
  share: $("#share-btn"), pickerShare: $("#picker-share-btn"), gameShare: $("#game-share-btn"), finishShare: $("#finish-share-btn"),
  shareDialog: $("#share-dialog"), shareLink: $("#share-link"), shareStatus: $("#share-status"),
  shareClose: $("#share-close-btn"), shareCopy: $("#share-copy-btn"), shareNative: $("#share-native-btn"),
  projectFeedback: $("#project-feedback"),
};

const PART_COLORS = 5;
let readingTransition;

const LIST_ITEM_PREFIX = /^(?:\(?\d{1,3}(?:[.)])?|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][.)]|[•◦▪▫*–—-])\s+/u;
const INLINE_LIST_BOUNDARY = /([:;.!?…])\s+(?=(?:\(?\d{1,3}(?:[.)])?|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][.)]|[•◦▪▫*–—-])\s+)/gu;
const sentenceSegmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter("es", { granularity: "sentence" })
  : null;

function splitProse(line) {
  if (sentenceSegmenter) {
    return [...sentenceSegmenter.segment(line)]
      .map(({ segment }) => segment.trim())
      .filter(Boolean);
  }
  return (line.match(/.+?(?:[.!?…]+(?=\s|$)|$)/gu) || [line])
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitSentences(text) {
  const normalized = text
    .replace(/\r\n?|[\u2028\u2029]/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (!normalized) return [];

  // Google Docs puede pegar un encabezado y su lista en la misma línea:
  // «Tiene cinco partes: 1 ...». Convertimos cada número o viñeta en una frase.
  return normalized
    .replace(INLINE_LIST_BOUNDARY, "$1\n")
    .split(/\n+/)
    .flatMap((rawLine) => {
      const line = rawLine.trim();
      if (!line) return [];
      if (LIST_ITEM_PREFIX.test(line) || /[:;]$/.test(line)) return [line];
      return splitProse(line);
    });
}

function showScreen(name) {
  clearTimeout(readingTransition);
  [els.setup, els.picker, els.game, els.finish].forEach((el) => el.classList.remove("active"));
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
  if (stage === 1) renderLevelTwo(sentenceEl, sentence);
  else if (stage === 2) renderLevelOne(sentenceEl, sentence);
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
  els.read.disabled = state.reads === 9;
  els.show.innerHTML = state.revealed === state.sentences.length
    ? (state.stage === stages.length - 1 ? "Terminar <span aria-hidden=\"true\">✦</span>" : "Siguiente nivel →")
    : "Mostrar →";
  renderNav();
  renderCard();
}

function goToStage(index) {
  clearTimeout(readingTransition);
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
  state.playIndex = -1;
  addToHistory(text, [...state.parts]);
  if (state.parts.length) showPartPicker();
  else goToPart(0);
}

function goToPart(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.playlist.length) return;
  state.playIndex = index;
  startPart();
}

function renderPartChoices(container) {
  container.replaceChildren();
  state.playlist.forEach((part, index) => {
    const btn = document.createElement("button");
    btn.className = `finish-part pc-${index % PART_COLORS}${index === state.playIndex ? " current" : ""}`;
    btn.append(makeSpan("part-label", `Parte ${index + 1}`), makeSpan("part-snippet", snippet(part, 70)));
    btn.addEventListener("click", () => goToPart(index));
    container.append(btn);
  });
}

function showPartPicker() {
  renderPartChoices(els.pickerList);
  showScreen("picker");
  window.scrollTo({ top: 0 });
  els.pickerTitle.focus({ preventScroll: true });
}

function renderFinishParts() {
  els.finishParts.hidden = state.playlist.length < 2;
  renderPartChoices(els.finishPartsList);
}

function startPart() {
  state.text = state.playlist[state.playIndex];
  state.sentences = splitSentences(state.text);
  state.stage = 0;
  state.reads = 0;
  state.revealed = 0;
  state.unlocked = 0;
  els.viewParts.hidden = state.parts.length === 0;
  showScreen("game");
  window.scrollTo({ top: 0 });
  render();
  beep(440);
}

for (let i = 0; i < 9; i += 1) els.readDots.append(makeSpan("read-dot"));

els.input.addEventListener("input", () => {
  els.projectFeedback.hidden = true;
  const count = splitSentences(els.input.value).length;
  els.hint.textContent = els.input.value.trim() ? `${count} ${count === 1 ? "frase detectada" : "frases detectadas"}` : "Mínimo una frase";
  if (state.partsSource !== els.input.value) {
    if (state.partRanges.every(Boolean)) {
      state.partRanges = TextParts.rebaseRanges(state.partsSource, els.input.value, state.partRanges);
      state.parts = TextParts.partsFromRanges(els.input.value, state.partRanges);
    } else recomputePartRanges();
    state.partsSource = els.input.value;
    state.partsUndo = [];
    state.selectedBoundary = null;
  }
  renderParts();
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
    readingTransition = setTimeout(() => goToStage(1), 650);
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
    els.finishTitle.textContent = state.playlist.length > 1 ? `Parte ${state.playIndex + 1} completada` : "Ya es tuyo.";
    els.finishText.textContent = hasNext
      ? "Esta parte ya está en tu cabeza. Sigue con la siguiente o salta a la que quieras."
      : state.playlist.length > 1
        ? "Has terminado esta parte. Puedes elegir cualquier otra para practicar."
        : "Has leído, reconstruido y recordado el texto completo.";
    renderFinishParts();
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
els.pickerBack.addEventListener("click", () => showScreen("setup"));
els.viewParts.addEventListener("click", showPartPicker);
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
  state.partRanges = [];
  state.partsSource = "";
  state.partsUndo = [];
  state.selectedBoundary = null;
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
  state.partRanges = TextParts.rangesFromParts(els.input.value, state.parts);
  state.partsSource = els.input.value;
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
  els.partsPanel.hidden = state.parts.length === 0 && state.partsUndo.length === 0;
  els.clearParts.disabled = state.parts.length === 0;
  els.start.innerHTML = state.parts.length
    ? 'Elegir parte <span aria-hidden="true">→</span>'
    : 'Empezar <span aria-hidden="true">→</span>';
  els.undoParts.disabled = state.partsUndo.length === 0;
  renderHighlights();
  els.partsList.replaceChildren();
  state.parts.forEach((part, index) => {
    const item = document.createElement("li");
    item.className = `part-item pc-${index % PART_COLORS}`;
    const remove = document.createElement("button");
    remove.className = "part-delete";
    remove.textContent = "×";
    const action = state.parts.length === 1 ? "Quitar división" : `Unir parte ${index + 1} con la ${index < state.parts.length - 1 ? "siguiente" : "anterior"}`;
    remove.setAttribute("aria-label", action);
    remove.title = action;
    remove.addEventListener("click", () => {
      if (!canAdjustParts()) return;
      setPartRanges(TextParts.mergePart(state.partRanges, index));
      beep(210, .05);
    });
    item.append(makeSpan("part-label", `Parte ${index + 1}`), makeSpan("part-snippet", snippet(part, 90)), remove);
    els.partsList.append(item);
  });
  renderBoundaryEditor();
  resetMarks();
}

function resetMarks() {
  els.splitPart.disabled = els.input.selectionEnd <= els.input.selectionStart;
  els.splitHint.textContent = "Coloca el cursor al final de una parte y pulsa «Marcar hasta aquí». La siguiente comienza ahí; el resto del texto queda incluido.";
}

els.splitMode.addEventListener("click", () => {
  state.splitMode = !state.splitMode;
  els.splitControls.hidden = !state.splitMode;
  els.splitMode.classList.toggle("active", state.splitMode);
  if (state.splitMode) resetMarks();
  beep(state.splitMode ? 500 : 300, .05);
});

els.markEnd.addEventListener("click", () => {
  const offset = els.input.selectionEnd;
  if (!els.input.value.slice(0, offset).trim()) { toast("Coloca el cursor después del texto de la primera parte"); return; }
  if (!canAdjustParts()) return;
  setPartRanges(TextParts.splitAt(els.input.value, state.partRanges, [offset]));
  toast(`${state.parts.length} ${state.parts.length === 1 ? "parte preparada" : "partes preparadas"}`);
  beep(470, .05);
});

els.splitPart.addEventListener("click", () => {
  const { selectionStart: start, selectionEnd: end, value: text } = els.input;
  if (start === end || !text.slice(start, end).trim() || !canAdjustParts()) return;
  setPartRanges(TextParts.selectRange(text, state.partRanges, start, end));
  toast("Selección preparada como una parte completa");
  beep(560, .07);
});

els.clearParts.addEventListener("click", () => {
  setPartRanges([]);
  beep(210, .05);
});

els.autoSplit.addEventListener("click", () => {
  const text = els.input.value;
  if (!text.trim()) { toast("Pega primero el texto que quieres dividir"); els.input.focus(); return; }
  setPartRanges(TextParts.autoRanges(text));
  toast(state.parts.length > 1 ? `${state.parts.length} partes creadas automáticamente` : "Una parte: no hay dos líneas en blanco entre bloques");
});

["select", "keyup", "pointerup"].forEach((type) => els.input.addEventListener(type, resetMarks));

function canAdjustParts() {
  if (state.partRanges.every(Boolean)) return true;
  toast("Vuelve a dividir este texto automáticamente para ajustar sus límites");
  return false;
}

function setPartRanges(ranges) {
  state.partsUndo.push({ ranges: state.partRanges.map((range) => range && { ...range }), parts: [...state.parts] });
  if (state.partsUndo.length > 20) state.partsUndo.shift();
  state.partRanges = ranges;
  state.partsSource = els.input.value;
  state.parts = TextParts.partsFromRanges(els.input.value, ranges);
  state.selectedBoundary = null;
  renderParts();
}

els.undoParts.addEventListener("click", () => {
  const previous = state.partsUndo.pop();
  if (!previous) return;
  state.partRanges = previous.ranges;
  state.parts = previous.parts;
  state.selectedBoundary = null;
  renderParts();
});

function renderBoundaryEditor(ranges = state.partRanges) {
  els.boundaryPanel.hidden = ranges.length < 2 || !ranges.every(Boolean);
  if (els.boundaryPanel.hidden) { els.boundaryEditor.replaceChildren(); return; }
  const text = els.input.value;
  const fragment = document.createDocumentFragment();
  let position = 0;
  function appendText(start, end, color) {
    if (end <= start) return;
    const span = makeSpan(`boundary-text${color === undefined ? "" : ` hl-${color % PART_COLORS}`}`, text.slice(start, end));
    span.dataset.sourceStart = start;
    fragment.append(span);
  }
  ranges.forEach((range, index) => {
    appendText(position, range.start);
    appendText(range.start, range.end, index);
    position = range.end;
    if (index === ranges.length - 1) return;
    const marker = document.createElement("button");
    marker.className = `boundary-handle${state.selectedBoundary === index ? " selected" : ""}`;
    marker.textContent = "↔";
    marker.dataset.boundary = index;
    marker.setAttribute("role", "slider");
    marker.setAttribute("aria-label", `Límite entre partes ${index + 1} y ${index + 2}`);
    marker.setAttribute("aria-valuemin", range.start + 1);
    marker.setAttribute("aria-valuemax", ranges[index + 1].end - 1);
    marker.setAttribute("aria-valuenow", range.end);
    marker.setAttribute("aria-valuetext", `Parte ${index + 1}: ${snippet(text.slice(range.start, range.end), 55)}`);
    marker.title = `Arrastra para ajustar las partes ${index + 1} y ${index + 2}`;
    fragment.append(marker);
  });
  appendText(position, text.length);
  const scroll = els.boundaryEditor.scrollTop;
  els.boundaryEditor.replaceChildren(fragment);
  els.boundaryEditor.scrollTop = scroll;
}

function sourceOffsetAtPoint(x, y) {
  let node, offset;
  if (document.caretPositionFromPoint) {
    const caret = document.caretPositionFromPoint(x, y);
    if (caret) { node = caret.offsetNode; offset = caret.offset; }
  } else if (document.caretRangeFromPoint) {
    const caret = document.caretRangeFromPoint(x, y);
    if (caret) { node = caret.startContainer; offset = caret.startOffset; }
  }
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const span = element?.closest?.(".boundary-text");
  if (!span || !els.boundaryEditor.contains(span)) return null;
  return Number(span.dataset.sourceStart) + (node.nodeType === Node.TEXT_NODE ? offset : offset > 0 ? span.textContent.length : 0);
}

let boundaryDrag = null;
function updateBoundaryDrag() {
  if (!boundaryDrag || !boundaryDrag.moved) return;
  const box = els.boundaryEditor.getBoundingClientRect();
  if (boundaryDrag.y < box.top + 28) els.boundaryEditor.scrollTop -= 12;
  else if (boundaryDrag.y > box.bottom - 28) els.boundaryEditor.scrollTop += 12;
  const offset = sourceOffsetAtPoint(boundaryDrag.x, Math.min(box.bottom - 8, Math.max(box.top + 8, boundaryDrag.y)));
  if (offset === null) return;
  const draft = TextParts.moveBoundary(els.input.value, state.partRanges, boundaryDrag.index, offset);
  if (draft[boundaryDrag.index].end !== boundaryDrag.draft[boundaryDrag.index].end) {
    boundaryDrag.draft = draft;
    renderBoundaryEditor(draft);
    els.boundaryStatus.textContent = `Ajustando el límite entre las partes ${boundaryDrag.index + 1} y ${boundaryDrag.index + 2}…`;
  }
}

function dragFrame() {
  if (!boundaryDrag) return;
  updateBoundaryDrag();
  boundaryDrag.frame = requestAnimationFrame(dragFrame);
}

els.boundaryEditor.addEventListener("pointerdown", (event) => {
  const marker = event.target.closest(".boundary-handle");
  if (!marker || boundaryDrag || (event.pointerType === "mouse" && event.button !== 0)) return;
  event.preventDefault();
  const index = Number(marker.dataset.boundary);
  state.selectedBoundary = index;
  boundaryDrag = { index, pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, draft: state.partRanges };
  els.boundaryEditor.setPointerCapture(event.pointerId);
  document.body.classList.add("moving-boundary");
  els.boundaryStatus.textContent = `Límite ${index + 1} seleccionado. Arrástralo o toca el punto del texto donde quieras dejarlo.`;
  dragFrame();
});

els.boundaryEditor.addEventListener("pointermove", (event) => {
  if (!boundaryDrag || event.pointerId !== boundaryDrag.pointerId) return;
  boundaryDrag.x = event.clientX;
  boundaryDrag.y = event.clientY;
  boundaryDrag.moved ||= Math.hypot(event.clientX - boundaryDrag.startX, event.clientY - boundaryDrag.startY) > 5;
});

function finishBoundaryDrag(event) {
  if (!boundaryDrag || event.pointerId !== boundaryDrag.pointerId) return;
  const drag = boundaryDrag;
  cancelAnimationFrame(drag.frame);
  boundaryDrag = null;
  document.body.classList.remove("moving-boundary");
  if (els.boundaryEditor.hasPointerCapture(event.pointerId)) els.boundaryEditor.releasePointerCapture(event.pointerId);
  if (event.type === "pointercancel") { state.selectedBoundary = null; renderBoundaryEditor(); return; }
  if (drag.moved) {
    setPartRanges(drag.draft);
    els.boundaryStatus.textContent = "Límite ajustado. El texto completo se conserva entre las dos partes.";
  } else renderBoundaryEditor();
  els.boundaryEditor.querySelector(`[data-boundary="${drag.index}"]`)?.focus({ preventScroll: true });
}

["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => els.boundaryEditor.addEventListener(type, finishBoundaryDrag));
els.boundaryEditor.addEventListener("click", (event) => {
  if (state.selectedBoundary === null || event.target.closest(".boundary-handle")) return;
  const offset = sourceOffsetAtPoint(event.clientX, event.clientY);
  if (offset === null) return;
  setPartRanges(TextParts.moveBoundary(els.input.value, state.partRanges, state.selectedBoundary, offset));
  els.boundaryStatus.textContent = "Límite ajustado.";
});

els.boundaryEditor.addEventListener("keydown", (event) => {
  const marker = event.target.closest(".boundary-handle");
  if (!marker) return;
  if (event.key === "Escape") { state.selectedBoundary = null; renderBoundaryEditor(); return; }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = Number(marker.dataset.boundary);
  const stops = TextParts.boundaryStops(els.input.value, state.partRanges, index);
  const current = state.partRanges[index].end;
  const backwards = ["ArrowLeft", "ArrowUp"].includes(event.key);
  const offset = event.key === "Home" ? stops[0] : event.key === "End" ? stops.at(-1)
    : backwards ? stops.filter((stop) => stop < current).at(-1) : stops.find((stop) => stop > current);
  if (offset === undefined) return;
  setPartRanges(TextParts.moveBoundary(els.input.value, state.partRanges, index, offset));
  els.boundaryEditor.querySelector(`[data-boundary="${index}"]`)?.focus({ preventScroll: true });
  els.boundaryStatus.textContent = "Límite ajustado.";
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
      loadProject(item);
      if (state.parts.length) begin();
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

function loadProject(project) {
  els.input.value = project.text;
  state.parts = Array.isArray(project.parts) ? [...project.parts] : [];
  state.partsUndo = [];
  state.selectedBoundary = null;
  recomputePartRanges();
  state.splitMode = false;
  els.splitControls.hidden = true;
  els.splitMode.classList.remove("active");
  resetMarks();
  renderParts();
  els.input.dispatchEvent(new Event("input"));
  showScreen("setup");
}

let shareRequest = 0;
async function openShareDialog() {
  const text = els.input.value.trim();
  if (text.length < 3) {
    els.hint.textContent = "Escribe un poco más para compartir el proyecto";
    els.input.focus();
    return;
  }
  const request = ++shareRequest;
  els.shareLink.value = "";
  els.shareCopy.disabled = true;
  els.shareNative.hidden = true;
  els.shareStatus.textContent = "Preparando el enlace…";
  els.shareDialog.showModal();
  try {
    const token = await ProjectLinks.encodeProject({ v: 1, text, parts: [...state.parts] });
    if (request !== shareRequest || !els.shareDialog.open) return;
    els.shareLink.value = ProjectLinks.BASE_URL + "#proyecto=" + token;
    els.shareCopy.disabled = false;
    const data = { title: "Nueve vueltas", url: els.shareLink.value };
    els.shareNative.hidden = !navigator.share || (navigator.canShare && !navigator.canShare(data));
    els.shareStatus.textContent = "El enlace incluye el texto completo y sus partes.";
    els.shareCopy.focus();
  } catch (error) {
    if (request === shareRequest) els.shareStatus.textContent = error.message || "No se pudo crear el enlace del proyecto.";
  }
}

[els.share, els.pickerShare, els.gameShare, els.finishShare].forEach((button) => button.addEventListener("click", openShareDialog));
els.shareClose.addEventListener("click", () => els.shareDialog.close());
els.shareLink.addEventListener("click", () => els.shareLink.select());
els.shareCopy.addEventListener("click", async () => {
  const link = els.shareLink.value;
  if (!link) return;
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch {
    els.shareLink.focus();
    els.shareLink.select();
    try { copied = document.execCommand("copy"); } catch { /* selección manual */ }
  }
  els.shareStatus.textContent = copied
    ? "Enlace copiado. Ya puedes pegarlo en WhatsApp."
    : "Selecciona el enlace y cópialo para enviarlo.";
});
els.shareNative.addEventListener("click", async () => {
  try {
    await navigator.share({ title: "Nueve vueltas", url: els.shareLink.value });
  } catch (error) {
    if (error.name !== "AbortError") els.shareStatus.textContent = "Puedes copiar el enlace y enviarlo desde tu aplicación.";
  }
});

let importRequest = 0;
async function importSharedProject() {
  const prefix = "#proyecto=";
  if (!window.location.hash.startsWith(prefix)) return;
  const token = window.location.hash.slice(prefix.length);
  const request = ++importRequest;
  els.projectFeedback.textContent = "Abriendo proyecto compartido…";
  els.projectFeedback.hidden = false;
  try {
    const project = await ProjectLinks.decodeProject(token);
    if (request !== importRequest || window.location.hash !== prefix + token) return;
    loadProject(project);
    // Ya está guardado: una nueva visita no vuelve a importar una copia antigua.
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* archivo local */ }
    if (state.parts.length) begin();
    else addToHistory(project.text, project.parts);
    toast("Proyecto importado y guardado en el histórico");
  } catch (error) {
    if (request !== importRequest || window.location.hash !== prefix + token) return;
    els.projectFeedback.textContent = error.message || "No se pudo abrir el proyecto. Comprueba que has copiado el enlace completo.";
    els.projectFeedback.hidden = false;
    showScreen("setup");
  }
}

window.addEventListener("hashchange", importSharedProject);
importSharedProject();
