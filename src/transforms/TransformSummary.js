var SXTransformSummary = {
  collectColumnMatches: function(sheet, model, warningCollector, profile) {
    var rowStart = Math.min.apply(null, profile.deletionHeaderRows);
    var rowEnd = Math.max.apply(null, profile.deletionHeaderRows);
    var match = SXHeaderLookup.findColumnByHeaderText(sheet, profile.deletionStartHeader, {
      rowStart: rowStart,
      rowEnd: rowEnd,
      left: model.bounds.left,
      right: model.bounds.right,
      model: model
    });

    if (!match) {
      SXWarnings.add(
        warningCollector,
        'Could not find header "' + profile.deletionStartHeader + '" for column deletion.'
      );
      return [];
    }

    return [
      {
        headerText: profile.deletionStartHeader + ' and columns to the right',
        matchedText: match.matchedText,
        strategy: match.strategy + '-to-right',
        start: match.start,
        count: model.bounds.right - match.start + 1
      }
    ];
  },

  detectFinalTableRange: function(sheet, model, profile) {
    var startCol = model.bounds.left;
    var endCol = model.bounds.right;
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
  }
};
