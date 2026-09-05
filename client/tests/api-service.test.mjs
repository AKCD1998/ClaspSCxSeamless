import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
let vite;
let originalFetch;

test.before(async () => {
  process.env.VITE_API_BASE_URL = 'http://api.test.local/api';
  originalFetch = globalThis.fetch;
  vite = await createServer({
    root: clientRoot,
    logLevel: 'silent',
    server: {
      middlewareMode: true,
    },
    appType: 'custom',
  });
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  if (vite) {
    await vite.close();
  }
});

test('getBootstrap calls the configured backend URL', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        appName: 'Seamless X GAS Excel Formatter',
        maxUploadMb: 20,
        retentionHours: 12,
        maxBatchFiles: 20,
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getBootstrap();

  assert.equal(calls[0].url, 'http://api.test.local/api/bootstrap');
  assert.equal(payload.maxUploadMb, 20);
});

test('legacy Shopee review API keeps list filters and sends only the selected shop', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ orders: [], reviewOnly: true }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getShopeeLegacyReconciliations({
    cursor: 'page 2/token',
    limit: 10,
    status: 'pending',
  });
  await api.reviewShopeeLegacyOrder('26082471YK8C02', 'dr-morepen');

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders/legacy-reconciliation?cursor=page+2%2Ftoken&limit=10&status=pending',
  );
  assert.equal(
    calls[1].url,
    'http://api.test.local/api/app/shopee/orders/legacy-reconciliation/26082471YK8C02',
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), { shopCode: 'dr-morepen' });
});

test('legacy Shopee timeline apply reads a dry-run and posts only its digest', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      dryRun: !options.method,
      legacyOrderCount: 315,
      orderCount: options.method ? 315 : undefined,
      planDigest: 'a'.repeat(64),
      readyToApply: true,
    }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getShopeeLegacyApplyPlan();
  await api.applyShopeeLegacyTimeline('a'.repeat(64));

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders/legacy-reconciliation/apply-plan',
  );
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(
    calls[1].url,
    'http://api.test.local/api/app/shopee/orders/legacy-reconciliation/apply',
  );
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { planDigest: 'a'.repeat(64) });
});

test('API errors surface backend error messages', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      error: {
        message: 'Backend validation failed.',
        code: 'BAD_REQUEST',
      },
    }),
    { status: 400 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.getBootstrap(),
    /Backend validation failed/,
  );
});

test('processWorkbookPayload sends multipart form data and unwraps first success', async () => {
  if (typeof File === 'undefined') {
    return;
  }

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        ok: true,
        successes: [
          {
            ok: true,
            filename: '2026-04-30-001-02 indiv exp.xlsx',
            previewSpreadsheetId: 'preview-id',
            previewUrl: 'http://api.test.local/api/files/preview-id/download',
          },
        ],
        failures: [],
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const result = await api.processWorkbookPayload({
    file: new File(['xlsx'], 'source.xlsx'),
    formatterMode: 'shopee',
    shopCode: 'sc-drug-store',
    batchFileCount: 1,
  });

  assert.equal(calls[0].url, 'http://api.test.local/api/workbooks/process');
  assert.equal(calls[0].options.method, 'POST');
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[0].options.body.get('formatterMode'), 'shopee');
  assert.equal(calls[0].options.body.get('shopCode'), 'sc-drug-store');
  assert.equal(result.previewSpreadsheetId, 'preview-id');
});

test('processWorkbookPayload rejects non-File values before network calls', async () => {
  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.processWorkbookPayload({ file: { name: 'source.xlsx' } }),
    /File object/,
  );
});

test('uploadAccountingOriginals sends untouched files under separate shop fields', async () => {
  if (typeof File === 'undefined') return;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ manifest: { sourceFileCount: 42 } }), { status: 201 });
  };
  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.uploadAccountingOriginals({
    'sc-drug-store': [new File(['source PDF'], 'weekly_report_20260727.pdf')],
    'dr-morepen': [new File(['source Excel'], 'Income.xlsx')],
  });

  assert.equal(calls[0].url, 'http://api.test.local/api/app/accounting-print-bundles');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body.get('sc-drug-store').name, 'weekly_report_20260727.pdf');
  assert.equal(await calls[0].options.body.get('sc-drug-store').text(), 'source PDF');
  assert.equal(calls[0].options.body.get('dr-morepen').name, 'Income.xlsx');
  assert.equal(payload.manifest.sourceFileCount, 42);
});

