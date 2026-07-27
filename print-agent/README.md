# Print Agent

Node.js CLI ที่รันบนเครื่อง 000 (สาขา, Windows Server 2019) ทุก 1 ชั่วโมงผ่าน Task Scheduler เพื่อ:

1. เช็คเว็บ ClaspSCxSeamless ว่ามีเอกสารที่ยังไม่ได้ปริ้นท์ส่งพี่เอหรือไม่ (`GET /api/agent/print-queue`)
2. ถ้ามี → ดาวน์โหลดไฟล์ .xlsx → แปลงเป็น PDF ด้วย LibreOffice headless → สั่งปริ้นด้วย SumatraPDF ไปที่ Brother MFC-T4500DW
3. รอจนงานปริ้นของเอกสารนี้โดยเฉพาะหายไปจากคิว (ไม่รอทั้งคิวว่าง — คิวเครื่องจริงอาจมีงานค้างเก่าที่ไม่เกี่ยวกันอยู่) แล้วรายงานผลกลับไปที่เว็บ (backend เป็นคน mark printed + ยิง LINE แจ้งเตือน)

รายละเอียด design เต็มอยู่ที่ `docs/09-auto-print-agent-design.md`, checklist implementation อยู่ที่ `docs/10-print-agent-tasks.md`.

## Prerequisites บนเครื่อง 000

เครื่อง 000 เป็น **Windows Server 2019** — **ไม่มี** `winget`/`choco` ติดตั้งไว้ ห้ามใช้สองตัวนี้ในการติดตั้ง ต้องดาวน์โหลด installer มาลงเองแบบ manual

