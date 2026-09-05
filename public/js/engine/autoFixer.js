class AutoFixer {
  constructor() {}

  diagnoseText(text) {
    const issues = [];

    // Issue 1: Zero-width & Control characters
    const zeroWidthCount = (text.match(/[\u200B-\u200D\uFEFF]/g) || []).length;
    if (zeroWidthCount > 0) {
      issues.push({
        id: 'zero-width',
        title: 'Caracteres invisíveis de largura zero',
        count: zeroWidthCount,
        desc: `Detectados ${zeroWidthCount} caracteres de largura zero (Zero-Width Space/BOM).`
      });
    }

    // Issue 2: NBSP (Non-Breaking Spaces)
    const nbspCount = (text.match(/\u00A0/g) || []).length;
    if (nbspCount > 0) {
      issues.push({
        id: 'nbsp',
        title: 'Espaços inquebráveis (NBSP)',
        count: nbspCount,
        desc: `Detectados ${nbspCount} espaços não-quebráveis (NBSP \\u00A0).`
      });
    }

    // Issue 3: Multiple spaces
    const multiSpaces = (text.match(/ {2,}/g) || []).length;
    if (multiSpaces > 0) {
      issues.push({
        id: 'multi-spaces',
        title: 'Espaços múltiplos consecutivos',
        count: multiSpaces,
        desc: `Detectadas ${multiSpaces} sequências de espaços duplos ou triplos.`
      });
    }

    // Issue 4: Multiple empty lines
    const emptyLines = (text.match(/\n{3,}/g) || []).length;
    if (emptyLines > 0) {
      issues.push({
        id: 'empty-lines',
        title: 'Múltiplas linhas em branco consecutivas',
        count: emptyLines,
        desc: `Detectados ${emptyLines} blocos de linhas vazias excessivas.`
      });
    }

    // Issue 5: PDF Line breaks mid-sentence
    const brokenPdfLines = (text.match(/([a-zà-ú,])\n([a-zà-ú])/gi) || []).length;
    if (brokenPdfLines > 2) {
      issues.push({
        id: 'pdf-breaks',
        title: 'Quebras artificiais de linha de PDF',
        count: brokenPdfLines,
        desc: `Detectadas ${brokenPdfLines} quebras no meio de frases.`
      });
    }

    // Issue 6: Duplicate lines
    const lines = text.split('\n');
    const uniqueLines = new Set(lines.map(l => l.trim()));
    const duplicateCount = lines.length - uniqueLines.size;
    if (duplicateCount > 2) {
      issues.push({
        id: 'duplicate-lines',
        title: 'Linhas duplicadas na lista',
        count: duplicateCount,
        desc: `Detectadas ${duplicateCount} linhas repetidas.`
      });
    }

    // Issue 7: Broken CSV delimiter
    if (text.includes(';') && text.includes(',')) {
      issues.push({
        id: 'csv-delimiters',
        title: 'CSV com delimitadores misturados (;,)',
        count: 1,
        desc: 'Delimitadores inconsistentes entre vírgula e ponto-e-vírgula.'
      });
    }

    // Issue 8: Broken JSON syntax
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      if (text.includes("'") || text.match(/,\s*[}\]]/)) {
        issues.push({
          id: 'json-syntax',
          title: 'Sintaxe de JSON inválida/quebrada',
          count: 1,
          desc: 'JSON possui aspas simples ou vírgulas sobressalentes no final.'
        });
      }
    }

    return issues;
  }

  fixInvisibleChars(text) {
    return text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ');
  }

  normalizeSpaces(text) {
    return text.replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  }

  fixPdfBreaks(text) {
    return text.replace(/([a-zà-ú0-9,])\n([a-zà-ú0-9])/gi, '$1 $2');
  }

  fixDuplicates(text) {
    const lines = text.split('\n');
    const seen = new Set();
    const result = [];
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed === '' || !seen.has(trimmed)) {
        if (trimmed !== '') seen.add(trimmed);
        result.push(line);
      }
    }
    return result.join('\n');
  }

  fixCsvDelimiter(text, targetDelimiter = ',') {
    return text.replace(/;/g, targetDelimiter);
  }

  fixJsonSyntax(text) {
    let fixed = text
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    try {
      const parsed = JSON.parse(fixed);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return fixed;
    }
  }

  fixAll(text) {
    let fixed = text;
    fixed = this.fixInvisibleChars(fixed);
    fixed = this.normalizeSpaces(fixed);
    fixed = this.fixPdfBreaks(fixed);
    fixed = this.fixDuplicates(fixed);
    return fixed;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.autoFixer = new AutoFixer();
});
