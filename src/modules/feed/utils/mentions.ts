/**
 * Extrae las menciones de usuarios del texto (formato @username).
 * @param text - Texto del caption
 * @returns Array de handles mencionados (sin el @)
 */
export function extractMentions(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex para encontrar menciones: @ seguido de letras, números, guiones bajos
  // Evita capturar emails
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.matchAll(mentionRegex);

  const mentions = new Set<string>();
  for (const match of matches) {
    const handle = match[1]?.toLowerCase();
    if (handle && handle.length > 0 && handle.length <= 30) {
      // Validar longitud del handle (mismo límite que en el modelo User)
      mentions.add(handle);
    }
  }

  return Array.from(mentions);
}

