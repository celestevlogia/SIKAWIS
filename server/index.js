import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuid } from "uuid";
import { GoogleGenAI } from "@google/genai";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, "data", "db.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(path.dirname(DB_PATH), {recursive:true});
fs.mkdirSync(UPLOAD_DIR, {recursive:true});

const seed = {
  users: [],
  students: [{
    userId:"u-student", nim:"2202110001", name:"Celine Gracia", program:"Informatika", semester:8,
    sks:138, courses:"Skripsi 2, Metodologi Penelitian, Etika Profesi",
    requirements:{facDay:[null,null,null,null],pkkmb:false,publication:false,skripsi2:false,spt:false},
    reviews:{kaprodi:"Belum diajukan",yudisium:"Menunggu",bo:"Menunggu",admin:"Menunggu"},
    notes:"",togaSize:"",waist:"",seat:"",depositStatus:"Belum dibayar",approved:false
  }],
  settings:{requirements:["1. 4 Sertifikat Faculty Day","2. Bukti PKKMB","3. Publikasi / Hak Cipta (opsional)","4. Bukti Skripsi 2 selesai","5. Surat Permohonan Tamat (SPT)"],graduationYear:"2026"}
};
if (!fs.existsSync(DB_PATH)) {
  const adminHash = await bcrypt.hash("admin123", 10);
  const studentHash = await bcrypt.hash("mahasiswa123", 10);
  seed.users = [
    {id:"u-admin",username:"admin",password:adminHash,role:"admin",name:"Administrator SIKAWIS"},
    {id:"u-student",username:"mahasiswa",password:studentHash,role:"student",name:"Celine Gracia",nim:"2202110001"}
  ];
  fs.writeFileSync(DB_PATH, JSON.stringify(seed,null,2));
}
const readDB = () => JSON.parse(fs.readFileSync(DB_PATH,"utf8"));
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data,null,2));
app.use(cors({origin:"http://localhost:5173"}));
app.use(express.json({limit:"2mb"}));
app.use("/uploads", express.static(UPLOAD_DIR));

function auth(req,res,next) {
  const token = req.headers.authorization?.replace("Bearer ","");
  if (!token) return res.status(401).json({message:"Silakan login terlebih dahulu."});
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me"); next(); }
  catch { return res.status(401).json({message:"Sesi tidak valid. Silakan login kembali."}); }
}
const adminOnly = (req,res,next) => req.user.role === "admin" ? next() : res.status(403).json({message:"Akses khusus admin."});
const safeUser = ({password,...u}) => u;

