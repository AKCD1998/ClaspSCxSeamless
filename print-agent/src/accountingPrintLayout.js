const ExcelJS = require('exceljs');

const LAYOUT_VERSION = 'shopee-a4-landscape-reference-v2';
// The user's July raw-only reference, weekly sheets A:N. This is a print
// projection only: do not apply the legacy monthly/cancelled/completed filters.
const ORDER_COLUMNS = [
  ['หมายเลขคำสั่งซื้อ', 'หมายเลขคำสั่งซื้อ', 17],
  ['วันที่ทำการสั่งซื้อ', 'วันที่ทำการสั่งซื้อ', 14],
  ['ชื่อสินค้า', 'ชื่อสินค้า', 38],
  ['ชื่อตัวเลือก', 'ชื่อตัวเลือก', 18],
  ['เลขอ้างอิง', 'เลขอ้างอิง SKU (SKU Reference No.)', 12],
  ['จำนวน', 'จำนวน', 6],
  ['สถานะการสั่งซื้อ', 'สถานะการสั่งซื้อ', 15],
  ['ราคาขายสุทธิ', 'ราคาขายสุทธิ', 11],
  ['โค้ดส่วนลด\nชำระโดยผู้ขาย', 'โค้ดส่วนลดชำระโดยผู้ขาย', 10],
  ['ค่าคอมมิชชั่น', 'ค่าคอมมิชชั่น', 10],
  ['Transaction\nFee', 'Transaction Fee', 13],
  ['ค่าคอมมิชชั่น\nASM', null, 10],
  ['รายได้สุทธิ', null, 11],
  ['เวลาที่ทำการสั่งซื้อสำเร็จ', 'เวลาที่ทำการสั่งซื้อสำเร็จ', 14],
];
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const clone = value => value === undefined ? undefined : structuredClone(value);

