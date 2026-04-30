var SXThaiDateParser = {
  THAI_MONTH_TO_NUMBER: {
    'มกราคม': '01',
    'มค': '01',
    'กุมภาพันธ์': '02',
    'กพ': '02',
    'มีนาคม': '03',
    'มีค': '03',
    'เมษายน': '04',
    'เมย': '04',
    'พฤษภาคม': '05',
    'พค': '05',
    'มิถุนายน': '06',
    'มิย': '06',
    'กรกฎาคม': '07',
    'กค': '07',
    'สิงหาคม': '08',
    'สค': '08',
    'กันยายน': '09',
    'กย': '09',
    'ตุลาคม': '10',
    'ตค': '10',
    'พฤศจิกายน': '11',
    'พย': '11',
    'ธันวาคม': '12',
    'ธค': '12'
  },

  parseThaiBuddhistDate: function(rawValue) {
    var normalizedValue = SXNormalize.normalizeDisplayText(rawValue);
    if (!normalizedValue) {
      return null;
    }

    var match = normalizedValue.match(/(\d{4})\s*[/\-]?\s*([^\d]+?)\s*(\d{1,2})\s*$/u);
    if (!match) {
      return null;
    }

    var buddhistOrGregorianYear = Number(match[1]);
    var monthNumber = this.THAI_MONTH_TO_NUMBER[this.normalizeMonthToken_(match[2])];
    var day = Number(match[3]);
    var gregorianYear = this.convertToGregorianYear_(buddhistOrGregorianYear);

    if (!monthNumber || !gregorianYear || !this.isValidDateParts_(gregorianYear, monthNumber, day)) {
      return null;
    }

    return gregorianYear + '-' + monthNumber + '-' + this.pad2_(day);
  },

  parseSummaryRepDate: function(rawValue) {
    var normalizedValue = SXNormalize.normalizeDisplayText(rawValue);
    if (!normalizedValue) {
      return null;
    }

    var match = normalizedValue.match(
      /^(\d{1,2})\s*[/\-]\s*(\d{1,2})\s*[/\-]\s*(\d{4})(?:\s+เวลา\s+\d{1,2}:\d{2})?$/u
    );

    if (!match) {
      return null;
    }

    var day = Number(match[1]);
    var month = Number(match[2]);
    var year = this.convertToGregorianYear_(Number(match[3]));

    if (!year || !this.isValidDateParts_(year, this.pad2_(month), day)) {
      return null;
    }

    return year + '-' + this.pad2_(month) + '-' + this.pad2_(day);
  },

  convertToGregorianYear_: function(year) {
    if (Math.floor(year) !== year) {
      return null;
    }

    if (year >= 2400 && year <= 3000) {
      return year - 543;
    }

    if (year >= 1900 && year <= 2200) {
      return year;
    }

    return null;
  },

  isValidDateParts_: function(year, monthNumber, day) {
    if (Math.floor(day) !== day || day < 1 || day > 31) {
      return false;
    }

    var candidate = new Date(Date.UTC(year, Number(monthNumber) - 1, day));

    return (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === Number(monthNumber) - 1 &&
      candidate.getUTCDate() === day
    );
  },

  normalizeMonthToken_: function(monthToken) {
    return SXNormalize.normalizeDisplayText(monthToken).replace(/[./\s]/g, '');
  },

  pad2_: function(value) {
    return ('0' + String(value)).slice(-2);
  }
};