app.get("/api/health", (_,res)=>res.json({ok:true,service:"SIKAWIS API"}));
app.post("/api/auth/login", async (req,res)=>{
  const {username,password}=req.body;
  const db=readDB(); const user=db.users.find(u=>u.username===username);
  if (!user || !(await bcrypt.compare(password||"",user.password))) return res.status(401).json({message:"Username atau password salah."});
  const token=jwt.sign({id:user.id,role:user.role},process.env.JWT_SECRET||"dev-secret-change-me",{expiresIn:"8h"});
  res.json({token,user:safeUser(user)});
});
app.get("/api/me",auth,(req,res)=>{
  const db=readDB(); const user=db.users.find(u=>u.id===req.user.id);
  if(!user) return res.status(404).json({message:"Akun tidak ditemukan."});
  res.json({user:safeUser(user),student:db.students.find(s=>s.userId===user.id)||null});
});
app.get("/api/student",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  if(!s) return res.status(404).json({message:"Data mahasiswa tidak ditemukan."});
  res.json(s);
});
app.put("/api/student",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  if(!s) return res.status(404).json({message:"Data mahasiswa tidak ditemukan."});
  const {name,nim,program,sks,courses,waist,togaSize}=req.body;
  if((name!==undefined&&!String(name).trim())||(nim!==undefined&&!String(nim).trim())||(program!==undefined&&!String(program).trim())||(courses!==undefined&&!String(courses).trim())) return res.status(400).json({message:"Nama lengkap, NIM, program studi, dan mata kuliah wajib diisi."});
  if(name!==undefined) s.name=String(name).slice(0,120);
  if(nim!==undefined) s.nim=String(nim).slice(0,30);
  if(program!==undefined) s.program=String(program).slice(0,120);
  const account=db.users.find(u=>u.id===req.user.id);
  if(account){if(name!==undefined)account.name=s.name;if(nim!==undefined)account.nim=s.nim;}
  if(sks!==undefined) s.sks=Math.max(0,Number(sks)||0);
  if(courses!==undefined) s.courses=String(courses).slice(0,2000);
  if((waist!==undefined || togaSize!==undefined) && !s.approved) return res.status(403).json({message:"Pemilihan toga tersedia setelah persetujuan akhir admin."});
  if(waist!==undefined) s.waist=String(waist).slice(0,20);
  if(togaSize!==undefined) s.togaSize=String(togaSize).slice(0,10);
  writeDB(db); res.json(s);
});
const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,UPLOAD_DIR),
  filename:(_,file,cb)=>cb(null,uuid()+path.extname(file.originalname).toLowerCase())
});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(_,file,cb)=>{
  const ok=/\.(pdf|png|jpg|jpeg)$/i.test(file.originalname);
  cb(ok?null:new Error("Format file harus PDF, PNG, atau JPG."),ok);
}});
app.post("/api/student/upload/:type/:index?",auth,(req,res)=>{
  upload.single("document")(req,res,(err)=>{
    if(err) return res.status(400).json({message:err.message});
    if(!req.file) return res.status(400).json({message:"File belum dipilih."});
    const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
    const file={name:req.file.originalname,url:`/uploads/${req.file.filename}`};
    const {type,index}=req.params;
    if(type==="facDay"){
      const i=Number(index); if(!Number.isInteger(i)||i<0||i>3) return res.status(400).json({message:"Indeks sertifikat tidak valid."});
      s.requirements.facDay[i]=file;
    } else if(type==="pkkmb") s.requirements.pkkmb=file;
    else if(type==="publication") s.requirements.publication=file;
    else if(type==="skripsi2") s.requirements.skripsi2=file;
    else if(type==="spt") s.requirements.spt=file;
    else return res.status(400).json({message:"Jenis dokumen tidak dikenal."});
    writeDB(db); res.json({message:"Dokumen berhasil diunggah.",student:s});
  });
});
app.delete("/api/student/upload/:type/:index?",auth,(req,res)=>{
  if(req.user.role!=="student") return res.status(403).json({message:"Hanya mahasiswa yang dapat membatalkan upload dokumennya."});
  const db=readDB(); const student=db.students.find(x=>x.userId===req.user.id);
  if(!student) return res.status(404).json({message:"Data mahasiswa tidak ditemukan."});
  const {type,index}=req.params;
  let currentFile=null;
  if(type==="facDay"){
    const i=Number(index);
    if(!Number.isInteger(i)||i<0||i>3) return res.status(400).json({message:"Indeks sertifikat tidak valid."});
    currentFile=student.requirements.facDay?.[i];
    if(!currentFile) return res.status(404).json({message:"Tidak ada file pada bagian ini."});
    student.requirements.facDay[i]=null;
  } else if(["pkkmb","publication","skripsi2","spt"].includes(type)){
    currentFile=student.requirements?.[type];
    if(!currentFile||typeof currentFile!=="object") return res.status(404).json({message:"Tidak ada file pada bagian ini."});
    student.requirements[type]=false;
  } else return res.status(400).json({message:"Jenis dokumen tidak dikenal."});
  if(currentFile?.url){
    const filename=path.basename(currentFile.url);
    const filepath=path.join(UPLOAD_DIR,filename);
    if(fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  writeDB(db);
  res.json({message:"File berhasil dihapus dari pengajuan.",student});
});

app.post("/api/student/consultation",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  const message=String(req.body.message||"").trim();
  if(!message) return res.status(400).json({message:"Pesan konsultasi wajib diisi."});
  s.reviews.kaprodi="Menunggu pemeriksaan Kaprodi"; s.consultation=message.slice(0,1000);
  s.consultationSubmittedAt=new Date().toISOString();
  writeDB(db); res.json({message:"Permohonan konsultasi berhasil dikirim. Status saat ini: Menunggu pemeriksaan Kaprodi. Hasilnya dapat dipantau pada menu Status Verifikasi."});
});
app.post("/api/student/spt",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  const docs=s.requirements||{};
  const facComplete=(docs.facDay||[]).length===4 && docs.facDay.every(Boolean);
  if(!facComplete||!docs.pkkmb||!docs.skripsi2) return res.status(403).json({message:"SPT hanya dapat dibuat setelah 4 sertifikat Faculty Day, bukti PKKMB, dan bukti Skripsi 2 selesai diunggah. Publikasi/Hak Cipta bersifat opsional."});
  s.sptData={address:String(req.body.address||""),phone:String(req.body.phone||""),name:s.name,nim:s.nim,program:s.program,sks:s.sks,date:new Date().toISOString()};
  writeDB(db); res.json({message:"Data SPT berhasil disimpan. Setelah PDF diunduh, salinannya akan tersimpan agar dapat diperiksa admin."});
});

