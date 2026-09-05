const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {preparePrintWorkbook,ORDER_COLUMNS,LAYOUT_VERSION}=require('../src/accountingPrintLayout');
async function prepare(wb){return preparePrintWorkbook(Buffer.from(await wb.xlsx.writeBuffer()),'source.xlsx');}
function landscape(sheet){assert.equal(sheet.pageSetup.orientation,'landscape');assert.equal(sheet.pageSetup.paperSize,9);assert.equal(sheet.pageSetup.fitToWidth,1);assert.equal(sheet.pageSetup.fitToHeight,0);assert.equal(sheet.pageSetup.scale,undefined);}
test('order print projection retains every status and duplicate row, uses reference columns and blank ASM',async()=>{
  const wb=new ExcelJS.Workbook(),raw=wb.addWorksheet('orders');
  const labels=ORDER_COLUMNS.map(([,label])=>label).filter(Boolean);raw.addRow(labels);
  for(const status of ['สำเร็จ','ยกเลิกแล้ว','สำเร็จ'])raw.addRow(labels.map(label=>({
    'หมายเลขคำสั่งซื้อ':'260725K5F143V5','สถานะการสั่งซื้อ':status,'จำนวน':2,'ราคาขายสุทธิ':100,
    'โค้ดส่วนลดชำระโดยผู้ขาย':5,'ค่าคอมมิชชั่น':6,'Transaction Fee':3,
  }[label] ?? 'ข้อมูลเดิม')));
  const result=await prepare(wb),sheet=result.workbook.getWorksheet('orders');
  assert.equal(result.version,LAYOUT_VERSION);assert.equal(result.rowCount,3);assert.equal(sheet.columnCount,14);
  assert.deepEqual([3,4,5].map(r=>sheet.getCell(r,7).value),['สำเร็จ','ยกเลิกแล้ว','สำเร็จ']);
  assert.equal(sheet.getCell('L3').value,null);assert.equal(sheet.getCell('M3').value.result,86);
  assert.equal(sheet.getCell('M3').value.formula,'H3-I3-J3-K3-L3');
  assert.equal(sheet.pageSetup.printTitlesRow,'1:2');landscape(sheet);
});
function incomeFixture(){
  const wb=new ExcelJS.Workbook();wb.addWorksheet('Summary').getCell('B15').value='เนื้อหาเดิม';
  const raw=wb.addWorksheet('Income');for(let c=1;c<=48;c++)raw.getCell(6,c).value='column '+c;
  for(const [c,label] of Object.entries({2:'หมายเลขคำสั่งซื้อ',5:'วันที่ทำการสั่งซื้อ',11:'วันที่โอนชำระเงินสำเร็จ',37:'จำนวนเงินทั้งหมดที่โอนแล้ว (฿)',38:'โค้ดส่วนลด',41:'Shipping provider',42:'ชื่อผู้ให้บริการขนส่ง'}))raw.getCell(6,Number(c)).value=label;
  raw.getCell('A2').value='seller';raw.getCell('B2').value='2026-07-27';raw.getCell('C2').value='2026-08-02';
  for(const r of [7,8]){raw.getCell(r,2).value='order'+r;raw.getCell(r,12).value=100;raw.getCell(r,26).value=r===7?-5:5;raw.getCell(r,37).value=95;raw.getCell(r,45).value=0;}
  return wb;
}
test('Income keeps every nonzero financial column even when total nets to zero; Summary unchanged',async()=>{
  const result=await prepare(incomeFixture()),sheet=result.workbook.getWorksheet('Income');
  assert.deepEqual(result.sourceColumns,[2,5,11,12,26,37]);assert.equal(result.rowCount,2);
  assert.equal(sheet.getCell(4,5).value,-5);assert.equal(sheet.getCell(5,5).value,5);
  assert.equal(result.workbook.getWorksheet('Summary').getCell('B15').value,'เนื้อหาเดิม');
  assert.ok(result.omittedColumns.find(c=>c.column==='AS'&&c.reason.includes('ศูนย์')));
  assert.equal(sheet.pageSetup.printTitlesRow,'1:3');result.workbook.worksheets.forEach(landscape);
});
test('Income schema drift and nonnumeric money fail closed',async()=>{
  let wb=incomeFixture();wb.getWorksheet('Income').getCell(6,37).value='unknown';await assert.rejects(prepare(wb),/หัวคอลัมน์/);
  wb=incomeFixture();wb.getWorksheet('Income').getCell(7,26).value='not a number';await assert.rejects(prepare(wb),/ตัวเลข/);
});
test('Balance preserves all cells and repeats the actual table header row',async()=>{
  const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Transaction Report');
  sheet.getCell('A6').value='ชื่อผู้ใช้ของผู้ขาย';sheet.getCell('A18').value='วันที่';sheet.getCell('D18').value='รหัสคำสั่งซื้อ';sheet.getCell('F19').value=-99.25;
  const result=await prepare(wb),output=result.workbook.worksheets[0];
  assert.equal(output.getCell('F19').value,-99.25);assert.equal(output.pageSetup.printTitlesRow,'18:18');landscape(output);
});
