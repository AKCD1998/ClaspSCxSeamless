import { useState } from 'react';
import {
  confirmAdaSmartDryRunQueue,
  createAdaSmartValidationPreview,
} from '../services/api.js';
import './adasmart-validation-preview.css';

const BLOCK_REASON_LABELS = {
  barcode_ambiguous: 'มีหลาย barcode หรือ barcode ซ้ำข้ามสินค้า',
  barcode_missing: 'ไม่พบ barcode ที่ใช้ได้',
  bundle_requires_validation: 'กติกาจำนวนสินค้า bundle ยังไม่ผ่านการยืนยัน',
  customer_policy_missing: 'ยังไม่มีนโยบายรหัสลูกค้าที่อนุมัติสำหรับสาขา 004',
  cycle_not_eligible: 'รอบบัญชียังไม่ผ่าน checkpoint/revision gate',
  duplicate_effect: 'มีผลลัพธ์ใบเสนอราคาสำหรับ order นี้แล้ว',
  excel_catalog_sku_conflict: 'Company SKU ใน Excel ขัดกับ catalog ที่อนุมัติ',
  timeline_line_mismatch: 'รายการใน Order.all ไม่ตรงกับ Timeline',
  timeline_order_missing: 'ไม่พบ order ใน Timeline',
  unmapped_product: 'สินค้าไม่อยู่ใน catalog ที่อนุมัติ',
  visibility_only: 'สินค้าเป็นรายการ visibility-only',
};

export function shouldOfferAdaSmartValidation(formatterMode, payload) {
  return formatterMode === 'shopee' && Boolean(payload?.processingRecordId);
}

function policyText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : '';
}

export function hasApprovedAdaSmartCustomerPolicy(preview) {
  const policies = preview?.policies;
  return Boolean(
    policies?.customerPolicyStatus === 'approved'
    && policyText(policies?.customerCode, 100)
    && policyText(policies?.customerPolicyKey, 160)
    && policyText(policies?.customerPolicyRevision, 160),
  );
}

export function canConfirmAdaSmartPreview(preview) {
  return Boolean(
    preview?.canConfirmDryRun
    && preview?.queue?.enabled
    && preview?.summary?.readyCount > 0
    && !preview?.hasCriticalPolicyGap
    && hasApprovedAdaSmartCustomerPolicy(preview),
  );
}

function formatPeriod(cycle) {
  if (!cycle?.periodStart || !cycle?.periodEnd) return 'ไม่ทราบรอบ';
  return `${cycle.periodStart} ถึง ${cycle.periodEnd}`;
}

