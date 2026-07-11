# Nueve vueltas

**Memoriza cualquier texto sin darte cuenta.** Pega un texto y la aplicación lo va
borrando poco a poco, en cinco niveles, hasta que solo queda en tu cabeza.

👉 **Pruébalo aquí:** https://erlpruebas.github.io/nueve-vueltas/

## Cómo funciona

El método se basa en la repetición con pistas que van desapareciendo:

1. **Leer** — lees el texto completo nueve veces.
2. **Dos palabras y media** — se ocultan letras alternas de cada palabra.
3. **Mitad** — solo se ve la mitad superior de las letras.
4. **Bloques** — cada palabra se convierte en una silueta.
5. **Nada** — reconstruyes el texto de memoria.

En cada nivel vas mostrando las frases una a una para comprobar si las recuerdas.

## Funcionalidades

- **Histórico**: guarda automáticamente los textos que has practicado (en tu propio
  navegador, con `localStorage`; no se envía nada a ningún servidor).
- **Dividir en partes**: para textos largos, marca inicio y final de cada trozo y
  practícalos por separado, uno tras otro. Al terminar una parte aparece una lista
  para saltar directamente a cualquiera de ellas. Cada parte se resalta con un color.
- **Listas y texto pegado**: reconoce los saltos de línea, los números y las viñetas
  de textos copiados para mantener cada punto como una frase independiente.
- **Tamaño de letra ajustable** con los botones `A−` / `A+`.
- **Controles flotantes** para que el texto largo siga siendo legible al desplazarte.

## Uso en local

Al ser una página estática no necesita servidor. Puedes:

- Abrir `index.html` directamente en el navegador (o usar `arrancar_memoria.bat` en Windows).
- O servirla con cualquier servidor estático, por ejemplo: `python -m http.server`.

## Privacidad

Todo ocurre en tu navegador. El histórico se guarda solo en tu dispositivo y no se
comparte con nadie.