1. **Node.js** (LTS) — ดาวน์โหลด installer จาก https://nodejs.org แล้วรันแบบปกติ (`node --version` เพื่อยืนยัน)
2. **LibreOffice** — ยืนยันแล้วว่าเครื่อง 000 มี LibreOffice 26.2.5.2 ติดตั้งอยู่ที่ `C:\Program Files\LibreOffice\program\soffice.exe` (ถ้าเครื่องอื่น/ติดตั้งใหม่ ดาวน์โหลดจาก https://www.libreoffice.org/download/ แล้วติดตั้งแบบปกติ)
3. **SumatraPDF** — ยืนยันแล้วว่าเครื่อง 000 มี SumatraPDF 3.6.1 ติดตั้งแบบ per-user ของ user `Administrator` อยู่ที่ `C:\Users\Administrator\AppData\Local\SumatraPDF\SumatraPDF.exe` (ถ้าต้องติดตั้งใหม่ ดาวน์โหลด installer จาก https://www.sumatrapdfreader.org/download-free-pdf-viewer แล้วเลือกโหมด install แบบ per-user)
4. **Printer** — Brother MFC-T4500DW ต้องต่อกับเครื่องนี้แล้วและติดตั้ง driver เรียบร้อย เช็คชื่อ printer จริงใน Windows ด้วย:
   ```powershell
   Get-Printer
   ```
   ชื่อที่ได้อาจไม่ตรงเป๊ะกับ "Brother MFC-T4500DW" (เช่นอาจมี "Printer" ต่อท้าย) — ใช้ชื่อที่ได้จริงใส่ใน `.env` (`PRINTER_NAME`)

## ติดตั้ง

```powershell
# Clone repo (หรือ pull ถ้า clone ไว้แล้ว)
git clone <repo-url> C:\apps\ClaspSCxSeamless
cd C:\apps\ClaspSCxSeamless\print-agent

# ติดตั้ง dependency (มีแค่ dotenv)
npm install

# สร้าง .env จริงจาก .env.example แล้วกรอกค่าจริง
copy .env.example .env
notepad .env
```

กรอกค่าใน `.env`:

| ตัวแปร | ค่า |
|---|---|
| `API_BASE_URL` | URL ของ backend ที่ deploy บน Render (ต้อง deploy เสร็จก่อน — ดู "งานที่เหลือให้มนุษย์ทำ" ใน docs/10) |
| `INTERNAL_API_TOKEN` | ต้องตรงกับ `INTERNAL_API_TOKEN` ที่ตั้งไว้บน Render |
| `PRINTER_NAME` | ชื่อ printer จริงจาก `Get-Printer` |
| `AGENT_HOST` | `000-HQ` (หรือชื่อที่อยากใช้ระบุเครื่องนี้ใน log) |
| `SOFFICE_PATH` | `C:\Program Files\LibreOffice\program\soffice.exe` |
| `SUMATRA_PATH` | `C:\Users\Administrator\AppData\Local\SumatraPDF\SumatraPDF.exe` |
| `POLL_LOG_DIR` | `logs` (ค่า default พอ) |

**ทดสอบก่อนตั้ง Task Scheduler:**

```powershell
# dry-run ก่อน — ทำทุกอย่างยกเว้นสั่งปริ้นจริง ปลอดภัยกับ production เพราะไม่สร้าง/แก้ print job จริงบนเว็บ
node src\index.js --dry-run

# รันจริงรอบเดียว (ถ้ามีเอกสารรอปริ้นจริง จะปริ้นจริงออกเครื่อง Brother)
node src\index.js
```

เช็ค `logs\print-agent-YYYYMMDD.log` ว่า log ออกมาตามที่คาด

## ตั้ง Task Scheduler ให้รันทุก 1 ชั่วโมง

ต้องตั้งให้รันเป็น user **Administrator** (เพราะ SumatraPDF ติดตั้งแบบ per-user ของ user นี้) และเปิด "Run whether user is logged on or not":

```powershell
$action = New-ScheduledTaskAction `
  -Execute "node.exe" `
  -Argument "src\index.js" `
  -WorkingDirectory "C:\apps\ClaspSCxSeamless\print-agent"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "Administrator" -LogonType Password -RunLevel Highest

Register-ScheduledTask `
  -TaskName "ClaspSCxSeamless Print Agent" `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Description "Polls ClaspSCxSeamless print queue hourly and prints to Brother MFC-T4500DW"
```

จะถูกถามรหัสผ่านของ user `Administrator` ตอนสร้าง task (จำเป็นสำหรับ `LogonType Password` เพื่อให้รันได้แม้ไม่มีใคร login อยู่)

ตรวจว่า task ทำงานจริง:

```powershell
Get-ScheduledTask -TaskName "ClaspSCxSeamless Print Agent" | Get-ScheduledTaskInfo
Start-ScheduledTask -TaskName "ClaspSCxSeamless Print Agent"   # สั่งรันทันทีเพื่อทดสอบ
```

## Log

- **Source of truth**: ตาราง `print_jobs` บนเว็บ (Supabase) — ดูสถานะ/เวลาแต่ละ job ได้จากตรงนั้นเสมอ แม้เครื่อง 000 ดับ
- **Local log เสริม**: `print-agent\logs\print-agent-YYYYMMDD.log` (เขียนทุกรอบ poll แม้ไม่มีงาน) ไว้ debug กรณี agent ต่อ API ไม่ได้เลย (ซึ่งจะไม่มีร่องรอยใน DB)
- ไฟล์ `agent.lock` (สร้าง/ลบอัตโนมัติ) กันไม่ให้สองรอบรันซ้อนกันถ้ารอบก่อนยังไม่จบ — ถ้า process ที่ถือ lock ตายไปแล้วจริง (เครื่องดับ/ถูก kill กลางคัน) รอบถัดไปจะ**ตรวจจับเองและ reclaim lock อัตโนมัติ** (เช็คว่า PID ที่บันทึกไว้ในไฟล์ยังมี process รันอยู่จริงไหม) ไม่ต้องลบไฟล์เองแล้ว

## Troubleshooting

- **"Another run is already in progress"**: ปกติจะหายเองในรอบถัดไปถ้า process เดิมตายไปแล้วจริง (agent reclaim lock อัตโนมัติ) — ถ้ายังเจอซ้ำหลายรอบ ให้เช็คว่ามี process node เก่าค้างอยู่จริงไหม (`Get-Process node`) ถ้ามีจริงและค้างเกินคาด ค่อยพิจารณา kill/ลบไฟล์ `print-agent\agent.lock` เอง
- **printer offline / ไม่เจอ printer**: เช็คชื่อ printer ด้วย `Get-Printer` แล้วเทียบกับ `PRINTER_NAME` ใน `.env` ให้ตรงเป๊ะ
- **แปลง PDF ไม่ได้**: เช็ค `SOFFICE_PATH` ชี้ถูกไฟล์จริงไหม, ลองรัน `soffice --headless --convert-to pdf --outdir . test.xlsx` มือเปล่าดูว่า error อะไร
- **ก่อนเปิดใช้งานจริงครั้งแรก**: ปริ้นไฟล์ตัวอย่างจริง 1 รอบเทียบกับที่เคยปริ้นจาก Excel/GAS เดิม เพื่อยืนยันว่า format จาก LibreOffice ไม่เพี้ยน (ดู docs/09 section 5.2)