function setLandscape(sheet, lastColumn, lastRow, repeatedRows) {
  sheet.pageSetup = {
    paperSize:9, orientation:'landscape', fitToPage:true, fitToWidth:1, fitToHeight:0,
    pageOrder:'downThenOver', showGridLines:false,
    margins:{left:0.25,right:0.25,top:0.3,bottom:0.4,header:0.12,footer:0.15},
    printArea:`A1:${sheet.getColumn(lastColumn).letter}${lastRow}`,
    ...(repeatedRows ? {printTitlesRow:repeatedRows} : {}),
  };
  // A stale explicit scale or manual page break can override fit-to-width.
  delete sheet.pageSetup.scale;
  sheet.rowBreaks=[];
  sheet.headerFooter={...sheet.headerFooter,oddFooter:'&L&A&Cหน้า &P / &N'};
}
function lastContentRow(sheet) {
  let last=1;
  sheet.eachRow((row,n)=>{if(row.values.some(value=>value!==null&&value!==undefined&&value!==''))last=n;});
  return last;
}
function textUnits(value) {
  return Array.from(String(value ?? '')).reduce((sum,c)=>sum+(
    /[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0300-\u036f]/.test(c)?0:
    /[MW@%]/.test(c)?0.85:/[\u0e00-\u0e7f]/.test(c)?0.55:0.52),0);
}
function neededHeight(text,width,fontSize) {
  const available=Math.max(12,width*5.25-7);
  const lines=String(text ?? '').split('\n').reduce((sum,line)=>sum+Math.max(1,Math.ceil(textUnits(line)*fontSize/available)),0);
  return lines*fontSize*1.3+5;
}
function numeric(value, label) {
  if(value===null || value===undefined || value==='' || value==='-')return null;
  if(typeof value==='object' && 'result' in value)return numeric(value.result,label);
  const result=typeof value==='number'?value:Number(String(value).replace(/,/g,''));
  if(!Number.isFinite(result))throw new Error('ค่าตัวเลขไม่ถูกต้อง: '+label);
  return result;
}
function orderPrintWorkbook(source, filename) {
  const raw=source.getWorksheet('orders');
  const map=new Map();
  raw.getRow(1).eachCell((cell,col)=>{
    const label=normalize(cell.text);
    if(map.has(label))throw new Error('หัวคอลัมน์คำสั่งซื้อซ้ำ: '+label);
    map.set(label,col);
  });
  for(const [,sourceLabel] of ORDER_COLUMNS)if(sourceLabel && !map.has(sourceLabel))throw new Error('ไม่พบคอลัมน์คำสั่งซื้อ: '+sourceLabel);
  const ams=map.get('ค่าคอมมิชชั่น ASM') || map.get('ค่าคอมมิชชั่น AMS');
  const wb=new ExcelJS.Workbook();
  const sheet=wb.addWorksheet('orders');
  sheet.getCell('A1').value='คำสั่งซื้อทั้งหมด';
  sheet.getCell('C1').value=filename;
  sheet.mergeCells('C1:N1');
  sheet.getRow(1).height=20;
  sheet.getRow(2).values=ORDER_COLUMNS.map(([label])=>label);
  sheet.getRow(2).height=48;
  ORDER_COLUMNS.forEach(([, ,width],i)=>{sheet.getColumn(i+1).width=width;});
  let count=0;
  for(let n=2;n<=raw.rowCount;n++) {
    if(!normalize(raw.getCell(n,map.get('หมายเลขคำสั่งซื้อ')).text))continue;
    const output=sheet.getRow(++count+2);
    output.values=ORDER_COLUMNS.map(([,label])=>label?clone(raw.getCell(n,map.get(label)).value):null);
    for(const c of [6,8,9,10,11]) output.getCell(c).value=numeric(output.getCell(c).value,ORDER_COLUMNS[c-1][0]+' แถว '+n);
    if(ams)output.getCell(12).value=numeric(raw.getCell(n,ams).value,'ASM แถว '+n);
    const r=output.number;
    const result=Math.round((Number(output.getCell(8).value || 0)-[9,10,11,12].reduce((sum,c)=>sum+Number(output.getCell(c).value || 0),0))*100)/100;
    output.getCell(13).value={formula:`H${r}-I${r}-J${r}-K${r}-L${r}`,result};
    let height=34;
    output.eachCell({includeEmpty:true},(cell,c)=>{
      cell.font={name:'Arial',size:10,color:{argb:'FF000000'}};
      cell.alignment={vertical:'middle',horizontal:c>=6&&c<=13&&c!==7?'right':'left',wrapText:true};
      if([6,8,9,10,11,12,13].includes(c))cell.numFmt=c===6?'0':'#,##0.00';
      if([1,5].includes(c))cell.numFmt='@';
      if([2,14].includes(c))cell.numFmt='yyyy-mm-dd hh:mm';
      const display=cell.value instanceof Date?cell.value.toISOString().slice(0,16).replace('T',' '):cell.text;
      height=Math.max(height,neededHeight(display,ORDER_COLUMNS[c-1][2],10));
      if(count%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F5F7'}};
    });
    output.height=height;
  }
  sheet.getRow(2).eachCell(cell=>{
    cell.font={name:'Arial',size:10,bold:true,color:{argb:'FF000000'}};
    cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFC0E6F5'}};
  });
  sheet.getRow(1).eachCell(cell=>{cell.font={name:'Arial',size:10,bold:true};});
  setLandscape(sheet,14,Math.max(2,count+2),'1:2');
  sheet.headerFooter.oddFooter='&Lรายได้สุทธิตามสูตรแบบเดิม ไม่ใช่ยอดโอน Income'+(!ams?' | ASM: ไม่มีข้อมูลใน Order All':'')+'&Rหน้า &P / &N';
  return {workbook:wb,kind:'orders',rowCount:count,columns:ORDER_COLUMNS.map(([label])=>label),warnings:!ams?['Order All ไม่มีค่าคอมมิชชั่น ASM จึงเว้นว่างตามแบบอ้างอิง']:[]};
}
function incomePrintSheet(source, filename) {
  const raw=source.getWorksheet('Income');
  if(raw.columnCount!==48 || raw.getCell(6,38).text!=='โค้ดส่วนลด' || raw.getCell(6,41).text!=='Shipping provider' || raw.getCell(6,42).text!=='ชื่อผู้ให้บริการขนส่ง')
    throw new Error('โครงสร้าง Income เปลี่ยน ต้องตรวจคอลัมน์บัญชีใหม่ก่อนพิมพ์');
  const money=[];
  const omitted=[];
  const monetaryColumns=[...Array.from({length:26},(_,i)=>i+12),39,40,44,45,46,47,48];
  const requiredHeaders={2:'หมายเลขคำสั่งซื้อ',5:'วันที่ทำการสั่งซื้อ',11:'วันที่โอนชำระเงินสำเร็จ',37:'จำนวนเงินทั้งหมดที่โอนแล้ว (฿)'};
  for(const [c,label] of Object.entries(requiredHeaders))if(raw.getCell(6,Number(c)).text!==label)throw new Error('หัวคอลัมน์ Income ไม่ตรง: '+label);
  for(const c of monetaryColumns) {
    let used=c===37;
    for(let r=7;r<=raw.rowCount;r++)if(raw.getCell(r,2).text && Number(numeric(raw.getCell(r,c).value,raw.getCell(6,c).text+' แถว '+r) || 0)!==0)used=true;
    if(used)money.push(c);else omitted.push({column:raw.getColumn(c).letter,label:raw.getCell(6,c).text,reason:'เป็นศูนย์หรือว่างทุกแถว'});
  }
  const selected=[2,5,11,...money];
  for(let c=1;c<=raw.columnCount;c++)if(!selected.includes(c)&&!monetaryColumns.includes(c))omitted.push({column:raw.getColumn(c).letter,label:raw.getCell(6,c).text,reason:'ไม่ใช่คอลัมน์ยอดเงินสำหรับฉบับตรวจบัญชี'});
  const sheet=source.addWorksheet('Income_print');
  sheet.getCell('A1').value='รายละเอียดรายรับของฉัน';sheet.getCell('D1').value=filename;
  sheet.mergeCells(1,4,1,selected.length);
  sheet.getRow(1).height=22;
  sheet.getCell('A2').value='ผู้ขาย: '+raw.getCell('A2').text;
  sheet.mergeCells('A2:C2');
  sheet.getCell('D2').value=raw.getCell('B2').text+' ถึง '+raw.getCell('C2').text;
  sheet.mergeCells(2,4,2,selected.length);sheet.getRow(2).height=20;
  sheet.getRow(3).values=selected.map(c=>raw.getCell(6,c).text);
  selected.forEach((c,i)=>{sheet.getColumn(i+1).width=i===0?22:i<3?15:12;});
  sheet.getRow(3).height=78;
  let count=0;
  for(let r=7;r<=raw.rowCount;r++){
    if(!raw.getCell(r,2).text)continue;
    const row=sheet.getRow(++count+3);
    row.values=selected.map(c=>clone(raw.getCell(r,c).value));
    row.height=26;
    row.eachCell({includeEmpty:true},(cell,c)=>{
      cell.font={name:'Arial',size:10};cell.alignment={vertical:'middle',horizontal:c>3?'right':'left',wrapText:true};
      cell.numFmt=c>3?'#,##0.00':c===1?'@':'yyyy-mm-dd';
      if(count%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F5F7'}};
    });
  }
  sheet.getRow(3).eachCell(cell=>{
    cell.font={name:'Arial',size:10,bold:true};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFE1C9'}};
  });
  for(const r of [1,2])sheet.getRow(r).eachCell(cell=>{cell.font={name:'Arial',size:10,bold:r===1};});
  setLandscape(sheet,selected.length,Math.max(3,count+3),'1:3');
  sheet.headerFooter.oddFooter='&Lฉบับตรวจบัญชี: คงค่าต้นฉบับ คอลัมน์เงินที่ไม่ได้แสดงเป็นศูนย์หรือว่างทุกแถว&Rหน้า &P / &N';
  source.removeWorksheet(raw.id);sheet.name='Income';
  return {rowCount:count,columns:selected.map(c=>raw.getCell(6,c).text),sourceColumns:selected,omittedColumns:omitted};
}
function formatExisting(source, filename) {
  const income=source.getWorksheet('Income');
  const kind=income?'income':'balance';
  if(!income && normalize(source.worksheets[0]?.getCell('A6').text)!=='ชื่อผู้ใช้ของผู้ขาย')throw new Error('ไม่พบรูปแบบรายงานบัญชี Shopee ที่รองรับ');
  for(const sheet of source.worksheets) {
    const end=lastContentRow(sheet);
    const columns=sheet.actualColumnCount;
    let balanceHeader;
    if(kind==='balance')for(let r=1;r<=Math.min(30,end);r++)if(sheet.getCell(r,1).text==='วันที่' && sheet.getCell(r,4).text==='รหัสคำสั่งซื้อ')balanceHeader=r;
    if(kind==='balance' && !balanceHeader)throw new Error('ไม่พบหัวตารางรายการ Seller Balance');
    const repeat=sheet===income?'6:6':balanceHeader?`${balanceHeader}:${balanceHeader}`:undefined;
    setLandscape(sheet,columns,end,repeat);
    if(kind==='income' && sheet.name==='Summary') {
      [25,60,18,18].forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
      for(let r=15;r<=end;r++) {
        const cell=sheet.getCell(r,2);
        if(cell.isMerged || !cell.text)continue;
        cell.alignment={...cell.alignment,wrapText:true};
        sheet.getRow(r).height=Math.max(sheet.getRow(r).height || 16,neededHeight(cell.text,60,cell.font?.size || 10));
      }
    }
    if(kind==='income' && sheet.name==='Service Fee Details') {
      [12,30,85].forEach((width,i)=>{sheet.getColumn(i+1).width=width;});
      sheet.pageSetup.printTitlesRow='1:2';
      for(let r=1;r<=end;r++) {
        const row=sheet.getRow(r);let height=r===2?34:18;
        row.eachCell(cell=>{
          cell.font={...cell.font,size:10};
          cell.alignment={...cell.alignment,wrapText:true,vertical:'middle'};
          height=Math.max(height,neededHeight(cell.text,sheet.getColumn(cell.col).width,10));
        });
        row.height=height;
      }
    }
    if(kind==='balance') {
      const widths=[23,23,47,20,20,20,20,20];
      widths.forEach((w,i)=>{if(i<columns)sheet.getColumn(i+1).width=w;});
      for(let r=balanceHeader;r<=end;r++) {
        const row=sheet.getRow(r);let height=20;
        row.eachCell((cell,c)=>{
          if(cell.isMerged)return;
          const size=cell.font?.size || 11;
          cell.alignment={...cell.alignment,wrapText:true,vertical:'middle'};
          height=Math.max(height,neededHeight(cell.text,sheet.getColumn(c).width || 20,size));
        });
        row.height=height;
      }
    }
  }
  const selection=income?incomePrintSheet(source,filename):{};
  return {workbook:source,kind,...selection,warnings:income?['Income ฉบับพิมพ์เลือกคอลัมน์บัญชี และเก็บทุกคอลัมน์เงินที่มีค่าจริง ชีต Summary คงข้อมูลเดิม']:[]};
}
async function preparePrintWorkbook(buffer, filename='') {
  const source=new ExcelJS.Workbook();await source.xlsx.load(buffer);
  const result=source.getWorksheet('orders')?orderPrintWorkbook(source,filename):formatExisting(source,filename);
  return {...result,version:LAYOUT_VERSION,buffer:Buffer.from(await result.workbook.xlsx.writeBuffer())};
}
module.exports={LAYOUT_VERSION,ORDER_COLUMNS,setLandscape,preparePrintWorkbook};
