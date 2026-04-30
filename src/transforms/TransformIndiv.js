var SXTransformIndiv = {
  collectColumnMatches: function(sheet, model, warningCollector, profile) {
    var bounds = model.bounds;
    var matches = [];

    for (var index = 0; index < profile.deletionHeaders.length; index += 1) {
      var headerText = profile.deletionHeaders[index];
      var match = SXHeaderLookup.findColumnByHeaderText(sheet, headerText, {
        rowStart: profile.headerRowStart,
        rowEnd: Math.min(profile.headerRowEnd, bounds.bottom),
        left: bounds.left,
        right: bounds.right,
        model: model
      });

      if (!match) {
        SXWarnings.add(warningCollector, 'Could not find header "' + headerText + '" for column deletion.');
        continue;
      }

      matches.push({
        headerText: headerText,
        matchedText: match.matchedText,
        strategy: match.strategy,
        start: match.start,
        count: match.count
      });
    }

    matches.sort(function(left, right) {
      return right.start - left.start;
    });

    return matches;
  },

  detectFinalTableRange: function(sheet, model, profile) {
    var startMatch = SXHeaderLookup.findColumnByHeaderText(sheet, profile.tableStartHeader, {
      rowStart: Math.min.apply(null, profile.headerRows),
      rowEnd: Math.max.apply(null, profile.headerRows),
      left: model.bounds.left,
      right: model.bounds.right,
      model: model
    });
    var endMatch = SXHeaderLookup.findColumnByHeaderText(sheet, profile.tableEndHeader, {
      rowStart: Math.min.apply(null, profile.headerRows),
      rowEnd: Math.max.apply(null, profile.headerRows),
      left: model.bounds.left,
      right: model.bounds.right,
      model: model
    });

    if (!startMatch || !endMatch) {
      return null;
    }

    var startCol = startMatch.start;
    var endCol = endMatch.start + endMatch.count - 1;
    var startRow = SXSheetUtils.findFirstHeaderRowInRange(model, startCol, endCol, profile.headerRows);
    var dataStartRow = Math.max.apply(null, profile.headerRows) + 1;
    var endRow = Math.max(
      SXSheetUtils.findLastNonEmptyRowInRange(sheet, startCol, endCol, dataStartRow) || 0,
      Math.max.apply(null, profile.headerRows)
    );

    if (!startRow) {
      return null;
    }

    return {
      startCol: startCol,
      endCol: endCol,
      startRow: startRow,
      dataStartRow: dataStartRow,
      endRow: endRow
    };
  },

  apply150Highlighting: function(sheet, model, tableRange, warningCollector, profile) {
    var dataStartRow = Math.max(tableRange.dataStartRow, model.bounds.top);
    var dataEndRow = Math.min(tableRange.endRow, Math.max(sheet.getLastRow(), tableRange.endRow));
    var highlightCount = 0;

    if (dataStartRow > dataEndRow) {
      return 0;
    }

    for (var headerIndex = 0; headerIndex < profile.highlightHeaders.length; headerIndex += 1) {
      var headerText = profile.highlightHeaders[headerIndex];
      var match = this.findExactHighlightColumnByName_(sheet, model, headerText, profile.headerRows);
      if (!match) {
        continue;
      }

      for (var rowNumber = dataStartRow; rowNumber <= dataEndRow; rowNumber += 1) {
        var cell = sheet.getRange(rowNumber, match.columnNumber);
        var value = cell.getValue();
        var shouldHighlight = this.isValueExactly150_(value);
        var currentBackground = String(cell.getBackground() || '').toLowerCase();
        var currentFontColor = String(cell.getFontColor() || '').toLowerCase();

        if (shouldHighlight) {
          cell.setBackground(SXConfig.HIGHLIGHT_BACKGROUND);
          cell.setFontColor(SXConfig.HIGHLIGHT_FONT_COLOR);
          highlightCount += 1;
          continue;
        }

        if (currentBackground === SXConfig.HIGHLIGHT_BACKGROUND) {
          cell.setBackground(null);
        }

        if (currentFontColor === SXConfig.HIGHLIGHT_FONT_COLOR) {
          cell.setFontColor(null);
        }
      }
    }

    return highlightCount;
  },

  findExactHighlightColumnByName_: function(sheet, model, headerText, headerRows) {
    var sortedRows = headerRows.slice().sort(function(left, right) {
      return right - left;
    });

    for (var index = 0; index < sortedRows.length; index += 1) {
      var rowNumber = sortedRows[index];
      var match = SXHeaderLookup.findColumnByHeaderText(sheet, headerText, {
        rowStart: rowNumber,
        rowEnd: rowNumber,
        left: model.bounds.left,
        right: model.bounds.right,
        model: model
      });

      if (match && match.count === 1) {
        return match;
      }
    }

    var fallback = SXHeaderLookup.findColumnByHeaderText(sheet, headerText, {
      rowStart: Math.min.apply(null, headerRows),
      rowEnd: Math.max.apply(null, headerRows),
      left: model.bounds.left,
      right: model.bounds.right,
      model: model
    });

    return fallback && fallback.count === 1 ? fallback : null;
  },

  isValueExactly150_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return false;
    }

    if (typeof value === 'number') {
      return isFinite(value) && value === 150;
    }

    if (value instanceof Date) {
      return false;
    }

    var normalized = String(value)
      .replace(/,/g, '')
      .trim();

    return /^150(?:\.0+)?$/.test(normalized);
  }
};
