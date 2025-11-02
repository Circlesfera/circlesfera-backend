/**
 * Extrae hashtags de un texto siguiendo el formato de Instagram/Twitter.
 * Los hashtags deben empezar con # y contener solo letras, números y guiones bajos.
 */
export const extractHashtags = (text: string): string[] => {
  // Regex para encontrar hashtags: # seguido de alfanuméricos y guiones bajos
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = text.matchAll(hashtagRegex);

  const hashtags = Array.from(matches, (match) => match[1].toLowerCase());
  
  // Eliminar duplicados
  return Array.from(new Set(hashtags));
};

