var SXSheetUtils = {
  getFirstSheet: function(spreadsheet) {
    var sheets = spreadsheet.getSheets();
    return sheets.length ? sheets[0] : null;
  },

  getUsedRangeBounds: function(sheet) {
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (!lastRow || !lastColumn) {
      return null;
    }

    var displayValues = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    var mergeRanges = SXMergedRangeUtils.getMergedRanges(sheet);
    var top = Number.POSITIVE_INFINITY;
    var left = Number.POSITIVE_INFINITY;
    var bottom = 0;
    var right = 0;

    for (var rowIndex = 0; rowIndex < displayValues.length; rowIndex += 1) {
      for (var columnIndex = 0; columnIndex < displayValues[rowIndex].length; columnIndex += 1) {
        if (!SXNormalize.normalizeHeaderText(displayValues[rowIndex][columnIndex])) {
          continue;
        }

        top = Math.min(top, rowIndex + 1);
        left = Math.min(left, columnIndex + 1);
        bottom = Math.max(bottom, rowIndex + 1);
        right = Math.max(right, columnIndex + 1);
      }
    }

    for (var mergeIndex = 0; mergeIndex < mergeRanges.length; mergeIndex += 1) {
      var mergeRange = mergeRanges[mergeIndex];
      var masterValue = mergeRange.top <= lastRow && mergeRange.left <= lastColumn
        ? displayValues[mergeRange.top - 1][mergeRange.left - 1]
        : sheet.getRange(mergeRange.top, mergeRange.left).getDisplayValue();

      if (!SXNormalize.normalizeHeaderText(masterValue)) {
        continue;
      }

      top = Math.min(top, mergeRange.top);
      left = Math.min(left, mergeRange.left);
      bottom = Math.max(bottom, mergeRange.bottom);
      right = Math.max(right, mergeRange.right);
    }

    if (!isFinite(top) || !isFinite(left)) {
      return null;
    }

    return {
      top: top,
      left: left,
      bottom: bottom,
      right: right
    };
  },

  buildModel: function(sheet, bounds) {
    var resolvedBounds = bounds || this.getUsedRangeBounds(sheet);
    if (!resolvedBounds) {
      return null;
    }

    var range = sheet.getRange(
      resolvedBounds.top,
      resolvedBounds.left,
      resolvedBounds.bottom - resolvedBounds.top + 1,
      resolvedBounds.right - resolvedBounds.left + 1
    );
    var mergeRanges = SXMergedRangeUtils.getMergedRanges(sheet);

    return {
      sheet: sheet,
      bounds: resolvedBounds,
      displayValues: range.getDisplayValues(),
      values: range.getValues(),
      mergeRanges: mergeRanges,
      mergeIndex: SXMergedRangeUtils.buildMergeIndex(mergeRanges)
    };
  },

  getDisplayValue: function(model, rowNumber, columnNumber) {
    if (!model) {
      return '';
    }

    if (
      rowNumber < model.bounds.top ||
      rowNumber > model.bounds.bottom ||
      columnNumber < model.bounds.left ||
      columnNumber > model.bounds.right
    ) {
      return '';
    }

    return model.displayValues[rowNumber - model.bounds.top][columnNumber - model.bounds.left];
  },

  getResolvedDisplayValue: function(model, rowNumber, columnNumber) {
    if (!model) {
      return '';
    }

    var mergeRange = SXMergedRangeUtils.getMergeRangeAt(model.mergeIndex, rowNumber, columnNumber);
    var anchorRow = mergeRange ? mergeRange.top : rowNumber;
    var anchorColumn = mergeRange ? mergeRange.left : columnNumber;

    return this.getDisplayValue(model, anchorRow, anchorColumn);
  },

  findFirstHeaderRowInRange: function(model, startCol, endCol, headerRows) {
    for (var index = 0; index < headerRows.length; index += 1) {
      var rowNumber = headerRows[index];
      for (var columnNumber = startCol; columnNumber <= endCol; columnNumber += 1) {
        if (this.getResolvedDisplayValue(model, rowNumber, columnNumber)) {
          return rowNumber;
        }
      }
    }

    return null;
  },

  findLastNonEmptyRowInRange: function(sheet, startCol, endCol, startScanRow) {
    var lastRow = sheet.getLastRow();
    if (startScanRow > lastRow) {
      return null;
    }

    var values = sheet
      .getRange(startScanRow, startCol, lastRow - startScanRow + 1, endCol - startCol + 1)
      .getDisplayValues();
    var lastNonEmptyRow = null;

    for (var rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
      if (this.rowHasMeaningfulValue_(values[rowIndex])) {
        lastNonEmptyRow = startScanRow + rowIndex;
      }
    }

    return lastNonEmptyRow;
  },

  rowHasMeaningfulValue_: function(values) {
    for (var index = 0; index < values.length; index += 1) {
      if (SXNormalize.normalizeHeaderText(values[index])) {
        return true;
      }
    }

    return false;
  }
};
