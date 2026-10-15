const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../text-parts.js');
const parts = (text, ranges) => P.partsFromRanges(text, ranges);

test('divide con dos o más líneas en blanco, conservando un salto o una línea en blanco dentro de la parte', () => {
  const text = 'Uno.\nSigue uno.\n\nTodavía uno.\n\n\nDos.\n\n\n\nTres.';
  const ranges = P.autoRanges(text);
  assert.deepEqual(parts(text, ranges), ['Uno.\nSigue uno.\n\nTodavía uno.', 'Dos.', 'Tres.']);
  assert.equal(ranges.map(range => text.slice(range.start, range.end)).join(''), text);
});

test('cuenta líneas vacías con espacios, tabulaciones y finales Windows', () => {
  const text = 'Inicio.\r\n \t\r\n\t \r\nFinal.';
  const ranges = P.autoRanges(text);
  assert.deepEqual(parts(text, ranges), ['Inicio.', 'Final.']);
  assert.equal(ranges[0].end, ranges[1].start);
  const oneBlankLine = 'Inicio.\r\n\r\nSigue en la misma parte.';
  assert.deepEqual(parts(oneBlankLine, P.autoRanges(oneBlankLine)), [oneBlankLine]);
});

test('no crea partes vacías con separadores al principio o al final', () => {
  const text = '\n\n\n  Único texto.\n\n\n\n';
  assert.deepEqual(parts(text, P.autoRanges(text)), ['Único texto.']);
  assert.deepEqual(P.autoRanges(' \n\n\n '), []);
});

test('cada corte manual incluye el resto del texto y puede continuar desde el corte anterior', () => {
  const text = 'Primero. Segundo. Tercero.';
  let ranges = P.splitAt(text, [], [9]);
  assert.deepEqual(parts(text, ranges), ['Primero.', 'Segundo. Tercero.']);
  ranges = P.splitAt(text, ranges, [18]);
  assert.deepEqual(parts(text, ranges), ['Primero.', 'Segundo.', 'Tercero.']);
  assert.equal(ranges.map(range => text.slice(range.start, range.end)).join(''), text);
});

test('la selección completa forma una sola parte y conserva el texto anterior y posterior', () => {
  const text = 'Uno. Dos. Tres. Cuatro.';
  const existing = P.splitAt(text, [], [5, 10, 16]);
  const ranges = P.selectRange(text, existing, 5, 16);
  assert.deepEqual(parts(text, ranges), ['Uno.', 'Dos. Tres.', 'Cuatro.']);
});

test('mover un límite modifica solo las dos partes vecinas y conserva todo el texto', () => {
  const text = 'Uno dos tres. Cuatro cinco seis. Siete ocho.';
  const ranges = P.splitAt(text, [], [14, 32]);
  const moved = P.moveBoundary(text, ranges, 0, 21);
  assert.deepEqual(parts(text, moved), ['Uno dos tres. Cuatro', 'cinco seis.', 'Siete ocho.']);
  assert.deepEqual(moved[2], ranges[2]);
  assert.equal(moved.map(range => text.slice(range.start, range.end)).join(''), text);
  assert.deepEqual(ranges, P.splitAt(text, [], [14, 32]));
});

test('los límites extremos mantienen ambas partes con texto', () => {
  const text = 'Uno dos tres cuatro';
  const ranges = P.splitAt(text, [], [8]);
  for (const offset of [-200, 0, text.length, 10000]) {
    const moved = P.moveBoundary(text, ranges, 0, offset);
    assert.ok(parts(text, moved).every(value => value.trim()));
    assert.equal(moved[0].end, moved[1].start);
  }
});

test('unir partes conserva su contenido y los límites restantes', () => {
  const text = 'Uno. Dos. Tres.';
  const ranges = P.splitAt(text, [], [5, 10]);
  assert.deepEqual(parts(text, P.mergePart(ranges, 0)), ['Uno. Dos.', 'Tres.']);
  assert.deepEqual(parts(text, P.mergePart(ranges, 2)), ['Uno.', 'Dos. Tres.']);
});

test('reconstruye los proyectos antiguos y los textos repetidos en orden', () => {
  const text = '  Eco.\n\n\nEco.\n\n\nFinal.  ';
  const saved = ['Eco.', 'Eco.', 'Final.'];
  const ranges = P.rangesFromParts(text, saved);
  assert.deepEqual(parts(text, ranges), saved);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[0].end, ranges[1].start);
  assert.equal(ranges.at(-1).end, text.length);
});

test('editar el texto actualiza los offsets sin conservar copias antiguas de las partes', () => {
  const before = 'Uno. Dos. Tres.';
  const ranges = P.splitAt(before, [], [5, 10]);
  const after = 'Nuevo Uno. Dos. Tres.';
  const updated = P.rebaseRanges(before, after, ranges);
  assert.deepEqual(parts(after, updated), ['Nuevo Uno.', 'Dos.', 'Tres.']);
  const shorter = 'Uno. Tres.';
  assert.deepEqual(parts(shorter, P.rebaseRanges(before, shorter, ranges)), ['Uno.', 'Tres.']);
});

test('al insertar justo en un límite, el texto queda incluido una sola vez', () => {
  const before = 'Uno. Dos.';
  const ranges = P.splitAt(before, [], [5]);
  const after = 'Uno. Extra. Dos.';
  const updated = P.rebaseRanges(before, after, ranges);
  assert.equal(updated.map(range => after.slice(range.start, range.end)).join(''), after);
});
