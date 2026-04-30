var SXNormalize = {
  normalizeDisplayText: function(text) {
    return String(typeof text === 'undefined' || text === null ? '' : text)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .trim();
  },

  normalizeHeaderText: function(text) {
    return this.normalizeDisplayText(text)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  compactHeaderText: function(text) {
    return this.normalizeHeaderText(text).replace(/\s+/g, '');
  },

  sanitizeBaseName: function(originalFilename) {
    var sourceName = originalFilename || 'workbook.xlsx';
    var nameWithoutExtension = String(sourceName).replace(/\.[^.]+$/, '');
    var cleaned = nameWithoutExtension
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return cleaned || 'workbook';
  },

  estimateLineWidth: function(text) {
    var normalized = String(text || '');
    if (!normalized) {
      return 0;
    }

    var graphemes = this.segmentGraphemes_(normalized);
    var total = 0;

    for (var index = 0; index < graphemes.length; index += 1) {
      total += this.estimateGraphemeWidth_(graphemes[index]);
    }

    return total;
  },

  segmentGraphemes_: function(text) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      var segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      var segments = segmenter.segment(String(text || ''));
      var result = [];

      for (var iterator = segments[Symbol.iterator](), next = iterator.next(); !next.done; next = iterator.next()) {
        result.push(next.value.segment);
      }

      return result;
    }

    return Array.prototype.slice.call(String(text || ''));
  },

  estimateGraphemeWidth_: function(grapheme) {
    if (!grapheme) {
      return 0;
    }

    if (/^\s$/u.test(grapheme)) {
      return 0.45;
    }

    if (/^[0-9]$/u.test(grapheme)) {
      return 0.9;
    }

    if (/^[A-Z]$/u.test(grapheme)) {
      return 1;
    }

    if (/^[a-z]$/u.test(grapheme)) {
      return 0.9;
    }

    if (/^[\u0E00-\u0E7F]$/u.test(grapheme)) {
      return 1;
    }

    if (/^[\u2E80-\u9FFF]$/u.test(grapheme)) {
      return 1.6;
    }

    if (',.:;\'"`~!@#$%^&*()_-=+/?\\|[]{}<>'.indexOf(grapheme) !== -1) {
      return 0.6;
    }

    return 1;
  }
};
