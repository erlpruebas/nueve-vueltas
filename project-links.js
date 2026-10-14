(function (root) {
  "use strict";

  const BASE_URL = "https://erlpruebas.github.io/nueve-vueltas/";
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_TOKEN_LENGTH = Math.ceil(MAX_BYTES * 4 / 3) + 8;

  function validateProject(value) {
    if (!value || value.v !== 1 || typeof value.text !== "string"
      || value.text.trim().length < 3 || !Array.isArray(value.parts)
      || value.parts.length > 1000
      || value.parts.some((part) => typeof part !== "string" || !part.trim())) {
      throw new Error("El enlace no contiene un proyecto válido.");
    }
    // Solo compartimos el texto y las partes, nunca el avance ni preferencias.
    return { v: 1, text: value.text, parts: [...value.parts] };
  }

  function toBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(value) {
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
      throw new Error("El enlace del proyecto está incompleto o dañado.");
    }
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (char) => char.charCodeAt(0));
  }

  async function encodeProject(value) {
    const project = validateProject(value);
    const bytes = new TextEncoder().encode(JSON.stringify(project));
    if (bytes.length > MAX_BYTES) throw new Error("El proyecto es demasiado grande para compartirlo en un enlace.");
    if (typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined") {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
      if (compressed.length < bytes.length) return "g1." + toBase64Url(compressed);
    }
    return "j1." + toBase64Url(bytes);
  }

  async function readLimited(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new RangeError("El proyecto del enlace es demasiado grande.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  async function decodeProject(token) {
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
      throw new Error("El enlace del proyecto es demasiado grande.");
    }
    const match = /^(g1|j1)\.([A-Za-z0-9_-]+)$/.exec(token);
    if (!match) throw new Error("El enlace del proyecto está incompleto o usa un formato desconocido.");
    let bytes = fromBase64Url(match[2]);
    if (match[1] === "g1") {
      if (typeof DecompressionStream === "undefined") {
        throw new Error("Abre este proyecto en un navegador actualizado para poder importarlo.");
      }
      try {
        bytes = await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")));
      } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new Error("El enlace del proyecto está incompleto o dañado.");
      }
    }
    if (bytes.length > MAX_BYTES) throw new Error("El proyecto del enlace es demasiado grande.");
    let project;
    try {
      project = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new Error("El enlace del proyecto está incompleto o dañado.");
    }
    return validateProject(project);
  }

  const api = { BASE_URL, encodeProject, decodeProject };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ProjectLinks = api;
})(globalThis);
