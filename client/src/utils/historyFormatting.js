export function normalizeBranchCodeList(value) {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => String(item || '').split(/[,;\s]+/))
    : String(value || '').split(/[,;\s]+/);
  const seen = new Set();
  const branchCodes = [];

  rawValues.forEach((rawValue) => {
    const branchCode = String(rawValue || '').trim();

    if (!/^\d{3}$/.test(branchCode) || seen.has(branchCode)) {
      return;
    }

    seen.add(branchCode);
    branchCodes.push(branchCode);
  });

  return branchCodes.sort(compareBranchCodes);
}

export function compareBranchCodes(left, right) {
  return Number(left) - Number(right) || String(left).localeCompare(String(right));
}

export function formatReportType(value) {
  const text = String(value || '').trim();

  if (text === 'summary') {
    return 'สรุปจำนวนการชดชยทั้งหมดในรอบนั้นๆ(Summary)';
  }

  if (text === 'individual') {
    return 'แจกแจงการชดเชยรายคน(Individual)';
  }

  if (text === 'shopee') {
    return 'รายงานคำสั่งซื้อ Shopee';
  }

  return text || '-';
}

export function getHistoryDisplayFilename(record) {
  if (record?.reportType === 'shopee' && record?.metadata?.outputFilename) {
    return record.metadata.outputFilename;
  }

  return record?.filename || '';
}

export function getHistoryDocumentUrl(record) {
  if (record?.reportType === 'shopee' && record?.metadata?.outputDownloadUrl) {
    return record.metadata.outputDownloadUrl;
  }

  return record?.driveFileUrl || '';
}

export function formatPrintedStatus(value) {
  return value ? 'ปริ้นท์ส่งพี่เอแล้ว' : 'ยังไม่ได้ปริ้นท์ส่งพี่เอ';
}

export function formatHistoryDate(value) {
  const text = String(value || '').trim();

  if (!/^\d{8}$/.test(text)) {
    return text || '-';
  }

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

export function formatHistoryTimestamp(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '-';
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime()) ? text : parsed.toLocaleString();
}

export function groupRecordsByReportDate(records) {
  const groupMap = new Map();

  records.forEach((record) => {
    const groupKey = String(record.reportDate || '').trim() || 'ไม่ทราบวันที่';
    const group = groupMap.get(groupKey) || {
      reportDate: groupKey,
      records: [],
    };

    group.records.push(record);
    groupMap.set(groupKey, group);
  });

  return Array.from(groupMap.keys())
    .sort(compareHistoryGroupKeys)
    .map((groupKey) => buildHistoryGroupSummary(groupMap.get(groupKey)));
}

function compareHistoryGroupKeys(leftKey, rightKey) {
  const leftIsKnownDate = /^\d{8}$/.test(leftKey);
  const rightIsKnownDate = /^\d{8}$/.test(rightKey);

  if (leftIsKnownDate && rightIsKnownDate) {
    return rightKey.localeCompare(leftKey);
  }

  if (leftIsKnownDate) {
    return -1;
  }

  if (rightIsKnownDate) {
    return 1;
  }

  return rightKey.localeCompare(leftKey);
}

function buildHistoryGroupSummary(group) {
  let hasSummary = false;
  let hasIndividual = false;
  let printedCount = 0;
  const branchCodeSet = new Set();

  group.records.forEach((record) => {
    if (record.reportType === 'summary') {
      hasSummary = true;
    }

    if (record.reportType === 'individual') {
      hasIndividual = true;
    }

    if (record.printed) {
      printedCount += 1;
    }

    normalizeBranchCodeList(record.branchCodes || record.branchCode).forEach((branchCode) => {
      branchCodeSet.add(branchCode);
    });
  });

  const branchCodes = Array.from(branchCodeSet).sort(compareBranchCodes);

  return {
    reportDate: group.reportDate,
    records: group.records.slice(),
    branchCodes,
    hasSummary,
    hasIndividual,
    printedCount,
    notPrintedCount: group.records.length - printedCount,
  };
}