export function AdaSmartValidationPreviewView({
  busy = false,
  onConfirm,
  onRequestPreview,
  preview = null,
  status = null,
}) {
  if (!preview) {
    return (
      <div className="adasmart-validation-action">
        <button disabled={busy} onClick={onRequestPreview} type="button">
          {busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบก่อนคีย์ AdaSmart — สาขา 004'}
        </button>
        {status?.message && (
          <p className="status" data-state={status.state || 'error'}>{status.message}</p>
        )}
      </div>
    );
  }

  const blockedEntries = Object.entries(preview.summary?.blockedByReason || {})
    .filter(([, count]) => count > 0);
  const safeRows = (preview.orders || []).flatMap((order) => (
    (order.safeLines || []).map((line) => ({ ...line, orderNumber: order.orderNumber }))
  ));
  const customerPolicyApproved = hasApprovedAdaSmartCustomerPolicy(preview);
  const customerPolicies = preview.policies || {};
  const customerCode = policyText(customerPolicies.customerCode, 100);
  const customerPolicyKey = policyText(customerPolicies.customerPolicyKey, 160);
  const customerPolicyRevision = policyText(customerPolicies.customerPolicyRevision, 160);
  const confirmAllowed = canConfirmAdaSmartPreview(preview);

  return (
    <section
      aria-label="Validation Preview สำหรับ AdaSmart สาขา 004"
      className="adasmart-validation-preview"
      data-queue-enabled={preview.queue?.enabled ? 'true' : 'false'}
    >
      <div className="adasmart-validation-heading">
        <div>
          <p className="panel-eyebrow">Validation Preview — ยังไม่เปิด AdaSmart</p>
          <h4>{preview.shop?.displayName || preview.shop?.code}</h4>
          <p>รอบบัญชี {formatPeriod(preview.cycle)} · สาขาปลายทาง {preview.branchCode}</p>
        </div>
        <button className="secondary" disabled={busy} onClick={onRequestPreview} type="button">
          ตรวจสอบใหม่
        </button>
      </div>

      <dl className="adasmart-validation-summary">
        <div><dt>Orders ทั้งหมด</dt><dd>{preview.summary?.totalOrderCount || 0}</dd></div>
        <div><dt>พร้อม</dt><dd>{preview.summary?.readyCount || 0}</dd></div>
        <div><dt>ยกเลิก</dt><dd>{preview.summary?.cancelledCount || 0}</dd></div>
        <div><dt>ต้องตรวจเอง / Block</dt><dd>{preview.summary?.blockedCount || 0}</dd></div>
      </dl>

      <section
        aria-label="AdaSmart customer policy"
        className="adasmart-customer-policy"
        data-policy-approved={customerPolicyApproved ? 'true' : 'false'}
      >
        <h5>Customer ที่จะใช้ใน AdaSmart</h5>
        <dl>
          <div>
            <dt>Customer code</dt>
            <dd>{customerCode || 'ไม่มีข้อมูล — ห้ามยืนยัน'}</dd>
          </div>
          <div>
            <dt>Policy status</dt>
            <dd>{customerPolicyApproved ? 'ผ่านการอนุมัติ' : 'ไม่ผ่าน / ข้อมูลไม่ครบ'}</dd>
          </div>
          <div>
            <dt>Policy revision</dt>
            <dd>{customerPolicyRevision || 'ไม่มีข้อมูล'}</dd>
          </div>
          <div>
            <dt>Policy identity</dt>
            <dd>{customerPolicyKey || 'ไม่มีข้อมูล'}</dd>
          </div>
        </dl>
      </section>

      {!!blockedEntries.length && (
        <div className="adasmart-validation-blocks">
          <h5>สาเหตุที่ถูก block</h5>
          <ul>
            {blockedEntries.map(([reason, count]) => (
              <li key={reason}>
                {BLOCK_REASON_LABELS[reason] || reason}: {count} order
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!safeRows.length && (
        <div className="adasmart-safe-lines">
          <h5>รายการที่ผ่าน product, Timeline และ barcode validation</h5>
          <div className="adasmart-safe-lines-table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Company SKU</th><th>Quantity</th><th>Barcode</th></tr>
              </thead>
              <tbody>
                {safeRows.map((line) => (
                  <tr key={`${line.orderNumber}-${line.companySku}`}>
                    <td>{line.orderNumber}</td>
                    <td>{line.companySku}</td>
                    <td>{line.quantity}</td>
                    <td>{line.barcode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!preview.queue?.enabled && (
        <p className="status" data-state="warning">
          คิว dry-run ถูกปิดด้วย feature flag ระบบจึงตรวจสอบได้อย่างเดียวและจะไม่เรียก branch agent
        </p>
      )}
      {preview.hasCriticalPolicyGap && (
        <p className="status" data-state="warning">
          ยังมี policy สำคัญไม่ครบ ต้องตรวจสอบและอนุมัตินโยบายก่อนสร้างคิว dry-run
        </p>
      )}
      {!customerPolicyApproved && !preview.hasCriticalPolicyGap && (
        <p className="status" data-state="warning">
          Customer policy ใน response ไม่ผ่าน contract จึงปิดการยืนยันแบบ fail closed
        </p>
      )}
      {!preview.summary?.readyCount && (
        <p className="status" data-state="warning">
          ไม่มี order ที่พร้อม จึงไม่สามารถยืนยันสร้างคิวได้
        </p>
      )}
      {status?.message && (
        <p className="status" data-state={status.state || 'error'}>{status.message}</p>
      )}

      {confirmAllowed && (
        <button disabled={busy} onClick={onConfirm} type="button">
          {busy ? 'กำลังยืนยัน...' : 'ยืนยันสร้างคิว dry-run'}
        </button>
      )}
    </section>
  );
}

export default function AdaSmartValidationPreview({ processingRecordId }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState(null);

  async function requestPreview() {
    setBusy(true);
    setStatus(null);
    try {
      setPreview(await createAdaSmartValidationPreview(processingRecordId));
    } catch (error) {
      setPreview(null);
      setStatus({ message: error?.message || 'สร้าง Validation Preview ไม่สำเร็จ', state: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDryRun() {
    if (!canConfirmAdaSmartPreview(preview)) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await confirmAdaSmartDryRunQueue(processingRecordId, preview.planDigest);
      setStatus({
        message: `สร้างคิว dry-run แล้ว ${result.createdCount || 0} job (ซ้ำ ${result.duplicateCount || 0})`,
        state: 'success',
      });
    } catch (error) {
      setStatus({ message: error?.message || 'ยืนยันคิว dry-run ไม่สำเร็จ', state: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdaSmartValidationPreviewView
      busy={busy}
      onConfirm={confirmDryRun}
      onRequestPreview={requestPreview}
      preview={preview}
      status={status}
    />
  );
}