app.post("/api/student/toga-recommendation",auth,async(req,res)=>{
  const raw=req.body.measurements||{};
  const keys=["body","shoulder","sleeve","length"];
  const measurements={};
  for(const key of keys){
    const value=Number(raw[key]);
    if(!Number.isFinite(value)||value<=0||value>250) return res.status(400).json({message:"Semua ukuran tubuh harus diisi dengan angka sentimeter yang valid."});
    measurements[key]=value;
  }
  const sizeGuide=[
    {size:"S",length:102,body:104,shoulder:45,sleeve:57},
    {size:"M",length:104,body:108,shoulder:46,sleeve:58},
    {size:"L",length:108,body:112,shoulder:47,sleeve:59},
    {size:"XL",length:110,body:116,shoulder:48,sleeve:59}
  ];
  const weights={body:1.2,shoulder:1.5,sleeve:1,length:0.8};
  const ranked=sizeGuide.map(row=>{
    const score=keys.reduce((sum,key)=>sum+Math.abs(measurements[key]-row[key])*weights[key],0);
    return {...row,score};
  }).sort((a,b)=>a.score-b.score);
  let selected=ranked[0];
  let reason=`Ukuran ${selected.size} merupakan pilihan yang paling mendekati empat ukuran yang kamu masukkan berdasarkan tabel toga: panjang ${selected.length} cm, lingkar badan ${selected.body} cm, lebar bahu ${selected.shoulder} cm, dan panjang lengan ${selected.sleeve} cm. Perbedaan pengukuran terbesar perlu diperiksa kembali sebelum ukuran ditetapkan.`;
  let source="Perhitungan kecocokan lokal (fallback; Gemini belum dikonfigurasi)";
  if(process.env.GEMINI_API_KEY){
    try{
      const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model=genAI.getGenerativeModel({model:process.env.GEMINI_MODEL||"gemini-2.5-flash"});
      const result=await model.generateContent(`Kamu adalah asisten rekomendasi ukuran toga. Pilih SATU ukuran terbaik hanya dari S, M, L, XL berdasarkan empat ukuran mahasiswa dan tabel resmi. Pertimbangkan selisih tiap dimensi; jangan mengarang ukuran di luar tabel. Ukuran pakaian/toga adalah ukuran jadi, bukan ukuran tubuh, jadi jika ada selisih atau data yang tidak lazim, jelaskan perlunya fitting/konfirmasi petugas. Kembalikan JSON valid saja tanpa markdown dengan format {"size":"S","reason":"alasan dalam Bahasa Indonesia"}.\\nPengukuran mahasiswa dalam cm: ${JSON.stringify(measurements)}\\nTabel resmi: ${JSON.stringify(sizeGuide)}`);
      const rawText=result.response.text().trim().replace(/^```(?:json)?\\s*/i,"").replace(/\\s*```$/,"");
      const parsed=JSON.parse(rawText);
      const aiChoice=sizeGuide.find(row=>row.size===String(parsed.size||"").toUpperCase());
      if(aiChoice && typeof parsed.reason==="string" && parsed.reason.trim()){
        selected=aiChoice;reason=parsed.reason.trim();source="Google Gemini AI (dibatasi tabel ukuran resmi)";
      }
    }catch(error){console.error("Gemini toga error:",error.message);}
  }
  const recommendation={size:selected.size,reason,source,measurements,guide:{length:selected.length,body:selected.body,shoulder:selected.shoulder,sleeve:selected.sleeve},createdAt:new Date().toISOString()};
  const db=readDB();const student=db.students.find(x=>x.userId===req.user.id);
  if(!student)return res.status(404).json({message:"Data mahasiswa tidak ditemukan."});
  if(!student.approved)return res.status(403).json({message:"Rekomendasi ukuran toga hanya tersedia setelah persetujuan admin."});
  student.togaRecommendation=recommendation;student.togaSize=selected.size;student.togaConfirmed=false;student.togaConfirmedAt=null;writeDB(db);
  res.json({recommendation});
});
app.post("/api/student/toga-confirm",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  if(!s) return res.status(404).json({message:"Data mahasiswa tidak ditemukan."});
  if(!s.approved) return res.status(403).json({message:"Konfirmasi ukuran toga hanya tersedia setelah persetujuan admin."});
  const size=String(req.body.size||"").toUpperCase();
  if(!["S","M","L","XL"].includes(size) || !s.togaRecommendation || s.togaRecommendation.size!==size) return res.status(400).json({message:"Buat rekomendasi ukuran toga terlebih dahulu sebelum mengonfirmasi."});
  s.togaSize=size;s.togaConfirmed=true;s.togaConfirmedAt=new Date().toISOString();
  writeDB(db);res.json({message:"Ukuran toga berhasil dikonfirmasi.",size});
});
app.post("/api/student/deposit-return",auth,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.user.id);
  if(!s?.togaConfirmed) return res.status(403).json({message:"Konfirmasi ukuran toga terlebih dahulu pada menu Ukuran Toga sebelum mengajukan pengembalian."});
  if(String(s.depositStatus||"").trim().toLowerCase()==="sudah dibayar") return res.status(403).json({message:"Status deposit sudah dibayar. Pengajuan pengembalian toga tidak dapat dilakukan lagi."});
  s.depositStatus="Menunggu konfirmasi admin"; writeDB(db); res.json({message:"Pengajuan pengembalian toga berhasil dikirim. Admin akan memeriksa pengembalian dan deposit."});
});

