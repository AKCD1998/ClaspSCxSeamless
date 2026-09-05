// Read-only comparison of original values against generated print copies.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ExcelJS=require('exceljs');
const {ORDER_COLUMNS,LAYOUT_VERSION}=require('../src/accountingPrintLayout');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function read(file){const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(file);return wb;}
(async()=>{
  const [originalRoot,previewRoot]=process.argv.slice(2);let count=0,rows=0,selectedCells=0;
  for(const filename of await fs.readdir(originalRoot)){
    if(!filename.endsWith('.xlsx'))continue;
    const file=path.join(originalRoot,filename),before=sha(await fs.readFile(file));
    const raw=await read(file),output=await read(path.join(previewRoot,'print-input',filename));
    const meta=JSON.parse(await fs.readFile(path.join(previewRoot,filename.replace(/\.xlsx$/,'.pdf.layout.json')),'utf8'));
    assert.equal(meta.version,LAYOUT_VERSION);
    for(const sheet of output.worksheets){assert.equal(sheet.pageSetup.orientation,'landscape');assert.equal(sheet.pageSetup.paperSize,9);assert.equal(sheet.pageSetup.fitToWidth,1);assert.equal(sheet.pageSetup.fitToHeight,0);}
    if(meta.kind==='orders'){
      const a=raw.getWorksheet('orders'),b=output.getWorksheet('orders');const headers=new Map();a.getRow(1).eachCell((cell,c)=>headers.set(cell.text.trim(),c));let n=2;
      for(let r=2;r<=a.rowCount;r++)if(a.getCell(r,headers.get('หมายเลขคำสั่งซื้อ')).text){n++;rows++;
        ORDER_COLUMNS.forEach(([,label],i)=>{if(!label)return;let value=a.getCell(r,headers.get(label)).value;if([6,8,9,10,11].includes(i+1)&&value!==null&&value!==''&&value!=='-')value=Number(String(value).replace(/,/g,''));assert.deepEqual(b.getCell(n,i+1).value,value,filename+' row '+r+' column '+label);selectedCells++;});
        assert.equal(b.getCell(n,12).value,null);assert.equal(b.getCell(n,13).value.formula,`H${n}-I${n}-J${n}-K${n}-L${n}`);
      }
      assert.equal(n-2,meta.rowCount);assert.equal(b.rowCount,n);
    }else{
      for(const sheet of raw.worksheets){
        const b=output.getWorksheet(sheet.name);
        if(sheet.name==='Income'){
          let n=3;
          for(let r=7;r<=sheet.rowCount;r++)if(sheet.getCell(r,2).text){n++;rows++;
            meta.sourceColumns.forEach((c,i)=>{assert.deepEqual(b.getCell(n,i+1).value,sheet.getCell(r,c).value,filename+' row '+r+' col '+c);selectedCells++;});
            for(const column of meta.omittedColumns.filter(x=>x.reason.includes('ศูนย์'))){const value=sheet.getCell(column.column+r).value;assert.ok(value===null||value===''||value==='-'||Number(value)===0);}
          }
          assert.equal(n-3,meta.rowCount);assert.equal(b.rowCount,n);
        }else sheet.eachRow(row=>row.eachCell(cell=>{if(cell.isMerged&&cell.master.address!==cell.address)return;assert.deepEqual(b.getCell(cell.address).value,cell.value,filename+' '+sheet.name+' '+cell.address);selectedCells++;}));
      }
    }
    assert.equal(sha(await fs.readFile(file)),before);count++;
  }
  assert.equal(count,16);console.log(JSON.stringify({originalRoot,files:count,orderAndIncomeRows:rows,selectedCells,originalsUnchanged:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
