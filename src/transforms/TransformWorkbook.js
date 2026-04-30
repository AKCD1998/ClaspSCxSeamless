var SXTransformWorkbook = {
  run: function(spreadsheet, variant, warningCollector, logger) {
    var sheet = SXSheetUtils.getFirstSheet(spreadsheet);
    if (!sheet) {
      throw new Error('Workbook must contain at least one worksheet.');
    }

    var usedBounds = SXSheetUtils.getUsedRangeBounds(sheet);
    if (!usedBounds) {
      throw new Error('Workbook must contain at least one populated worksheet cell.');
    }

    var resolvedVariant = variant || SXWorkbookVariant.detect(sheet);
    var profile = SXWorkbookVariant.getProfile(resolvedVariant);
    var deletedColumns = [];
    var highlightCount = 0;

    this.safeStep_(warningCollector, 'apply workbook font settings', function() {
      SXFormatting.applyWorkbookFont(sheet, usedBounds);
    });

    this.safeStep_(warningCollector, 'wrap header rows', function() {
      SXFormatting.wrapHeaderRows(sheet, usedBounds, profile.headerRows);
    });

    var model = SXSheetUtils.buildModel(sheet, usedBounds);
    var columnMatches = resolvedVariant === SXWorkbookVariant.TYPES.SUMMARY
      ? SXTransformSummary.collectColumnMatches(sheet, model, warningCollector, profile)
      : SXTransformIndiv.collectColumnMatches(sheet, model, warningCollector, profile);

    if (columnMatches.length) {
      this.safeStep_(warningCollector, 'delete target columns', function() {
        SXMergedRangeUtils.deleteColumnsPreservingMerges(sheet, columnMatches);
        deletedColumns = SXFormatting.buildDeletedColumnReport(columnMatches);
      });
    }

    usedBounds = SXSheetUtils.getUsedRangeBounds(sheet) || usedBounds;
    if (!usedBounds) {
      return {
        worksheetName: sheet.getName(),
        variant: resolvedVariant,
        deletedColumns: deletedColumns,
        highlightCount: 0
      };
    }

    this.safeStep_(warningCollector, 'reapply workbook font settings', function() {
      SXFormatting.applyWorkbookFont(sheet, usedBounds);
    });

    this.safeStep_(warningCollector, 'rewrap header rows', function() {
      SXFormatting.wrapHeaderRows(sheet, usedBounds, profile.headerRows);
    });

    model = SXSheetUtils.buildModel(sheet, usedBounds);

    var tableRange = resolvedVariant === SXWorkbookVariant.TYPES.SUMMARY
      ? SXTransformSummary.detectFinalTableRange(sheet, model, profile)
      : SXTransformIndiv.detectFinalTableRange(sheet, model, profile);

    if (!tableRange) {
      SXWarnings.add(warningCollector, 'Could not detect the final table range for border styling.');
    }

    var sizingRange = tableRange
      ? {
          top: tableRange.startRow,
          bottom: tableRange.endRow,
          left: tableRange.startCol,
          right: tableRange.endCol
        }
      : usedBounds;

    var columnWidths = null;
    this.safeStep_(warningCollector, 'calculate column widths', function() {
      columnWidths = SXFormatting.calculateColumnWidths(model, sizingRange, {
        headerRows: profile.headerRows,
        fixedColumnWidths: profile.fixedColumnWidths
      });
    });

    if (columnWidths) {
      this.safeStep_(warningCollector, 'fit columns to printable width', function() {
        columnWidths = SXFormatting.fitColumnWidthsToPrintableWidth(columnWidths, sizingRange);
      });

      this.safeStep_(warningCollector, 'apply column widths', function() {
        SXFormatting.applyColumnWidths(sheet, columnWidths);
      });

      this.safeStep_(warningCollector, 'apply row heights', function() {
        SXFormatting.applyRowHeights(sheet, model, columnWidths, {
          headerRows: profile.headerRows,
          fixedRowHeights: profile.fixedRowHeights
        });
      });
    }

    if (tableRange && resolvedVariant === SXWorkbookVariant.TYPES.INDIVIDUAL) {
      this.safeStep_(warningCollector, 'apply borders to the final table range', function() {
        SXFormatting.applyTableBorders(sheet, tableRange);
      });

      highlightCount = this.safeStep_(warningCollector, 'apply 150 highlight styling', function() {
        return SXTransformIndiv.apply150Highlighting(sheet, model, tableRange, warningCollector, profile);
      }) || 0;
    }

    this.safeStep_(warningCollector, 'apply print-preview hints', function() {
      SXFormatting.applyPrintIntent(sheet, profile);
    });
    SpreadsheetApp.flush();
    SXLogger.info(logger, 'worksheet name', sheet.getName());

    return {
      worksheetName: sheet.getName(),
      variant: resolvedVariant,
      deletedColumns: deletedColumns,
      highlightCount: highlightCount
    };
  },

  safeStep_: function(warningCollector, label, operation) {
    try {
      return operation();
    } catch (error) {
      SXWarnings.add(warningCollector, 'Could not ' + label + ': ' + error.message);
      return null;
    }
  }
};
