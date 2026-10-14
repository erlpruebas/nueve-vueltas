const test = require("node:test");
const assert = require("node:assert/strict");
const { gzipSync, gunzipSync } = require("node:zlib");
const { BASE_URL, encodeProject, decodeProject } = require("../project-links.js");

const project = {
  v: 1,
  text: "Primera parte: ¡Sí, mañana! 🧠\n\nSegunda parte: canción, pingüino y 日本語.",
  parts: ["Primera parte: ¡Sí, mañana! 🧠", "Segunda parte: canción, pingüino y 日本語."],
};
const rawToken = (value) => "j1." + Buffer.from(JSON.stringify(value)).toString("base64url");

test("el enlace usa la aplicación publicada", () => {
  assert.equal(BASE_URL, "https://erlpruebas.github.io/nueve-vueltas/");
});

test("conserva texto, Unicode, saltos de línea y partes en orden", async () => {
  const token = await encodeProject(project);
  assert.match(token, /^(g1|j1)\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeProject(token), project);
});

test("comprime un texto largo sin perder contenido", async () => {
  const text = "Una frase que se repite con tildes y signos: ¡acción!\n".repeat(1000);
  const value = { v: 1, text, parts: [text.slice(0, 2000), text.slice(2000)] };
  const token = await encodeProject(value);
  assert.ok(token.startsWith("g1."));
  assert.ok(token.length < text.length / 4);
  assert.deepEqual(await decodeProject(token), value);
});

test("el contenido compartido excluye avance y preferencias", async () => {
  const token = await encodeProject({ ...project, stage: 4, reads: 9, playIndex: 1, sound: false, progress: [9, 3] });
  const bytes = Buffer.from(token.slice(3), "base64url");
  const decoded = JSON.parse((token.startsWith("g1.") ? gunzipSync(bytes) : bytes).toString("utf8"));
  assert.deepEqual(decoded, project);
});

test("admite un enlace sin compresión y un proyecto sin partes", async () => {
  const value = { v: 1, text: "Un texto completo sin dividir.", parts: [] };
  assert.deepEqual(await decodeProject(rawToken(value)), value);
});

test("importa gzip generado independientemente del codificador", async () => {
  const token = "g1." + gzipSync(Buffer.from(JSON.stringify(project))).toString("base64url");
  assert.deepEqual(await decodeProject(token), project);
});

test("rechaza enlaces truncados, desconocidos y gzip dañado", async () => {
  for (const token of ["", "g2.abc", "g1.!", "j1.a", "j1.ey", "g1.YWJj"]) {
    await assert.rejects(decodeProject(token));
  }
});

test("rechaza contenido con estructura incorrecta", async () => {
  for (const value of [null, { ...project, v: 2 }, { ...project, text: " " }, { ...project, parts: "texto" }, { ...project, parts: [null] }, { ...project, parts: [" "] }]) {
    await assert.rejects(decodeProject(rawToken(value)), /proyecto válido/);
  }
});

test("no interpreta texto HTML del proyecto como código", async () => {
  const value = { v: 1, text: '<script>alert("texto")</script>', parts: ['<script>alert("texto")</script>'] };
  assert.deepEqual(await decodeProject(await encodeProject(value)), value);
});

test("limita el contenido descomprimido de enlaces externos", async () => {
  const token = "g1." + gzipSync(Buffer.from(JSON.stringify({ v: 1, text: "a".repeat(2 * 1024 * 1024), parts: [] }))).toString("base64url");
  await assert.rejects(decodeProject(token), /demasiado grande/);
});

test("rechaza proyectos demasiado grandes al exportar", async () => {
  await assert.rejects(encodeProject({ v: 1, text: "a".repeat(2 * 1024 * 1024), parts: [] }), /demasiado grande/);
});

test("permite compartir sin las APIs de compresión", async () => {
  const original = globalThis.CompressionStream;
  try {
    globalThis.CompressionStream = undefined;
    const token = await encodeProject(project);
    assert.ok(token.startsWith("j1."));
    assert.deepEqual(await decodeProject(token), project);
  } finally {
    globalThis.CompressionStream = original;
  }
});
