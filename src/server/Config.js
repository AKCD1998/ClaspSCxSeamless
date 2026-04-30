var SXConfig = {
  APP_NAME: 'Seamless X GAS Excel Formatter',
  APP_KEY: 'sx-gas-excel-format-v2',
  UPLOAD_FIELD_NAME: 'workbook',
  MAX_UPLOAD_BYTES: 20 * 1024 * 1024,
  MAX_BATCH_FILES: 20,
  OUTPUT_RETENTION_HOURS: 12,
  WORKSPACE_FOLDER_NAME: 'SeamlessXGASExcelFormatV2 Workspace',
  WORKSPACE_FOLDER_PROPERTY_KEY: 'SX_WORKSPACE_FOLDER_ID',
  PROCESSING_REGISTRY_SPREADSHEET_ID: '',
  PROCESSING_REGISTRY_SPREADSHEET_PROPERTY_KEY: 'SX_PROCESSING_REGISTRY_SPREADSHEET_ID',
  PROCESSING_REGISTRY_TITLE: 'SeamlessXGASExcelFormatV2 Processing Registry',
  PROCESSING_REGISTRY_SHEET_NAME: 'ProcessingRegistry',
  PREVIEW_ARCHIVE_FOLDER_ID: '1UtikzyKi8Kg65W6zPz0WYOJ98Xmj7wWx',
  PREVIEW_ARCHIVE_FOLDER_RESOURCE_KEY: '',
  PREVIEW_SPREADSHEET_LOCALE: 'th_TH',
  PREVIEW_SPREADSHEET_TIME_ZONE: 'Asia/Bangkok',
  MIME_TYPES: {
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet'
  },
  TARGET_FONT_NAME: 'AngsanaUPC',
  TARGET_FONT_SIZE: 9,
  BORDER_COLOR: '#000000',
  BORDER_STYLE: SpreadsheetApp.BorderStyle.SOLID,
  HIGHLIGHT_BACKGROUND: '#ffc7ce',
  HIGHLIGHT_FONT_COLOR: '#9c0006',
  TARGET_HEADERS_TO_DELETE: [
    'วันที่ลงทะเบียน',
    'หมายเหตุอื่นๆ (STMID)'
  ],
  HIGHLIGHT_HEADERS: [
    'ราคาต่อหน่วย',
    'ราคาเพดาน',
    'รวมเงินที่ขอเบิก',
    'ชดเชย',
    'ไม่ชดเชย',
    'จ่ายเพิ่ม',
    'เรียกคืน'
  ],
  INDIVIDUAL_HEADER_ROWS: [8, 9, 10],
  SUMMARY_HEADER_ROWS: [5, 6, 7, 8, 9, 10],
  INDIVIDUAL_FIXED_ROW_HEIGHTS: {
    '8': 15,
    '9': 15,
    '10': 15
  },
  INDIVIDUAL_FIXED_COLUMN_WIDTHS: {
    'ลำดับที่': 3,
    'REP No.': 10.22,
    'Trans ID': 10.22,
    'HN': 8,
    'AN': 10.22,
    'VCTID,NAPNumber,PID': 9,
    'ชื่อ-สกุล': 13.78,
    'สิทธิการรักษาพยาบาล': 6,
    'HCODE': 6,
    'วันที่เข้ารักษา/วันที่รับบริการ': 8,
    'รายการประเภทที่ขอเบิก': 15,
    'จำนวน': 3,
    'ราคาต่อหน่วย': 5,
    'ราคาเพดาน': 5,
    'รวมเงินที่ขอเบิก': 6,
    'PS CODE': 3,
    '%': 3,
    'ชดเชย': 6,
    'ไม่ชดเชย': 6,
    'จ่ายเพิ่ม': 6,
    'เรียกคืน': 6
  },
  MIN_COLUMN_WIDTH: 6,
  MAX_COLUMN_WIDTH: 24,
  DATA_COLUMN_MAX_WIDTH: 11,
  HEADER_SINGLE_COLUMN_MAX_WIDTH: 14,
  HEADER_MERGED_COLUMN_MAX_WIDTH: 10,
  PRINT_TARGET_WIDTH_INCHES: 9.6,
  PRINT_PIXEL_DPI: 96,
  PRINT_MIN_COLUMN_WIDTH: 3,
  PRINT_WIDTH_SHRINK_STEP: 0.25,
  BODY_ROW_HEIGHT_RATIO: 1.5,
  HEADER_ROW_HEIGHT_RATIO: 1.75,
  HEADER_ROW_MAX_RATIO: 5.25,
  TARGET_SIDE_PADDING_PX: 2,
  APPROX_EXCEL_CHARACTER_WIDTH_PX: 7
};

SXConfig.TABLE_COLUMN_PADDING =
  (SXConfig.TARGET_SIDE_PADDING_PX * 2) / SXConfig.APPROX_EXCEL_CHARACTER_WIDTH_PX;
SXConfig.PRINT_TARGET_WIDTH_PIXELS =
  SXConfig.PRINT_TARGET_WIDTH_INCHES * SXConfig.PRINT_PIXEL_DPI;
