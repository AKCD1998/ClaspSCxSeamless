function buildHeaders(token, extra) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function requestJson(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(token, options && options.headers),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (payload && payload.error && payload.error.message) || `Request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function createApiClient({ apiBaseUrl, internalApiToken }) {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');

  return {
    async claimBatchWork(body) {
      return requestJson(`${base}/api/agent/accounting-print-batches/claim`,
        { method:'POST',body:JSON.stringify(body) },internalApiToken);
    },
    async batchEvent(id,body) {
      return requestJson(`${base}/api/agent/accounting-print-batches/items/${encodeURIComponent(id)}/events`,
        {method:'POST',body:JSON.stringify(body)},internalApiToken);
    },
    async uploadBatchPreview(id,token,buffer,printLayout) {
      const form=new FormData();form.append('token',token);
      if(printLayout)form.append('printLayout',JSON.stringify(printLayout));
      form.append('preview',new Blob([buffer],{type:'application/pdf'}),'preview.pdf');
      const response=await fetch(`${base}/api/agent/accounting-print-batches/items/${encodeURIComponent(id)}/preview`,{
        method:'POST',headers:{Authorization:`Bearer ${internalApiToken}`},body:form,signal:AbortSignal.timeout(120000),
      });
      if(!response.ok)throw new Error('บันทึกตัวอย่างไม่สำเร็จ (HTTP '+response.status+')');
      return response.json();
    },
    async downloadBatchFile(url) {
      if(!/^\/api\/agent\/accounting-print-batches\//.test(url))throw new Error('Invalid batch download path');
      const response=await fetch(base+url,{headers:{Authorization:`Bearer ${internalApiToken}`},signal:AbortSignal.timeout(120000),redirect:'error'});
      if(!response.ok)throw new Error('ดาวน์โหลดไม่สำเร็จ (HTTP '+response.status+')');
      return Buffer.from(await response.arrayBuffer());
    },
    async getPrintQueue() {
      const payload = await requestJson(`${base}/api/agent/print-queue`, { method: 'GET' }, internalApiToken);
      return (payload && payload.queue) || [];
    },

    async createPrintJob(body) {
      const payload = await requestJson(
        `${base}/api/agent/print-jobs`,
        { method: 'POST', body: JSON.stringify(body) },
        internalApiToken,
      );
      return payload && payload.job;
    },

    async updatePrintJob(id, patch) {
      const payload = await requestJson(
        `${base}/api/agent/print-jobs/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        internalApiToken,
      );
      return payload && payload.job;
    },

    async completePrintJob(id) {
      return requestJson(
        `${base}/api/agent/print-jobs/${encodeURIComponent(id)}/complete`,
        { method: 'POST', body: JSON.stringify({}) },
        internalApiToken,
      );
    },

    async downloadFile(url) {
      const response = await fetch(url, {
        headers: internalApiToken ? { Authorization: `Bearer ${internalApiToken}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    },
  };
}

module.exports = { createApiClient };
