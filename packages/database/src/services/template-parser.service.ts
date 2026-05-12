export interface TemplateData {
  paciente?: string | null;
  procedimento?: string | null;
  medico?: string | null;
  data?: string | null;
  hora?: string | null;
}

const DEFAULT_TERMS: Record<keyof TemplateData, string> = {
  paciente: 'nosso paciente',
  procedimento: 'seu procedimento',
  medico: 'nosso especialista',
  data: 'a data agendada',
  hora: 'o horário marcado'
};

export class TemplateParser {
  /**
   * Substitui {{tags}} no texto pelo valor real ou um termo genérico (Graceful Degradation)
   */
  static parse(content: string, data: TemplateData): string {
    let parsed = content;

    // Regex para encontrar {{tags}} ignorando espaços extras
    const tagRegex = /\{\{\s*(\w+)\s*\}\}/g;

    parsed = parsed.replace(tagRegex, (match, tag) => {
      const key = tag as keyof TemplateData;
      
      // Busca valor real, se nulo ou inexistente usa o DEFAULT_TERMS
      const value = data[key];
      if (value && value.trim().length > 0) {
        return value;
      }

      const fallback = DEFAULT_TERMS[key];
      if (fallback) {
        console.debug(`[TemplateParser] Variável {{${tag}}} nula/vazia. Usando fallback: "${fallback}"`);
        return fallback;
      }

      return match; // Mantém a tag se não for reconhecida
    });

    return parsed;
  }
}
