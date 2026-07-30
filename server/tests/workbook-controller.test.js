const assert = require('node:assert/strict');
const test = require('node:test');

const workbookService = require('../src/services/workbookService');
const { processWorkbooks } = require('../src/controllers/workbookController');

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('processWorkbooks returns 409 when every upload fails because of a duplicate file', async () => {
  const original = workbookService.processWorkbooks;
  workbookService.processWorkbooks = async () => ({
    ok: false,
    successes: [],
    failures: [
      {
        fileName: 'source.xlsx',
        message: 'This workbook was already uploaded previously.',
        code: 'DUPLICATE_UPLOAD',
      },
    ],
    previewState: {
      id: '',
      url: '',
      batchId: '',
    },
  });

  const res = createResponseRecorder();

  try {
    await processWorkbooks({ files: [], body: {} }, res);
  } finally {
    workbookService.processWorkbooks = original;
  }

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.failures[0].code, 'DUPLICATE_UPLOAD');
});

