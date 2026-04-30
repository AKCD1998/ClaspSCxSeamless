var SXHeaderLookup = {
  findColumnByHeaderText: function(sheet, headerText, options) {
    var rowStart = options.rowStart || 1;
    var rowEnd = options.rowEnd || Math.max(sheet.getLastRow(), 1);
    var left = options.left || 1;
    var right = options.right || Math.max(sheet.getLastColumn(), 1);
    var model = options.model || SXSheetUtils.buildModel(
      sheet,
      SXSheetUtils.getUsedRangeBounds(sheet) || {
        top: 1,
        left: 1,
        bottom: Math.max(sheet.getLastRow(), 1),
        right: Math.max(sheet.getLastColumn(), 1)
      }
    );
    var mergeIndex = model ? model.mergeIndex : {};
    var targetExact = SXNormalize.normalizeHeaderText(headerText);
    var targetTrimmed = SXNormalize.compactHeaderText(targetExact);
    var visited = {};
    var trimmedFallback = null;

    for (var rowNumber = rowStart; rowNumber <= rowEnd; rowNumber += 1) {
      for (var columnNumber = left; columnNumber <= right; columnNumber += 1) {
        var mergeRange = SXMergedRangeUtils.getMergeRangeAt(mergeIndex, rowNumber, columnNumber);
        var key = mergeRange
          ? [mergeRange.top, mergeRange.left, mergeRange.bottom, mergeRange.right].join(':')
          : rowNumber + ':' + columnNumber;

        if (visited[key]) {
          continue;
        }

        visited[key] = true;

        var anchorRow = mergeRange ? mergeRange.top : rowNumber;
        var anchorColumn = mergeRange ? mergeRange.left : columnNumber;
        var displayValue = SXSheetUtils.getResolvedDisplayValue(model, anchorRow, anchorColumn);

        if (!displayValue) {
          continue;
        }

        var normalizedCandidate = SXNormalize.normalizeHeaderText(displayValue);
        var match = {
          start: anchorColumn,
          count: mergeRange ? mergeRange.right - mergeRange.left + 1 : 1,
          rowNumber: anchorRow,
          columnNumber: anchorColumn,
          matchedText: displayValue,
          normalizedText: normalizedCandidate,
          strategy: 'exact'
        };

        if (normalizedCandidate === targetExact) {
          return match;
        }

        if (!trimmedFallback && SXNormalize.compactHeaderText(normalizedCandidate) === targetTrimmed) {
          trimmedFallback = {
            start: match.start,
            count: match.count,
            rowNumber: match.rowNumber,
            columnNumber: match.columnNumber,
            matchedText: match.matchedText,
            normalizedText: match.normalizedText,
            strategy: 'trimmed'
          };
        }
      }
    }

    return trimmedFallback;
  }
};
