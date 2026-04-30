var SXFormatting = {
  applyWorkbookFont: function(sheet, bounds) {
    sheet
      .getRange(
        bounds.top,
        bounds.left,
        bounds.bottom - bounds.top + 1,
        bounds.right - bounds.left + 1
      )
      .setFontFamily(SXConfig.TARGET_FONT_NAME)
      .setFontSize(SXConfig.TARGET_FONT_SIZE);
  },

  wrapHeaderRows: function(sheet, bounds, headerRows) {
    for (var index = 0; index < headerRows.length; index += 1) {
      var rowNumber = headerRows[index];
      if (rowNumber < bounds.top || rowNumber > bounds.bottom) {
        continue;
      }

      sheet
        .getRange(rowNumber, bounds.left, 1, bounds.right - bounds.left + 1)
        .setWrap(true)
        .setVerticalAlignment('middle');
    }
  },

  calculateColumnWidths: function(model, scanRange, options) {
    var widths = {};
    var visited = {};
    var mergeIndex = model.mergeIndex;
    var headerRows = options.headerRows || [];
    var fixedColumnWidths = options.fixedColumnWidths || null;
    var rowNumber = 0;

    for (var columnNumber = scanRange.left; columnNumber <= scanRange.right; columnNumber += 1) {
      widths[columnNumber] = SXConfig.MIN_COLUMN_WIDTH;
    }

    for (rowNumber = scanRange.top; rowNumber <= scanRange.bottom; rowNumber += 1) {
      for (columnNumber = scanRange.left; columnNumber <= scanRange.right; columnNumber += 1) {
        var mergeRange = SXMergedRangeUtils.getMergeRangeAt(mergeIndex, rowNumber, columnNumber);
        if (
          mergeRange &&
          (
            mergeRange.right < scanRange.left ||
            mergeRange.left > scanRange.right ||
            mergeRange.bottom < scanRange.top ||
            mergeRange.top > scanRange.bottom
          )
        ) {
          continue;
        }

        var key = mergeRange
          ? [mergeRange.top, mergeRange.left, mergeRange.bottom, mergeRange.right].join(':')
          : rowNumber + ':' + columnNumber;

        if (visited[key]) {
          continue;
        }

        visited[key] = true;

        if (mergeRange && (mergeRange.top !== rowNumber || mergeRange.left !== columnNumber)) {
          continue;
        }

        var text = SXSheetUtils.getResolvedDisplayValue(model, rowNumber, columnNumber);
        if (!text) {
          continue;
        }

        var startColumn = mergeRange ? Math.max(mergeRange.left, scanRange.left) : columnNumber;
        var endColumn = mergeRange ? Math.min(mergeRange.right, scanRange.right) : columnNumber;
        var span = endColumn - startColumn + 1;
        var sizingProfile = this.getSizingProfile_(rowNumber, mergeRange, headerRows);
        var estimatedWidth = this.estimateColumnWidth_(text, {
          min: SXConfig.MIN_COLUMN_WIDTH,
          max: sizingProfile.maxPerColumn * span,
          padding: SXConfig.TABLE_COLUMN_PADDING
        });
        var widthPerColumn = this.clampWidth_(
          Math.min(sizingProfile.maxPerColumn, estimatedWidth / span)
        );

        for (var currentColumn = startColumn; currentColumn <= endColumn; currentColumn += 1) {
          widths[currentColumn] = Math.max(widths[currentColumn] || SXConfig.MIN_COLUMN_WIDTH, widthPerColumn);
        }
      }
    }

    this.applyFixedColumnWidths_(model, scanRange, widths, {
      headerRows: headerRows,
      fixedColumnWidths: fixedColumnWidths
    });

    return widths;
  },

  applyColumnWidths: function(sheet, widthMap) {
    for (var key in widthMap) {
      if (!widthMap.hasOwnProperty(key)) {
        continue;
      }

      sheet.setColumnWidth(Number(key), this.getColumnWidthPixels_(widthMap[key]));
    }
  },

  fitColumnWidthsToPrintableWidth: function(widthMap, scanRange) {
    if (!widthMap || !scanRange) {
      return widthMap;
    }

    var totalWidthPixels = this.getRangeWidthPixels_(widthMap, scanRange.left, scanRange.right);
    var targetWidthPixels = SXConfig.PRINT_TARGET_WIDTH_PIXELS;

    if (!totalWidthPixels || totalWidthPixels <= targetWidthPixels) {
      return widthMap;
    }

    var scale = targetWidthPixels / totalWidthPixels;
    var fittedWidths = {};

    for (var columnNumber = scanRange.left; columnNumber <= scanRange.right; columnNumber += 1) {
      var currentWidth = widthMap[columnNumber] || SXConfig.MIN_COLUMN_WIDTH;
      fittedWidths[columnNumber] = this.roundWidth_(
        Math.max(SXConfig.PRINT_MIN_COLUMN_WIDTH, currentWidth * scale)
      );
    }

    this.squeezeWidthMap_(
      fittedWidths,
      scanRange.left,
      scanRange.right,
      targetWidthPixels
    );

    return fittedWidths;
  },

  applyRowHeights: function(sheet, model, columnWidths, options) {
    var requiredHeights = this.calculateRequiredRowHeights_(model, columnWidths, options);
    var fixedRowHeights = options.fixedRowHeights || {};
    var bounds = model.bounds;

    for (var rowNumber = bounds.top; rowNumber <= bounds.bottom; rowNumber += 1) {
      var fixedHeight = fixedRowHeights[String(rowNumber)];
      var heightInPoints = fixedHeight || requiredHeights[rowNumber] || this.getBaseRowHeight_(rowNumber, options.headerRows);
      sheet.setRowHeight(rowNumber, this.pointsToPixels_(heightInPoints));
    }
  },

  applyTableBorders: function(sheet, tableRange) {
    sheet
      .getRange(
        tableRange.startRow,
        tableRange.startCol,
        tableRange.endRow - tableRange.startRow + 1,
        tableRange.endCol - tableRange.startCol + 1
      )
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        SXConfig.BORDER_COLOR,
        SXConfig.BORDER_STYLE
      );
  },

  applyPrintIntent: function(sheet, profile) {
    if (!sheet || !profile) {
      return;
    }

    if (profile.printRepeatRowCount) {
      sheet.setFrozenRows(profile.printRepeatRowCount);
    }

    // SpreadsheetApp does not expose Excel-like page setup such as A4,
    // fit-to-width, or repeat title rows. Freezing the report/header rows is the
    // closest reliable Sheets-side hint for print preview flows.
  },

  buildDeletedColumnReport: function(columnMatches) {
    var report = [];

    for (var index = 0; index < columnMatches.length; index += 1) {
      var match = columnMatches[index];
      report.push({
        headerText: match.headerText,
        matchedText: match.matchedText,
        strategy: match.strategy,
        start: match.start,
        count: match.count,
        columnLabel: SXA1Utils.buildColumnRangeLabel(match.start, match.count)
      });
    }

    return report;
  },

  calculateRequiredRowHeights_: function(model, columnWidths, options) {
    var bounds = model.bounds;
    var mergeIndex = model.mergeIndex;
    var headerRows = options.headerRows || [];
    var fixedRowHeights = options.fixedRowHeights || {};
    var requiredHeights = {};
    var visited = {};
    var rowNumber = 0;

    for (rowNumber = bounds.top; rowNumber <= bounds.bottom; rowNumber += 1) {
      requiredHeights[rowNumber] = fixedRowHeights[String(rowNumber)] || this.getBaseRowHeight_(rowNumber, headerRows);
    }

    for (rowNumber = bounds.top; rowNumber <= bounds.bottom; rowNumber += 1) {
      for (var columnNumber = bounds.left; columnNumber <= bounds.right; columnNumber += 1) {
        var mergeRange = SXMergedRangeUtils.getMergeRangeAt(mergeIndex, rowNumber, columnNumber);
        var key = mergeRange
          ? [mergeRange.top, mergeRange.left, mergeRange.bottom, mergeRange.right].join(':')
          : rowNumber + ':' + columnNumber;

        if (visited[key]) {
          continue;
        }

        visited[key] = true;

        if (mergeRange && (mergeRange.top !== rowNumber || mergeRange.left !== columnNumber)) {
          continue;
        }

        var text = SXSheetUtils.getResolvedDisplayValue(model, rowNumber, columnNumber);
        if (!text) {
          continue;
        }

        var wrapText = this.isHeaderRow_(rowNumber, headerRows);
        var effectiveWidth = this.getEffectiveCellWidth_(columnWidths, mergeRange, columnNumber);
        var lineCount = wrapText
          ? this.estimateWrappedLineCount_(text, effectiveWidth)
          : this.estimateExplicitLineCount_(text);
        var spanRows = mergeRange ? mergeRange.bottom - mergeRange.top + 1 : 1;
        var rowBaseHeight = this.getBaseRowHeight_(rowNumber, headerRows);
        var perRowHeight = this.capRowHeight_(
          rowNumber,
          (rowBaseHeight * lineCount) / spanRows,
          headerRows
        );
        var targetStartRow = mergeRange ? mergeRange.top : rowNumber;
        var targetEndRow = mergeRange ? mergeRange.bottom : rowNumber;

        for (var currentRow = targetStartRow; currentRow <= targetEndRow; currentRow += 1) {
          requiredHeights[currentRow] = Math.max(
            requiredHeights[currentRow] || this.getBaseRowHeight_(currentRow, headerRows),
            perRowHeight
          );
        }
      }
    }

    return requiredHeights;
  },

  applyFixedColumnWidths_: function(model, scanRange, widths, options) {
    var fixedColumnWidths = options.fixedColumnWidths;
    var headerRows = options.headerRows || [];
    if (!fixedColumnWidths) {
      return;
    }

    for (var index = 0; index < headerRows.length; index += 1) {
      var rowNumber = headerRows[index];
      if (rowNumber < scanRange.top || rowNumber > scanRange.bottom) {
        continue;
      }

      for (var columnNumber = scanRange.left; columnNumber <= scanRange.right; columnNumber += 1) {
        var mergeRange = SXMergedRangeUtils.getMergeRangeAt(model.mergeIndex, rowNumber, columnNumber);
        if (mergeRange && (mergeRange.top !== rowNumber || mergeRange.left !== columnNumber)) {
          continue;
        }

        var span = mergeRange ? mergeRange.right - mergeRange.left + 1 : 1;
        if (span !== 1) {
          continue;
        }

        var headerText = SXNormalize.normalizeHeaderText(
          SXSheetUtils.getResolvedDisplayValue(model, rowNumber, columnNumber)
        );
        if (!headerText || typeof fixedColumnWidths[headerText] === 'undefined') {
          continue;
        }

        widths[columnNumber] = fixedColumnWidths[headerText];
      }
    }
  },

  getSizingProfile_: function(rowNumber, mergeRange, headerRows) {
    if (this.isHeaderRow_(rowNumber, headerRows)) {
      if (mergeRange && mergeRange.right > mergeRange.left) {
        return {
          maxPerColumn: SXConfig.HEADER_MERGED_COLUMN_MAX_WIDTH
        };
      }

      return {
        maxPerColumn: SXConfig.HEADER_SINGLE_COLUMN_MAX_WIDTH
      };
    }

    return {
      maxPerColumn: SXConfig.DATA_COLUMN_MAX_WIDTH
    };
  },

  estimateColumnWidth_: function(text, options) {
    var normalized = SXNormalize.normalizeDisplayText(text);
    var lines = normalized ? normalized.split('\n') : [''];
    var widest = 0;

    for (var index = 0; index < lines.length; index += 1) {
      widest = Math.max(widest, SXNormalize.estimateLineWidth(lines[index]));
    }

    var width = widest + (options.padding || 0);
    return Math.max(options.min || 1, Math.min(options.max || 80, this.roundWidth_(width)));
  },

  estimateWrappedLineCount_: function(text, availableWidth) {
    var normalized = String(text || '');
    if (!normalized) {
      return 1;
    }

    var safeWidth = Math.max(1, Math.floor(availableWidth));
    var totalLines = 0;
    var lines = normalized.split('\n');

    for (var index = 0; index < lines.length; index += 1) {
      var lineLength = SXNormalize.estimateLineWidth(lines[index] || ' ') || 1;
      totalLines += Math.max(1, Math.ceil(lineLength / safeWidth));
    }

    return totalLines;
  },

  estimateExplicitLineCount_: function(text) {
    var normalized = String(text || '');
    if (!normalized) {
      return 1;
    }

    return normalized.split('\n').length;
  },

  getEffectiveCellWidth_: function(columnWidths, mergeRange, columnNumber) {
    if (!mergeRange) {
      return columnWidths[columnNumber] || SXConfig.MIN_COLUMN_WIDTH;
    }

    var total = 0;
    for (var currentColumn = mergeRange.left; currentColumn <= mergeRange.right; currentColumn += 1) {
      total += columnWidths[currentColumn] || SXConfig.MIN_COLUMN_WIDTH;
    }

    return Math.max(total, SXConfig.MIN_COLUMN_WIDTH);
  },

  getBaseRowHeight_: function(rowNumber, headerRows) {
    var ratio = this.isHeaderRow_(rowNumber, headerRows)
      ? SXConfig.HEADER_ROW_HEIGHT_RATIO
      : SXConfig.BODY_ROW_HEIGHT_RATIO;

    return this.roundWidth_(SXConfig.TARGET_FONT_SIZE * ratio);
  },

  capRowHeight_: function(rowNumber, height, headerRows) {
    if (this.isHeaderRow_(rowNumber, headerRows)) {
      return Math.min(
        Math.max(height, this.getBaseRowHeight_(rowNumber, headerRows)),
        this.roundWidth_(SXConfig.TARGET_FONT_SIZE * SXConfig.HEADER_ROW_MAX_RATIO)
      );
    }

    return Math.max(height, this.getBaseRowHeight_(rowNumber, headerRows));
  },

  getColumnWidthPixels_: function(width) {
    return Math.trunc(((256 * width + Math.trunc(128 / 7)) / 256) * 7);
  },

  getRangeWidthPixels_: function(widthMap, left, right) {
    var total = 0;

    for (var columnNumber = left; columnNumber <= right; columnNumber += 1) {
      total += this.getColumnWidthPixels_(widthMap[columnNumber] || SXConfig.MIN_COLUMN_WIDTH);
    }

    return total;
  },

  pointsToPixels_: function(points) {
    return Math.max(18, Math.round(points * 1.333));
  },

  isHeaderRow_: function(rowNumber, headerRows) {
    return headerRows.indexOf(rowNumber) !== -1;
  },

  clampWidth_: function(width) {
    return this.roundWidth_(
      Math.max(SXConfig.MIN_COLUMN_WIDTH, Math.min(SXConfig.MAX_COLUMN_WIDTH, width))
    );
  },

  squeezeWidthMap_: function(widthMap, left, right, targetWidthPixels) {
    var guard = 0;

    while (
      this.getRangeWidthPixels_(widthMap, left, right) > targetWidthPixels &&
      guard < 2000
    ) {
      var widestColumn = this.findWidestReducibleColumn_(widthMap, left, right);
      if (!widestColumn) {
        break;
      }

      widthMap[widestColumn] = this.roundWidth_(
        Math.max(
          SXConfig.PRINT_MIN_COLUMN_WIDTH,
          widthMap[widestColumn] - SXConfig.PRINT_WIDTH_SHRINK_STEP
        )
      );
      guard += 1;
    }
  },

  findWidestReducibleColumn_: function(widthMap, left, right) {
    var widestColumn = 0;
    var widestWidth = SXConfig.PRINT_MIN_COLUMN_WIDTH;

    for (var columnNumber = left; columnNumber <= right; columnNumber += 1) {
      var currentWidth = widthMap[columnNumber] || SXConfig.MIN_COLUMN_WIDTH;
      if (currentWidth <= SXConfig.PRINT_MIN_COLUMN_WIDTH) {
        continue;
      }

      if (currentWidth > widestWidth) {
        widestWidth = currentWidth;
        widestColumn = columnNumber;
      }
    }

    return widestColumn;
  },

  roundWidth_: function(width) {
    return Math.round(width * 100) / 100;
  }
};