test('accounting approval sends only the selected batch and reviewed digest', async () => {
  const calls = [];
  globalThis.fetch = async (url,options) => {
    calls.push({url,options});
    return new Response(JSON.stringify({id:'batch-1',status:'queued'}));
  };
  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.approveAccountingPrintBatch('batch-1','reviewed-digest');
  assert.equal(calls[0].url, 'http://api.test.local/api/app/accounting-print-bundles/batch-1/approve');
  assert.deepEqual(JSON.parse(calls[0].options.body),{digest:'reviewed-digest'});
});

test('processWorkbookPayload surfaces duplicate-upload failures from backend payloads', async () => {
  if (typeof File === 'undefined') {
    return;
  }

  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: false,
      successes: [],
      failures: [
        {
          fileName: 'source.xlsx',
          message: 'This workbook was already uploaded previously.',
          code: 'DUPLICATE_UPLOAD',
          details: {
            existingGeneratedFileId: 'existing-file-id',
          },
        },
      ],
    }),
    { status: 409 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.processWorkbookPayload({
      file: new File(['xlsx'], 'source.xlsx'),
      formatterMode: 'individual',
    }),
    (error) => {
      assert.equal(error.message, 'This workbook was already uploaded previously.');
      assert.equal(error.code, 'DUPLICATE_UPLOAD');
      assert.equal(error.details.existingGeneratedFileId, 'existing-file-id');
      return true;
    },
  );
});

test('getPharmcareInbox builds a query string from filters and returns the payload', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        documents: [{ id: 'doc-1', documentType: 'e_credit_invoice' }],
        nextCursor: null,
        summary: { autoClassified: 1, conflict: 0, duplicate: 0, manualReview: 0 },
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getPharmcareInbox({ documentType: 'e_credit_invoice', status: 'auto_classified' });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/pharmcare/inbox?documentType=e_credit_invoice&status=auto_classified',
  );
  assert.equal(payload.documents.length, 1);
});

test('getShopeeEmailInbox builds the live Gmail inbox query and keeps an opaque cursor', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        emails: [{ id: 'gmail-1', category: 'shipment_due' }],
        nextCursor: 'opaque-page-token',
        source: 'info@mail.shopee.co.th',
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getShopeeEmailInbox({
    category: 'shipment_due',
    cursor: 'page 2/token',
    receivedFrom: '2026-08-24',
    shopCode: 'dr-morepen',
  });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/inbox?category=shipment_due&cursor=page+2%2Ftoken&receivedFrom=2026-08-24&shopCode=dr-morepen',
  );
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(payload.source, 'info@mail.shopee.co.th');
});

test('Shopee timeline APIs list, read, and admin-sync parsed orders', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/sync')) {
      return new Response(JSON.stringify({ storedEvents: 1, nextCursor: 'gmail-older' }), { status: 200 });
    }
    if (url.includes('/orders/26082471YK8C02')) {
      return new Response(JSON.stringify({ order: { orderNumber: '26082471YK8C02' }, events: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ orders: [], nextCursor: 'db-cursor' }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getShopeeOrders({
    limit: 25,
    page: 2,
    search: 'IC-001849 Myda',
    shopCode: 'sc-drug-store',
    sortBy: 'orderNumber',
    sortOrder: 'asc',
    status: 'shipment_due',
  });
  await api.getShopeeOrder('26082471YK8C02', { shopCode: 'sc-drug-store' });
  await api.syncShopeeOrders({
    cursor: 'gmail page/token',
    limit: 25,
    shopCode: 'sc-drug-store',
  });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders?limit=25&page=2&search=IC-001849+Myda&shopCode=sc-drug-store&sortBy=orderNumber&sortOrder=asc&status=shipment_due',
  );
  assert.equal(
    calls[1].url,
    'http://api.test.local/api/app/shopee/orders/26082471YK8C02?shopCode=sc-drug-store',
  );
  assert.equal(calls[2].url, 'http://api.test.local/api/app/shopee/orders/sync');
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    cursor: 'gmail page/token',
    limit: 25,
    shopCode: 'sc-drug-store',
  });
  assert.equal(calls[2].options.credentials, 'include');
});

test('Shopee financial visibility APIs read and update only the selected fields', async () => {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      userFinancialVisibility: {
        itemSubtotal: true,
        shippingFee: true,
        totalAmount: false,
        unitPrice: true,
      },
    }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getShopeeFinancialVisibility();
  await api.updateShopeeFinancialVisibility({
    shippingFee: true,
    totalAmount: false,
    unitPrice: true,
  });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders/financial-visibility',
  );
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    shippingFee: true,
    totalAmount: false,
    unitPrice: true,
  });
});