app.get("/api/admin/overview",auth,adminOnly,(_,res)=>{
  const db=readDB(); const students=db.students;
  res.json({total:students.length,approved:students.filter(s=>s.approved).length,pending:students.filter(s=>!s.approved).length,students,settings:db.settings});
});
app.put("/api/admin/student/:id/review",auth,adminOnly,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.params.id);
  if(!s) return res.status(404).json({message:"Mahasiswa tidak ditemukan."});
  const {stage,status,notes}=req.body;
  if(!["kaprodi","yudisium","bo","admin"].includes(stage)) return res.status(400).json({message:"Tahap tidak valid."});
  if(stage==="admin" && status==="Disetujui"){
    const docs=s.requirements||{};
    const facComplete=(docs.facDay||[]).length===4 && docs.facDay.every(Boolean);
    if(s.reviews.yudisium!=="Disetujui" || s.reviews.bo!=="Disetujui" || !facComplete || !docs.pkkmb || !docs.skripsi2 || !docs.spt){
      return res.status(400).json({message:"Belum dapat disetujui: pastikan yudisium, BO, 4 sertifikat Faculty Day, PKKMB, Skripsi 2, dan SPT sudah lengkap. Publikasi/Hak Cipta bersifat opsional."});
    }
  }
  s.reviews[stage]=status; if(notes!==undefined)s.notes=String(notes).slice(0,1000);
  if(stage==="admin") s.approved=status==="Disetujui";
  writeDB(db); res.json(s);
});
app.put("/api/admin/student/:id/seat",auth,adminOnly,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.params.id);
  if(!s) return res.status(404).json({message:"Mahasiswa tidak ditemukan."});
  s.seat=String(req.body.seat||"").slice(0,20); writeDB(db); res.json(s);
});
app.put("/api/admin/student/:id/deposit",auth,adminOnly,(req,res)=>{
  const db=readDB(); const s=db.students.find(x=>x.userId===req.params.id);
  if(!s) return res.status(404).json({message:"Mahasiswa tidak ditemukan."});
  s.depositStatus=String(req.body.status||""); writeDB(db); res.json(s);
});
app.put("/api/admin/settings",auth,adminOnly,(req,res)=>{
  const db=readDB(); db.settings={...db.settings,...req.body}; writeDB(db); res.json(db.settings);
});
app.post("/api/admin/student",auth,adminOnly,async(req,res)=>{
  const {username,password,name,nim,program}=req.body;
  if(!username||!password||!name||!nim) return res.status(400).json({message:"Nama, NIM, username, dan password wajib diisi."});
  const db=readDB(); if(db.users.some(u=>u.username===username)) return res.status(409).json({message:"Username sudah digunakan."});
  const id=uuid(); db.users.push({id,username,password:await bcrypt.hash(password,10),role:"student",name,nim});
  db.students.push({userId:id,nim,name,program:program||"Informatika",semester:1,sks:0,courses:"",requirements:{facDay:[null,null,null,null],pkkmb:false,publication:false,skripsi2:false,spt:false},reviews:{kaprodi:"Belum diajukan",yudisium:"Menunggu",bo:"Menunggu",admin:"Menunggu"},notes:"",togaSize:"",waist:"",seat:"",depositStatus:"Belum dibayar",approved:false});
  writeDB(db); res.status(201).json({message:"Akun mahasiswa berhasil dibuat."});
});

