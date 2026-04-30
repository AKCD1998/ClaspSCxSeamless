var SXFilenameBuilder = {
  buildOutputFilename: function(sheet, originalFilename, variant) {
    var resolvedVariant = variant || SXWorkbookVariant.detect(sheet);

    if (resolvedVariant === SXWorkbookVariant.TYPES.SUMMARY) {
      return this.buildSummaryOutputFilename_(sheet, originalFilename);
    }

    return this.buildIndividualOutputFilename_(sheet, originalFilename);
  },

  buildIndividualOutputFilename_: function(sheet, originalFilename) {
    var warnings = [];
    var rawDateSource = sheet.getRange('C5').getDisplayValue();
    var parsedDate = SXThaiDateParser.parseThaiBuddhistDate(rawDateSource);
    var dateSourceLabel = 'C5 date';

    if (!parsedDate) {
      var scannedDate = this.scanIndividualDateFallback_(sheet);
      if (scannedDate) {
        rawDateSource = scannedDate.rawDateSource;
        parsedDate = scannedDate.formattedDate;
        dateSourceLabel = scannedDate.sourceLabel;
      }
    }

    var branchResult = SXBranchCodeMap.getBranchResultFromHcodeColumn(sheet);

    if (parsedDate && branchResult.branchCode) {
      return {
        variant: SXWorkbookVariant.TYPES.INDIVIDUAL,
        filename: parsedDate + '-' + branchResult.branchCode + '-02 indiv exp.xlsx',
        warnings: warnings,
        parsedDate: parsedDate,
        branchCode: branchResult.branchCode,
        rawDateSource: rawDateSource,
        rawBranchSource: branchResult.rawBranchSource,
        dateSourceLabel: dateSourceLabel,
        branchSourceLabel: 'HCODE branch source'
      };
    }

    if (!parsedDate) {
      warnings.push('Could not parse the indiv report date for the output filename. Used a fallback filename.');
    }

    if (!branchResult.branchCode) {
      warnings.push('Could not parse the HCODE branch code for the output filename. Used a fallback filename.');
    }

    return {
      variant: SXWorkbookVariant.TYPES.INDIVIDUAL,
      filename: this.buildFallbackOutputFilename_(originalFilename),
      warnings: warnings,
      parsedDate: parsedDate,
      branchCode: branchResult.branchCode,
      rawDateSource: rawDateSource,
      rawBranchSource: branchResult.rawBranchSource,
      dateSourceLabel: dateSourceLabel,
      branchSourceLabel: 'HCODE branch source'
    };
  },

  buildSummaryOutputFilename_: function(sheet, originalFilename) {
    var warnings = [];
    var metadata = this.getSummaryFilenameMetadata_(sheet);

    if (metadata.formattedDate && metadata.branchCode) {
      return {
        variant: SXWorkbookVariant.TYPES.SUMMARY,
        filename: metadata.formattedDate + '-' + metadata.branchCode + '-02 sum exp.xlsx',
        warnings: warnings,
        parsedDate: metadata.formattedDate,
        branchCode: metadata.branchCode,
        rawDateSource: metadata.rawDateSource,
        rawBranchSource: metadata.rawBranchSource,
        dateSourceLabel: metadata.dateSourceLabel,
        branchSourceLabel: metadata.branchSourceLabel
      };
    }

    if (!metadata.formattedDate) {
      warnings.push('Could not parse the summary report date for the output filename. Used a fallback filename.');
    }

    if (!metadata.branchCode) {
      warnings.push('Could not parse the summary branch code for the output filename. Used a fallback filename.');
    }

    return {
      variant: SXWorkbookVariant.TYPES.SUMMARY,
      filename: this.buildFallbackOutputFilename_(originalFilename),
      warnings: warnings,
      parsedDate: metadata.formattedDate,
      branchCode: metadata.branchCode,
      rawDateSource: metadata.rawDateSource,
      rawBranchSource: metadata.rawBranchSource,
      dateSourceLabel: metadata.dateSourceLabel,
      branchSourceLabel: metadata.branchSourceLabel
    };
  },

  getSummaryFilenameMetadata_: function(sheet) {
    var fixedDateSource = sheet.getRange('C3').getDisplayValue();
    var fixedBranchSource = sheet.getRange('C11').getDisplayValue();
    var fixedFormattedDate = SXThaiDateParser.parseSummaryRepDate(fixedDateSource);
    var fixedBranchCode = SXBranchCodeMap.mapBranchSourceToBranchCode(fixedBranchSource);

    if (fixedFormattedDate && fixedBranchCode) {
      return {
        rawDateSource: fixedDateSource,
        formattedDate: fixedFormattedDate,
        rawBranchSource: fixedBranchSource,
        branchCode: fixedBranchCode,
        dateSourceLabel: 'C3 report date',
        branchSourceLabel: 'C11 unit branch source'
      };
    }

    var bounds = SXSheetUtils.getUsedRangeBounds(sheet);
    var model = bounds ? SXSheetUtils.buildModel(sheet, bounds) : null;
    var branchColumnMatch = SXHeaderLookup.findColumnByHeaderText(sheet, 'รหัสหน่วยบริการ', {
      rowStart: 5,
      rowEnd: 10,
      left: 1,
      right: bounds ? bounds.right : Math.max(sheet.getLastColumn(), 1),
      model: model
    });
    var repDateColumnMatch = SXHeaderLookup.findColumnByHeaderText(sheet, 'REP Date', {
      rowStart: 5,
      rowEnd: 10,
      left: 1,
      right: bounds ? bounds.right : Math.max(sheet.getLastColumn(), 1),
      model: model
    });
    var dataStartRow = 11;
    var lastRow = Math.max(sheet.getLastRow(), dataStartRow);
    var firstBranchSource = '';
    var firstDateSource = '';

    for (var rowNumber = dataStartRow; rowNumber <= lastRow; rowNumber += 1) {
      var rawBranchSource = branchColumnMatch
        ? sheet.getRange(rowNumber, branchColumnMatch.columnNumber).getDisplayValue()
        : '';
      var rawDateSource = repDateColumnMatch
        ? sheet.getRange(rowNumber, repDateColumnMatch.columnNumber).getDisplayValue()
        : '';
      var normalizedBranch = SXNormalize.normalizeDisplayText(rawBranchSource);
      var normalizedDate = SXNormalize.normalizeDisplayText(rawDateSource);

      if (!firstBranchSource && normalizedBranch && normalizedBranch !== 'รวม') {
        firstBranchSource = rawBranchSource;
      }

      if (!firstDateSource && normalizedDate && normalizedDate !== 'รวม') {
        firstDateSource = rawDateSource;
      }

      if (!normalizedBranch || normalizedBranch === 'รวม') {
        continue;
      }

      var branchCode = SXBranchCodeMap.mapBranchSourceToBranchCode(rawBranchSource);
      var formattedDate = SXThaiDateParser.parseSummaryRepDate(rawDateSource);
      if (branchCode && formattedDate) {
        return {
          rawDateSource: rawDateSource,
          formattedDate: formattedDate,
          rawBranchSource: rawBranchSource,
          branchCode: branchCode,
          dateSourceLabel: 'summary fallback REP Date scan',
          branchSourceLabel: 'summary fallback branch scan'
        };
      }
    }

    return {
      rawDateSource: fixedDateSource || firstDateSource,
      formattedDate: fixedFormattedDate || SXThaiDateParser.parseSummaryRepDate(firstDateSource),
      rawBranchSource: fixedBranchSource || firstBranchSource,
      branchCode: fixedBranchCode || SXBranchCodeMap.mapBranchSourceToBranchCode(firstBranchSource),
      dateSourceLabel: fixedDateSource ? 'C3 report date' : 'summary fallback REP Date scan',
      branchSourceLabel: fixedBranchSource ? 'C11 unit branch source' : 'summary fallback branch scan'
    };
  },

  scanIndividualDateFallback_: function(sheet) {
    var bounds = SXSheetUtils.getUsedRangeBounds(sheet);
    if (!bounds) {
      return null;
    }

    var scanBottom = Math.min(bounds.bottom, 10);
    var scanRight = Math.min(bounds.right, 6);
    if (scanBottom < 1 || scanRight < 1) {
      return null;
    }

    var displayValues = sheet.getRange(1, 1, scanBottom, scanRight).getDisplayValues();
    for (var rowIndex = 0; rowIndex < displayValues.length; rowIndex += 1) {
      for (var columnIndex = 0; columnIndex < displayValues[rowIndex].length; columnIndex += 1) {
        var rawValue = displayValues[rowIndex][columnIndex];
        var formattedDate = SXThaiDateParser.parseThaiBuddhistDate(rawValue);
        if (!formattedDate) {
          continue;
        }

        return {
          rawDateSource: rawValue,
          formattedDate: formattedDate,
          sourceLabel: 'top metadata scan'
        };
      }
    }

    return null;
  },

  buildFallbackOutputFilename_: function(originalFilename) {
    var baseName = SXNormalize.sanitizeBaseName(originalFilename);
    return baseName + '-processed.xlsx';
  }
};
