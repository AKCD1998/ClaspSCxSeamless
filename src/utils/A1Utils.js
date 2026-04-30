var SXA1Utils = {
  columnNumberToLetters: function(columnNumber) {
    var current = columnNumber;
    var letters = '';

    while (current > 0) {
      var remainder = (current - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      current = Math.floor((current - 1) / 26);
    }

    return letters;
  },

  buildCellA1: function(rowNumber, columnNumber) {
    return this.columnNumberToLetters(columnNumber) + rowNumber;
  },

  buildRangeA1: function(range) {
    return this.buildCellA1(range.top, range.left) + ':' + this.buildCellA1(range.bottom, range.right);
  },

  buildColumnRangeLabel: function(start, count) {
    var end = start + count - 1;
    return count > 1
      ? this.columnNumberToLetters(start) + ':' + this.columnNumberToLetters(end)
      : this.columnNumberToLetters(start);
  }
};