const faq = `Informasi SIKAWIS:
- Persyaratan: empat sertifikat Faculty Day, PKKMB, Skripsi 2 selesai, dan SPT. Publikasi/Hak Cipta bersifat opsional.
- Alur: pengisian data akademik, pemenuhan dokumen, yudisium, verifikasi keuangan BO, persetujuan admin, pemilihan toga, seating, dan pengembalian toga.
- Dokumen dapat diunggah dalam PDF, PNG, atau JPG dengan ukuran maksimal 5 MB.
- Ukuran toga dipilih berdasarkan lingkar perut. Hubungi admin jika ukuran tidak tersedia.
- Chatbot tidak dapat menyetujui kelulusan atau mengubah status administrasi.`;
app.post("/api/chat",auth,async(req,res)=>{
  const question=String(req.body.message||"").slice(0,1500);
  if(!question.trim()) return res.status(400).json({message:"Tuliskan pertanyaan terlebih dahulu."});
  if(process.env.GEMINI_API_KEY){
    try{
      const genAI=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      const result=await genAI.models.generateContent({
        model:process.env.GEMINI_MODEL||"gemini-2.5-flash",
        contents:`Kamu adalah asisten informasi SIKAWIS. Jawab dalam Bahasa Indonesia, ringkas, sopan, dan hanya berdasarkan konteks berikut. Jika informasi tidak tersedia, arahkan mahasiswa menghubungi admin. Jangan pernah mengarang status personal, menyetujui kelulusan, atau mengubah data.\n\n${faq}\n\nPertanyaan: ${question}`
      });
      return res.json({answer:result.text,source:"Gemini AI"});
    }catch(e){console.error("Gemini error:",e.message);}
  }
  const q=question.toLowerCase();
  let answer="Saya belum menemukan jawaban spesifik untuk pertanyaan itu. Silakan hubungi admin akademik agar memperoleh informasi resmi.";
  if(q.includes("fac")||q.includes("sertifikat")) answer="Mahasiswa perlu mengunggah 4 sertifikat Faculty Day. Format file yang diterima PDF, PNG, atau JPG dengan ukuran maksimal 5 MB per file.";
  else if(q.includes("pkkmb")) answer="PKKMB merupakan salah satu persyaratan tamat. Pastikan bukti pemenuhannya sudah diunggah atau dikonfirmasi sesuai arahan admin.";
  else if(q.includes("publikasi")||q.includes("hak cipta")) answer="Publikasi/Hak Cipta ditandai sebagai persyaratan opsional pada rancangan sistem ini. Kebijakan final tetap mengikuti ketentuan program studi.";
  else if(q.includes("skripsi")) answer="Persyaratan tamat mencantumkan Skripsi 2 harus selesai. Jika status belum selesai, konsultasikan dengan dosen pembimbing atau program studi.";
  else if(q.includes("spt")) answer="SPT adalah Surat Permohonan Tamat. Isi data yang diminta pada menu SPT, lalu ajukan sesuai prosedur kampus.";
  else if(q.includes("bo")||q.includes("keuangan")) answer="Verifikasi BO adalah tahap pemeriksaan keuangan setelah yudisium. Statusnya dapat dipantau pada halaman Status Verifikasi.";
  else if(q.includes("toga")||q.includes("ukuran")) answer="Pemilihan ukuran toga dilakukan setelah persetujuan administrasi. Masukkan lingkar perut sesuai pengukuran dan pilih ukuran yang tersedia.";
  else if(q.includes("seating")||q.includes("kursi")) answer="Nomor tempat duduk wisuda akan ditampilkan pada menu Seating setelah admin menetapkan nomor kursi.";
  else if(q.includes("deposit")||q.includes("pengembalian")) answer="Setelah wisuda, ajukan pengembalian toga melalui menu Pengembalian Toga. Admin akan mengonfirmasi penerimaan toga dan status deposit.";
  else if(q.includes("alur")||q.includes("tahapan")) answer="Alur umum: data akademik → dokumen dan SPT → yudisium → verifikasi BO → persetujuan admin → pemilihan toga → seating → pengembalian toga.";
  res.json({answer,source:"FAQ lokal"});
});
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:"Terjadi kesalahan pada server."});});
app.listen(PORT,()=>console.log(`SIKAWIS API berjalan di http://localhost:${PORT}`));
