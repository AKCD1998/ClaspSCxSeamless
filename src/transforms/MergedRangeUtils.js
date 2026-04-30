var SXMergedRangeUtils = {
  getMergedRanges: function(sheet) {
    if (!sheet.getLastRow() || !sheet.getLastColumn()) {
      return [];
    }

    var ranges = sheet.getDataRange().getMergedRanges();
    var mergeRanges = [];

    for (var index = 0; index < ranges.length; index += 1) {
      var range = ranges[index];
      mergeRanges.push({
        top: range.getRow(),
        left: range.getColumn(),
        bottom: range.getLastRow(),
        right: range.getLastColumn()
      });
    }

    return mergeRanges;
  },

  buildMergeIndex: function(mergeRanges) {
    var index = {};

    for (var rangeIndex = 0; rangeIndex < mergeRanges.length; rangeIndex += 1) {
      var mergeRange = mergeRanges[rangeIndex];
      for (var rowNumber = mergeRange.top; rowNumber <= mergeRange.bottom; rowNumber += 1) {
        for (var columnNumber = mergeRange.left; columnNumber <= mergeRange.right; columnNumber += 1) {
          index[rowNumber + ':' + columnNumber] = mergeRange;
        }
      }
    }

    return index;
  },

  getMergeRangeAt: function(index, rowNumber, columnNumber) {
    return index[rowNumber + ':' + columnNumber] || null;
  },

  deleteColumnsPreservingMerges: function(sheet, columnRanges) {
    if (!columnRanges || !columnRanges.length) {
      return;
    }

    var mergeRanges = this.getMergedRanges(sheet);
    var uniqueAdjustedMerges = {};

    for (var mergeIndex = 0; mergeIndex < mergeRanges.length; mergeIndex += 1) {
      sheet
        .getRange(
          mergeRanges[mergeIndex].top,
          mergeRanges[mergeIndex].left,
          mergeRanges[mergeIndex].bottom - mergeRanges[mergeIndex].top + 1,
          mergeRanges[mergeIndex].right - mergeRanges[mergeIndex].left + 1
        )
        .breakApart();
    }

    var sortedRanges = columnRanges.slice().sort(function(left, right) {
      return right.start - left.start;
    });

    for (var deleteIndex = 0; deleteIndex < sortedRanges.length; deleteIndex += 1) {
      sheet.deleteColumns(sortedRanges[deleteIndex].start, sortedRanges[deleteIndex].count);
    }

    for (mergeIndex = 0; mergeIndex < mergeRanges.length; mergeIndex += 1) {
      var adjustedRange = this.adjustRangeAfterColumnDeletes_(mergeRanges[mergeIndex], sortedRanges);
      if (!adjustedRange || this.isSingleCellRange_(adjustedRange)) {
        continue;
      }

      uniqueAdjustedMerges[SXA1Utils.buildRangeA1(adjustedRange)] = adjustedRange;
    }

    for (var key in uniqueAdjustedMerges) {
      if (!uniqueAdjustedMerges.hasOwnProperty(key)) {
        continue;
      }

      var range = uniqueAdjustedMerges[key];
      sheet
        .getRange(range.top, range.left, range.bottom - range.top + 1, range.right - range.left + 1)
        .merge();
    }
  },

  adjustRangeAfterColumnDeletes_: function(range, columnRanges) {
    var survivingColumns = [];

    for (var columnNumber = range.left; columnNumber <= range.right; columnNumber += 1) {
      if (this.isColumnDeleted_(columnNumber, columnRanges)) {
        continue;
      }

      survivingColumns.push(this.mapColumnAfterDeletes_(columnNumber, columnRanges));
    }

    if (!survivingColumns.length) {
      return null;
    }

    return {
      top: range.top,
      left: survivingColumns[0],
      bottom: range.bottom,
      right: survivingColumns[survivingColumns.length - 1]
    };
  },

  isColumnDeleted_: function(columnNumber, columnRanges) {
    for (var index = 0; index < columnRanges.length; index += 1) {
      var start = columnRanges[index].start;
      var end = start + columnRanges[index].count - 1;
      if (columnNumber >= start && columnNumber <= end) {
        return true;
      }
    }

    return false;
  },

  mapColumnAfterDeletes_: function(columnNumber, columnRanges) {
    var removed = 0;

    for (var index = 0; index < columnRanges.length; index += 1) {
      var start = columnRanges[index].start;
      var end = start + columnRanges[index].count - 1;
      if (end < columnNumber) {
        removed += columnRanges[index].count;
      }
    }

    return columnNumber - removed;
  },

  isSingleCellRange_: function(range) {
    return range.top === range.bottom && range.left === range.right;
  }
};
