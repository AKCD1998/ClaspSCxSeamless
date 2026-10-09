import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveStatusRows } from '../src/components/shopeeLiveStatus.js';
test('independent payment/refund labels and stale observation time',()=>{
  const proof={value:'paid',observedAt:'2026-10-09T03:00:00Z'};
  const rows=liveStatusRows({paidEvidence:proof,refund:{value:'refunded',observedAt:'2026-10-09T03:35:00Z'}},Date.parse('2026-10-09T03:40:00Z'));
  assert.equal(rows[0].text,'ผู้ซื้อชำระเงินแล้ว'); assert.equal(rows[0].stale,true); assert.equal(rows[1].text,'คืนเงินแล้ว');
  assert.deepEqual(liveStatusRows(null),[]);
});
