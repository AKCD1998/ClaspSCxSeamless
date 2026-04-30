var SXWorkbookVariant = {
  TYPES: {
    INDIVIDUAL: 'individual',
    SUMMARY: 'summary'
  },

  parseRequestedVariant: function(value) {
    var normalizedValue = SXNormalize.normalizeHeaderText(value).toLowerCase();

    if (!normalizedValue) {
      return null;
    }

    if (normalizedValue === 'individual' || normalizedValue === 'indiv') {
      return this.TYPES.INDIVIDUAL;
    }

    if (normalizedValue === 'summary' || normalizedValue === 'sum') {
      return this.TYPES.SUMMARY;
    }

    return null;
  },

  detect: function(sheet, model) {
    if (!sheet) {
      return this.TYPES.INDIVIDUAL;
    }

    var normalizedSheetName = SXNormalize.normalizeHeaderText(sheet.getName()).toLowerCase();
    if (normalizedSheetName === 'summary' || normalizedSheetName === 'sum') {
      return this.TYPES.SUMMARY;
    }

    var bounds = (model && model.bounds) || SXSheetUtils.getUsedRangeBounds(sheet);
    var right = bounds ? bounds.right : Math.max(sheet.getLastColumn(), 1);
    var atkMatch = SXHeaderLookup.findColumnByHeaderText(sheet, 'ATK', {
      rowStart: 5,
      rowEnd: 5,
      left: 1,
      right: right,
      model: model
    });

    return atkMatch ? this.TYPES.SUMMARY : this.TYPES.INDIVIDUAL;
  },

  getProfile: function(variant) {
    if (variant === this.TYPES.SUMMARY) {
      return {
        variant: this.TYPES.SUMMARY,
        headerRows: SXConfig.SUMMARY_HEADER_ROWS.slice(),
        headerRowStart: 5,
        headerRowEnd: 10,
        deletionMode: 'fromHeaderToRight',
        deletionStartHeader: 'ATK',
        deletionHeaderRows: [5],
        tableRangeMode: 'headerRowsToUsedRange',
        highlightHeaders: [],
        fixedColumnWidths: null,
        fixedRowHeights: null,
        printRepeatRowCount: 10,
        tableStartHeader: null,
        tableEndHeader: null
      };
    }

    return {
      variant: this.TYPES.INDIVIDUAL,
      headerRows: SXConfig.INDIVIDUAL_HEADER_ROWS.slice(),
      headerRowStart: 1,
      headerRowEnd: 10,
      deletionMode: 'headers',
      deletionHeaders: SXConfig.TARGET_HEADERS_TO_DELETE.slice(),
      tableRangeMode: 'betweenHeaders',
      tableStartHeader: 'ลำดับที่',
      tableEndHeader: 'หมายเหตุ',
      highlightHeaders: SXConfig.HIGHLIGHT_HEADERS.slice(),
      fixedColumnWidths: SXConfig.INDIVIDUAL_FIXED_COLUMN_WIDTHS,
      fixedRowHeights: SXConfig.INDIVIDUAL_FIXED_ROW_HEIGHTS,
      printRepeatRowCount: 10
    };
  }
};