test('getShopeeAccountingCycleStatus fetches the configured accounting checkpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      hasHistory: true,
      lastCompletedCycle: { periodEnd: '2026-08-23' },
      nextCycle: { periodStart: '2026-08-24', periodEnd: '2026-09-13', weeks: [] },
    }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getShopeeAccountingCycleStatus();

  assert.equal(calls[0].url, 'http://api.test.local/api/app/shopee/accounting-cycle');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(payload.nextCycle.periodStart, '2026-08-24');
});

test('Shopee sales summary API passes the selected order-date range and shop scope', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      endDate: '2026-09-03',
      orderCount: 2,
      productCount: 1,
      products: [],
      startDate: '2026-09-01',
      totalQuantity: 4,
    }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getShopeeSalesSummary({
    endDate: '2026-09-03',
    shopCode: 'all',
    startDate: '2026-09-01',
  });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders/sales-summary?endDate=2026-09-03&shopCode=all&startDate=2026-09-01',
  );
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(payload.totalQuantity, 4);
});

test('Shopee sales summary Excel API downloads the selected range as a blob', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response('xlsx-bytes', {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      status: 200,
    });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const result = await api.getShopeeSalesSummaryExcel({
    endDate: '2026-09-03',
    shopCode: 'sc-drug-store',
    startDate: '2026-09-01',
  });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/orders/sales-summary/export?endDate=2026-09-03&shopCode=sc-drug-store&startDate=2026-09-01',
  );
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(await result.blob.text(), 'xlsx-bytes');
  assert.equal(
    result.filename,
    'shopee-sales-sc-drug-store-2026-09-01-to-2026-09-03.xlsx',
  );
});

test('AdaSmart validation APIs send only processing identity and the reviewed plan digest', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true, planDigest: 'a'.repeat(64) }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.createAdaSmartValidationPreview('processing-record-id');
  await api.confirmAdaSmartDryRunQueue('processing-record-id', 'a'.repeat(64));

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/shopee/adasmart/validation-preview',
  );
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    processingRecordId: 'processing-record-id',
  });
  assert.equal(calls[1].url, 'http://api.test.local/api/app/shopee/adasmart/confirm');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    processingRecordId: 'processing-record-id',
    planDigest: 'a'.repeat(64),
  });
});

test('getPharmcareInbox omits the query string when no filters are set', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ documents: [], nextCursor: null, summary: null }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getPharmcareInbox({});

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/inbox');
});

test('getPharmcareInbox passes the sort order and received date range through as query params', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ documents: [], nextCursor: null, summary: null }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getPharmcareInbox({ order: 'asc', receivedFrom: '2026-08-01', receivedTo: '2026-08-01' });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/pharmcare/inbox?order=asc&receivedFrom=2026-08-01&receivedTo=2026-08-01',
  );
});

test('getPharmcareMessage fetches a single message by id', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'msg-1', attachments: [], documents: [] }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getPharmcareMessage('msg-1');

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/messages/msg-1');
  assert.equal(payload.id, 'msg-1');
});

test('getPharmcareAttachmentDownloadUrl builds the authenticated download proxy URL', async () => {
  const api = await vite.ssrLoadModule('/src/services/api.js');

  assert.equal(
    api.getPharmcareAttachmentDownloadUrl('att-1'),
    'http://api.test.local/api/app/pharmcare/attachments/att-1/download',
  );
});

test('fetchPharmcareAttachmentBlob fetches with credentials and returns the blob', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const blob = await api.fetchPharmcareAttachmentBlob('att-1');

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/attachments/att-1/download');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(blob.type, 'application/pdf');
});

test('fetchPharmcareAttachmentBlob surfaces backend error messages on failure', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'Attachment content not found.' } }),
    { status: 404 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.fetchPharmcareAttachmentBlob('att-missing'),
    (error) => {
      assert.equal(error.message, 'Attachment content not found.');
      assert.equal(error.status, 404);
      return true;
    },
  );
});

test('requestProcessingHistoryPrint posts requestedBy and reason to the request-print endpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Reprint requested.',
        record: { id: 'record-id', printed: false },
        job: { id: 'job-id', status: 'queued', isReprint: true },
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.requestProcessingHistoryPrint('record-id', { reason: 'document_lost' });

  assert.equal(calls[0].url, 'http://api.test.local/api/app/processing-records/record-id/request-print');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { requestedBy: '', reason: 'document_lost' });
  assert.equal(payload.job.isReprint, true);
});
