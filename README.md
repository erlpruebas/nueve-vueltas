# Nueve vueltas

**Memoriza cualquier texto sin darte cuenta.** Pega un texto y la aplicación lo va
borrando poco a poco, en cinco niveles, hasta que solo queda en tu cabeza.

👉 **Pruébalo aquí:** https://erlpruebas.github.io/nueve-vueltas/

## Cómo funciona

El método se basa en la repetición con pistas que van desapareciendo:

1. **Leer** — lees el texto completo nueve veces.
2. **Mitad** — se oculta media altura de las letras, manteniendo la primera palabra como pista.
3. **Sí no** — se conservan las dos primeras palabras y se ocultan letras alternas en las siguientes.
4. **Bloques** — cada palabra se convierte en una silueta.
5. **Nada** — reconstruyes el texto de memoria.

En cada nivel vas mostrando las frases una a una para comprobar si las recuerdas.

## Funcionalidades

- **Histórico**: guarda automáticamente los textos que has practicado (en tu propio
  navegador, con `localStorage`; no se envía nada a ningún servidor).
- **Dividir en partes**: para textos largos, marca inicio y final de cada trozo.
  Antes de empezar, al cargar un proyecto del histórico o al abrir uno compartido,
  elige la parte que quieres practicar. Durante los ejercicios puedes pulsar
  **Ver partes** para elegir otra. Cada parte se resalta con un color.
- **Compartir proyectos**: pulsa **Compartir proyecto** y **Copiar enlace** para
  enviarlo por WhatsApp o cualquier mensajería. El enlace contiene el texto completo
  y todas sus partes; al abrirlo se importa y se guarda en el histórico del receptor.
  En los dispositivos compatibles también aparece el botón **Compartir…**.
  El avance de los ejercicios no se guarda ni se comparte: cada parte comienza de nuevo.
- **Listas y texto pegado**: reconoce los saltos de línea, los números y las viñetas
  de textos copiados para mantener cada punto como una frase independiente.
- **Tamaño de letra ajustable** con los botones `A−` / `A+`.
- **Controles flotantes** para que el texto largo siga siendo legible al desplazarte.

## Uso en local

Al ser una página estática no necesita servidor. Puedes:

- Abrir `index.html` directamente en el navegador (o usar `arrancar_memoria.bat` en Windows).
- O servirla con cualquier servidor estático, por ejemplo: `python -m http.server`.

## Privacidad

Todo ocurre en tu navegador. El histórico se guarda solo en tu dispositivo.
Cuando decides compartir un proyecto, su texto y sus partes se incluyen en la
terminación del enlace (`#proyecto=…`), comprimidos cuando el navegador lo permite.
Ese fragmento no se envía al servidor de la página; cualquier persona que reciba
el enlace completo puede abrir el proyecto. No se incluyen progreso ni preferencias.

## Comprobación

Con Node.js 22 o posterior, ejecuta `node --test tests/project-links.test.cjs` para
comprobar la importación y exportación, Unicode, compresión y enlaces dañados.
