// Shared display labels/formatters for PharmCare inbox UI. Kept in one module so the inbox table
// (PharmCareInboxView) and the message detail panel (PharmCareMessageDetail) stay consistent.

export const DOCUMENT_TYPE_LABELS = {
  e_credit_invoice: 'E-Credit Invoice',
  settlement_mrr: 'Settlement (MRR)',
  settlement_sfr: 'Settlement (SFR)',
  receipt_link_pending: 'ใบเสร็จ/ใบกำกับภาษี (รอลิงก์)',
  contract: 'สัญญา',
  unknown: 'ไม่ทราบประเภท',
};

export const REVIEW_STATUS_LABELS = {
  auto_classified: 'จัดประเภทอัตโนมัติแล้ว',
  manual_review: 'ต้องตรวจสอบ',
  duplicate: 'ซ้ำ',
  conflict: 'ขัดแย้ง',
};

// Reason codes are written by the backend classifier and ingestion validation (see
// currentSC-official-website-project backend/src/modules/seamless/services/pharmcare/). Unknown
// codes fall back to the raw string so a new backend code stays visible instead of blank.
export const REASON_CODE_LABELS = {
  sender_not_allowlisted: 'ผู้ส่งไม่อยู่ในรายชื่อที่อนุญาต',
  forwarded_block_not_found: 'ไม่พบข้อความส่งต่อ (forwarded block)',
  no_documents_identified: 'ไม่พบเอกสารจากอีเมลนี้',
  filename_pattern_match: 'ชื่อไฟล์ตรงรูปแบบที่รู้จัก',
  civ_number_extracted: 'ดึงเลขเอกสาร CIV จากชื่อไฟล์ได้',
  subject_pattern_match_contract: 'หัวเรื่องตรงรูปแบบสัญญา',
  subject_pattern_match_receipt: 'หัวเรื่องตรงรูปแบบใบเสร็จ',
  subject_pattern_mismatch: 'หัวเรื่องไม่ตรงกับเอกสารที่พบ',
  no_filename_pattern_match: 'ชื่อไฟล์ไม่ตรงรูปแบบที่รู้จัก',
  no_subject_pattern_match: 'หัวเรื่องไม่ตรงรูปแบบที่รู้จัก',
  no_attachment: 'ไม่มีไฟล์แนบ',
  empty_attachment: 'ไฟล์แนบว่าง',
  attachment_too_large: 'ไฟล์แนบใหญ่เกินขีดจำกัด',
  invalid_pdf_signature: 'ไฟล์แนบไม่ใช่ PDF ที่ถูกต้อง',
  declared_mime_type_mismatch: 'ชนิดไฟล์ที่แจ้งไม่ตรงกับเนื้อไฟล์จริง',
  attachment_checksum_duplicate: 'ไฟล์แนบซ้ำกับฉบับก่อน (checksum ตรงกัน)',
  document_number_duplicate: 'เลขเอกสารซ้ำกับฉบับก่อน',
  document_number_conflict: 'เลขเอกสารขัดแย้งกับข้อมูลที่มีอยู่',
};

export function formatReasonCode(code) {
  if (typeof code === 'string' && code.startsWith('report_prefix_')) {
    return `ชื่อไฟล์ตรงรูปแบบรายงาน ${code.slice('report_prefix_'.length).toUpperCase()}`;
  }
  return REASON_CODE_LABELS[code] || code || '-';
}

export function formatReceivedAt(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return value;
  }
}

export function formatPeriod(document) {
  if (!document.periodStart && !document.periodEnd) {
    return '-';
  }

  const half = document.half ? ` (${document.half})` : '';
  return `${document.periodStart || '?'} – ${document.periodEnd || '?'}${half}`;
}

export function formatFileSizeBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  const rounded = unit === 'B' || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}
