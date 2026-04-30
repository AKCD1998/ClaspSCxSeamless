var SXBranchCodeMap = {
  MAP: {
    'D1180': '001',
    'D6239': '003',
    'D5811': '004'
  },

  mapBranchSourceToBranchCode: function(rawValue) {
    var normalizedValue = SXNormalize.normalizeDisplayText(rawValue)
      .toUpperCase()
      .replace(/\s+/g, '');

    if (!normalizedValue) {
      return null;
    }

    var matchedCode = normalizedValue.match(/D?\d{4}/);
    var base = matchedCode ? matchedCode[0] : normalizedValue;
    var candidates = base.charAt(0) === 'D' ? [base] : ['D' + base, base];

    for (var index = 0; index < candidates.length; index += 1) {
      if (this.MAP[candidates[index]]) {
        return this.MAP[candidates[index]];
      }
    }

    return null;
  },

  getBranchResultFromHcodeColumn: function(sheet) {
    if (!sheet) {
      return {
        rawBranchSource: '',
        branchCode: null
      };
    }

    var bounds = SXSheetUtils.getUsedRangeBounds(sheet);
    var model = bounds ? SXSheetUtils.buildModel(sheet, bounds) : null;
    var hcodeColumnMatch = SXHeaderLookup.findColumnByHeaderText(sheet, 'HCODE', {
      rowStart: 1,
      rowEnd: Math.min(Math.max(sheet.getLastRow(), 1), 20),
      left: bounds ? bounds.left : 1,
      right: bounds ? bounds.right : Math.max(sheet.getLastColumn(), 1),
      model: model
    });

    if (!hcodeColumnMatch || hcodeColumnMatch.rowNumber >= Math.max(sheet.getLastRow(), 1)) {
      return {
        rawBranchSource: '',
        branchCode: null
      };
    }

    var firstNonEmptyValue = '';
    var values = sheet
      .getRange(
        hcodeColumnMatch.rowNumber + 1,
        hcodeColumnMatch.columnNumber,
        sheet.getLastRow() - hcodeColumnMatch.rowNumber,
        1
      )
      .getDisplayValues();

    for (var index = 0; index < values.length; index += 1) {
      var rawValue = values[index][0];
      var normalizedValue = SXNormalize.normalizeDisplayText(rawValue);

      if (!normalizedValue) {
        continue;
      }

      if (SXNormalize.normalizeHeaderText(rawValue).toUpperCase() === 'HCODE') {
        continue;
      }

      if (!firstNonEmptyValue) {
        firstNonEmptyValue = rawValue;
      }

      var branchCode = this.mapBranchSourceToBranchCode(rawValue);
      if (branchCode) {
        return {
          rawBranchSource: rawValue,
          branchCode: branchCode
        };
      }
    }

    return {
      rawBranchSource: firstNonEmptyValue,
      branchCode: null
    };
  }
};
