(function (root) {
  "use strict";

  function fromCuts(text, cuts) {
    const edges = [...new Set([0, ...cuts, text.length])]
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= text.length)
      .sort((a, b) => a - b);
    const ranges = [];
    for (let i = 1; i < edges.length; i += 1) {
      const range = { start: edges[i - 1], end: edges[i] };
      if (text.slice(range.start, range.end).trim()) ranges.push(range);
      else if (ranges.length) ranges[ranges.length - 1].end = range.end;
    }
    if (ranges.length) ranges[0].start = 0;
    return ranges;
  }

  function autoRanges(text) {
    // Dos líneas en blanco requieren tres saltos de línea. Conservamos los offsets.
    const separators = /(?:(?:\r\n|\r(?!\n)|[\n\u2028\u2029])[^\S\r\n\u2028\u2029]*){3,}/gu;
    return fromCuts(text, [...text.matchAll(separators)].map((match) => match.index + match[0].length));
  }

  function partsFromRanges(text, ranges) {
    return ranges.map((range) => text.slice(range.start, range.end).trim());
  }

  function rangesFromParts(text, parts) {
    let from = 0;
    const ranges = parts.map((part) => {
      const normalized = part.replace(/\r\n?/g, "\n").trim();
      const start = text.indexOf(normalized, from);
      if (start < 0 || !normalized) return null;
      from = start + normalized.length;
      return { start, end: from };
    });
    // Los proyectos antiguos pueden dejar texto sin seleccionar. Lo respetamos.
    ranges.forEach((range, index) => {
      if (!range) return;
      const previous = ranges[index - 1];
      if (index === 0 && !text.slice(0, range.start).trim()) range.start = 0;
      if (previous && !text.slice(previous.end, range.start).trim()) previous.end = range.start;
      if (index === ranges.length - 1 && !text.slice(range.end).trim()) range.end = text.length;
    });
    return ranges;
  }

  function splitAt(text, ranges, offsets) {
    const existing = ranges.filter(Boolean).flatMap(({ start, end }) => [start, end]);
    // La parte restante se crea también: ningún trozo del texto queda fuera.
    return fromCuts(text, [...existing, ...offsets]);
  }

  function selectRange(text, ranges, start, end) {
    const existing = ranges.filter(Boolean).flatMap((range) => [range.start, range.end]);
    return fromCuts(text, [...existing.filter((offset) => offset <= start || offset >= end), start, end]);
  }

  function boundaryStops(text, ranges, index) {
    const left = ranges[index];
    const right = ranges[index + 1];
    if (!left || !right) return [];
    const combined = text.slice(left.start, right.end);
    const firstText = left.start + combined.search(/\S/u);
    const lastText = left.start + combined.trimEnd().length;
    const stops = [...combined.matchAll(/\s+/gu)]
      .map((match) => left.start + match.index + match[0].length)
      .filter((offset) => offset > firstText && offset < lastText);
    if (!stops.length) {
      let offset = left.start;
      for (const char of combined) {
        offset += char.length;
        if (offset < right.end) stops.push(offset);
      }
    }
    return stops;
  }

  function moveBoundary(text, ranges, index, offset) {
    const result = ranges.map((range) => range && { ...range });
    const stops = boundaryStops(text, ranges, index);
    if (!stops.length || !Number.isFinite(offset)) return result;
    const nearest = stops.reduce((best, candidate) => Math.abs(candidate - offset) < Math.abs(best - offset) ? candidate : best);
    result[index].end = nearest;
    result[index + 1].start = nearest;
    return result;
  }

  function mergePart(ranges, index) {
    const result = ranges.map((range) => range && { ...range });
    if (result.length < 2) return [];
    const left = index < result.length - 1 ? index : index - 1;
    if (!result[left] || !result[left + 1]) return result;
    result.splice(left, 2, { start: result[left].start, end: result[left + 1].end });
    return result;
  }

  function rebaseRanges(before, after, ranges) {
    if (before === after) return ranges.map((range) => range && { ...range });
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
    let oldEnd = before.length;
    let newEnd = after.length;
    while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd -= 1; newEnd -= 1; }
    const delta = newEnd - oldEnd;
    const map = (offset) => offset < start ? offset : offset >= oldEnd ? offset + delta : newEnd;
    return ranges.filter(Boolean).map((range) => ({
      start: range.start === 0 ? 0 : map(range.start),
      end: map(range.end),
    })).filter((range) => range.end > range.start && after.slice(range.start, range.end).trim());
  }

  const api = { autoRanges, partsFromRanges, rangesFromParts, splitAt, selectRange, boundaryStops, moveBoundary, mergePart, rebaseRanges };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TextParts = api;
})(globalThis);
