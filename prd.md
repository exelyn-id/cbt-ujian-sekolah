# PRD --- Web App Ujian Berbasis Google Apps Script + Google Sheets

**Versi:** 1.0\
**Status:** Ready for AI-agent implementation\
**Platform:** Google Apps Script Web App\
**File aplikasi:** `Code.gs` + `index.html`\
**Database:** Google Spreadsheet\
**Scope:** 1 sekolah, banyak guru, banyak peserta/siswa\
**UI:** Responsive/mobile-first

------------------------------------------------------------------------

## 1. Ringkasan Produk

Web App Ujian adalah aplikasi ujian online berbasis Google Apps Script
yang menggunakan satu Google Spreadsheet sebagai database utama.
Aplikasi memiliki dua sisi:

1.  **Dashboard Guru** --- guru login menggunakan username + password,
    membuat dan mengelola ujian, membuat soal, menentukan skor, mengatur
    konfigurasi ujian, memperoleh link unik untuk setiap ujian, serta
    melihat dan mengekspor hasil.
2.  **Halaman Peserta/Siswa** --- peserta mengakses link ujian tanpa
    login, mengisi identitas, membaca petunjuk, mengerjakan soal,
    memperoleh autosave, mengikuti timer, lalu mengirim ujian.

Aplikasi harus mendukung tiga tipe soal:

-   Pilihan Ganda
-   Pilihan Ganda Kompleks
-   Benar/Salah

Semua tipe soal dinilai otomatis. Nilai akhir dinormalisasi ke skala
**0--100**.

Setiap guru hanya dapat mengelola ujian miliknya sendiri. Guru juga
otomatis dianggap sebagai administrator terhadap data yang berkaitan
dengan akun dan ujian yang ia buat karena mereka memegang Spreadsheet.

------------------------------------------------------------------------

# 2. Tujuan Produk

## 2.1 Tujuan utama

-   Memudahkan guru membuat ujian online tanpa server/database
    eksternal.
-   Memungkinkan banyak guru menggunakan aplikasi yang sama.
-   Memungkinkan setiap materi/ujian memiliki link unik.
-   Memungkinkan guru menentukan sendiri struktur soal, skor, KKM,
    durasi, percobaan, pengacakan, dan tampilan hasil.
-   Menyimpan seluruh data pada Google Spreadsheet.
-   Menyediakan rekap hasil yang mudah dianalisis.
-   Mendukung gambar pada pertanyaan maupun opsi jawaban.
-   Mendukung import soal melalui Spreadsheet template.
-   Tetap mudah dipasang dengan hanya dua file Apps Script.

## 2.2 Non-goals versi 1

Tidak termasuk:

-   Role admin sekolah terpisah.
-   Role orang tua.
-   Role siswa dengan akun/password.
-   Essay/subjektif.
-   Penilaian manual.
-   Database SQL/Firebase.
-   Sistem pembayaran.
-   Integrasi LMS eksternal.
-   Aplikasi Android/iOS native.

------------------------------------------------------------------------

# 3. Prinsip Arsitektur

## 3.1 Constraint utama

Source code aplikasi hanya terdiri dari:

``` text
Code.gs
index.html
```

Jangan membuat file `.html`, `.js`, `.css`, library frontend lokal, atau
file Apps Script lain.

CSS dan JavaScript frontend harus berada di dalam `index.html`.

Backend seluruhnya berada di `Code.gs`.

Google Spreadsheet menjadi database.

Google Drive digunakan sebagai penyimpanan file/gambar yang diunggah.

## 3.2 Prinsip keamanan

-   Password guru tidak boleh dikirim atau ditampilkan ke frontend lebih
    dari yang diperlukan untuk proses login.
-   Password tidak boleh ditulis ke log.
-   Setiap operasi backend harus memverifikasi session/authentication.
-   Guru hanya boleh membaca/mengubah data ujian yang
    `ownerTeacherId`-nya sama dengan identitas guru yang sedang login.
-   Peserta tidak memiliki akses ke dashboard.
-   Endpoint publik ujian hanya boleh mengakses data ujian yang
    berstatus aktif dan ID-nya valid.
-   Jangan mempercayai `teacherId`, `examId`, `score`, `answerKey`, atau
    nilai yang dikirim frontend. Backend harus mengambil data master
    dari Spreadsheet dan menghitung nilai sendiri.
-   ID ujian dan submission harus menggunakan ID unik yang sulit
    ditebak.
-   Validasi server-side wajib dilakukan walaupun validasi frontend
    sudah ada.

------------------------------------------------------------------------

# 4. Aktor Sistem

## 4.1 Guru

Guru dapat:

-   Login.
-   Melihat dashboard miliknya.
-   Membuat ujian.
-   Mengedit ujian.
-   Menghapus/menonaktifkan ujian.
-   Menggandakan ujian.
-   Membuat soal.
-   Mengedit soal.
-   Menghapus soal.
-   Mengatur skor per soal.
-   Mengatur KKM.
-   Mengatur durasi.
-   Mengatur jumlah percobaan.
-   Mengatur metode nilai ketika percobaan lebih dari satu.
-   Mengaktifkan pengacakan soal.
-   Mengaktifkan pengacakan opsi.
-   Mengatur apakah peserta melihat hasil.
-   Melihat link ujian.
-   Melihat rekap peserta.
-   Melihat detail jawaban.
-   Mengekspor hasil ke Excel.
-   Import soal melalui template Spreadsheet.

## 4.2 Peserta/Siswa

Peserta:

-   Tidak login.
-   Membuka link ujian.
-   Mengisi nama, kelas, dan NIS.
-   Membaca informasi ujian.
-   Memulai ujian.
-   Menjawab soal.
-   Melihat countdown timer.
-   Mengandalkan autosave.
-   Mengirim ujian.
-   Melihat hasil jika konfigurasi ujian mengizinkannya.

------------------------------------------------------------------------

# 5. User Flow Guru

``` text
Buka Web App
    ↓
Pilih/Login sebagai Guru
    ↓
Username + Password
    ↓
Validasi backend
    ↓
Dashboard Guru
    ↓
Lihat daftar ujian milik guru
    ↓
[Tambah Ujian]
    ↓
Isi konfigurasi ujian
    ↓
Simpan
    ↓
Buat/manage soal
    ↓
Publish/Aktifkan ujian
    ↓
Generate link unik
    ↓
Salin/bagikan link
    ↓
Peserta mengerjakan
    ↓
Guru melihat rekap
    ↓
Guru melihat detail
    ↓
Export Excel
```

------------------------------------------------------------------------

# 6. User Flow Peserta

``` text
Membuka link unik ujian
    ↓
Backend memvalidasi examId
    ↓
Halaman informasi ujian
    ↓
Isi Nama + Kelas + NIS
    ↓
Validasi identitas
    ↓
Klik Mulai Ujian
    ↓
Buat submission/attempt
    ↓
Timer dimulai
    ↓
Kerjakan soal
    ↓
Autosave jawaban
    ↓
Submit manual / timer habis
    ↓
Backend menghitung skor
    ↓
Simpan hasil
    ↓
Tampilkan halaman hasil atau status
```

------------------------------------------------------------------------

# 7. Struktur URL

Base URL mengikuti deployment Google Apps Script.

Gunakan query parameter untuk membedakan mode:

### Dashboard guru

``` text
/exec
```

atau:

``` text
/exec?mode=teacher
```

### Ujian peserta

``` text
/exec?exam=EXAM_UNIQUE_ID
```

Contoh:

``` text
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?exam=EXM_8FJ2K9
```

`exam` adalah ID unik ujian, bukan judul ujian.

------------------------------------------------------------------------

# 8. Modul Dashboard Guru

Dashboard minimal terdiri dari:

1.  Login
2.  Dashboard overview
3.  Daftar ujian
4.  Buat ujian
5.  Edit ujian
6.  Detail/manage ujian
7.  Question builder
8.  Import soal
9.  Link ujian
10. Rekap hasil
11. Detail peserta
12. Pengaturan akun/session
13. Logout

------------------------------------------------------------------------

# 9. Login Guru

## Input

-   Username
-   Password

## Backend

Cari username pada sheet `Users`.

Validasi:

-   username ada
-   akun aktif
-   password cocok

Jika berhasil:

-   buat session
-   simpan session secara aman
-   frontend memperoleh informasi minimal:
    -   teacherId
    -   teacherName
    -   role

Jangan mengirim password ke frontend.

## Session

Session harus memiliki:

-   sessionId
-   teacherId
-   createdAt
-   expiresAt

Session timeout disarankan 6--12 jam.

Gunakan `CacheService` atau mekanisme server-side yang sesuai untuk
session.

Logout harus menghapus/invalidate session.

------------------------------------------------------------------------

# 10. Dashboard Overview

Dashboard menampilkan kartu:

-   Total ujian
-   Ujian aktif
-   Total peserta
-   Total submission
-   Rata-rata nilai
-   Nilai tertinggi
-   Nilai terendah
-   Jumlah lulus
-   Jumlah belum lulus

Data hanya berasal dari ujian guru yang sedang login.

Tambahkan daftar:

### Ujian terbaru

Kolom:

  Kolom
  ----------------
  Judul
  Mata Pelajaran
  Materi
  Kelas
  Status
  Jumlah Soal
  Peserta
  Rata-rata
  Link
  Aksi

------------------------------------------------------------------------

# 11. CRUD Ujian

Guru dapat:

-   Create
-   Read
-   Update
-   Delete/Archive
-   Duplicate
-   Activate
-   Deactivate

## 11.1 Field Ujian

Minimal:

  Field                        Required
  ---------------------------- -----------------------------
  Judul Ujian                  Ya
  Mata Pelajaran               Ya
  Materi                       Ya
  Kelas                        Ya
  Deskripsi                    Tidak
  Petunjuk                     Tidak
  Durasi (menit)               Ya
  Tanggal Mulai                Ya/tidak sesuai konfigurasi
  Tanggal Berakhir             Ya/tidak sesuai konfigurasi
  KKM                          Ya
  Maksimal Percobaan           Ya
  Metode nilai multi-attempt   Ya jika \>1
  Acak Soal                    Ya
  Acak Opsi                    Ya
  Tampilkan Hasil              Ya
  Status                       Ya

## 11.2 Status

Gunakan:

``` text
DRAFT
ACTIVE
INACTIVE
ARCHIVED
```

`DRAFT` belum dapat dikerjakan.

`ACTIVE` dapat dikerjakan jika syarat tanggal terpenuhi.

`INACTIVE` tidak dapat dikerjakan.

`ARCHIVED` tidak muncul pada daftar utama.

------------------------------------------------------------------------

# 12. Link Ujian

Setiap ujian mendapatkan:

``` text
examId
```

Format contoh:

``` text
EXM_7H3K9Q2M
```

ID harus unik.

Link:

``` text
BASE_URL?exam=EXM_7H3K9Q2M
```

Dashboard menyediakan tombol:

-   Copy Link
-   Open Exam
-   Share/lihat link

Jangan menggunakan judul ujian sebagai ID.

------------------------------------------------------------------------

# 13. Question Builder

Guru dapat membuat soal satu per satu.

Setiap soal memiliki:

-   questionId
-   examId
-   nomor/urutan
-   tipe soal
-   pertanyaan
-   gambar pertanyaan
-   skor
-   opsi jawaban
-   jawaban benar
-   status

## Tipe

``` text
MCQ
MCQ_COMPLEX
TRUE_FALSE
```

------------------------------------------------------------------------

# 14. Pilihan Ganda

Guru menentukan jumlah opsi.

Contoh:

``` text
A
B
C
D
E
```

Jumlah minimal disarankan 2.

Jumlah maksimum dapat ditetapkan 10.

Setiap opsi memiliki:

-   optionId
-   label
-   text
-   imageUrl

Guru menentukan satu jawaban benar.

Contoh:

``` text
Correct answer = C
Score = 10
```

------------------------------------------------------------------------

# 15. Pilihan Ganda Kompleks

Guru dapat menentukan lebih dari satu jawaban benar.

Contoh:

``` text
A = benar
B = salah
C = benar
D = benar
```

Guru menentukan metode scoring.

### Recommended default: Exact Set

Peserta mendapat skor penuh hanya jika kumpulan jawaban yang dipilih
sama persis dengan kumpulan jawaban benar.

Contoh:

Jawaban benar:

``` text
A + C + D
```

Peserta:

``` text
A + C + D
```

→ skor penuh.

Peserta:

``` text
A + C
```

→ 0.

Peserta:

``` text
A + B + C + D
```

→ 0.

Namun karena kebutuhan menyatakan guru menentukan sendiri, question
builder harus memiliki pilihan:

``` text
Scoring:
[Exact Set]
[Partial Credit]
```

### Partial Credit

Untuk partial credit:

``` text
correctSelected = jumlah jawaban benar yang dipilih
wrongSelected = jumlah jawaban salah yang dipilih
totalCorrect = jumlah jawaban benar

rawRatio = (correctSelected - wrongSelected) / totalCorrect

clamp rawRatio ke 0..1

score = maxScore * rawRatio
```

Contoh:

Skor = 10\
Jawaban benar = A,C,D\
Peserta memilih A,C

ratio = 2/3\
score = 6.67

Jika peserta memilih A,B,C:

correct = 2\
wrong = 1\
ratio = 1/3\
score = 3.33

Guru harus dapat memilih metode per soal.

------------------------------------------------------------------------

# 16. Benar/Salah

Satu soal hanya memiliki satu pernyataan.

Contoh:

> Fotosintesis membutuhkan cahaya.

Opsi:

-   Benar
-   Salah

Guru menentukan:

``` text
correctAnswer = TRUE
```

atau:

``` text
correctAnswer = FALSE
```

Tidak boleh memiliki beberapa pernyataan dalam satu soal.

------------------------------------------------------------------------

# 17. Gambar Soal

Gambar dapat berasal dari:

1.  Upload langsung
2.  URL gambar

## Upload

Guru memilih file gambar.

Backend:

1.  validasi file
2.  upload ke Google Drive
3.  simpan fileId
4.  buat URL akses yang sesuai
5.  simpan URL/fileId ke sheet

Format gambar yang disarankan:

-   JPG/JPEG
-   PNG
-   GIF
-   WEBP

Ukuran maksimum harus dibatasi agar Google Apps Script tidak kelebihan
payload.

Default rekomendasi:

``` text
5 MB/file
```

Jika terlalu besar, tampilkan error.

## Gambar opsi

Setiap opsi juga dapat memiliki gambar.

------------------------------------------------------------------------

# 18. Google Drive

Jangan meminta guru membuat banyak folder secara manual.

Saat setup pertama:

-   script mencari/membuat satu folder utama: `UJIAN_APP_UPLOADS`

Opsional struktur otomatis:

``` text
UJIAN_APP_UPLOADS/
    QUESTIONS/
    EXPORTS/
```

Tidak perlu membuat folder per guru atau per soal.

File ID disimpan di Spreadsheet.

------------------------------------------------------------------------

# 19. Import Soal

Guru dapat memasukkan banyak soal melalui Spreadsheet.

Sistem menyediakan template.

Sheet template:

``` text
Question_Import_Template
```

Kolom:

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  examId     orderNo type   questionText   questionImageUrl     score scoringMethod   optionA   optionAImageUrl   optionB   optionBImageUrl   optionC   optionCImageUrl   optionD   optionDImageUrl   optionE   optionEImageUrl   correctAnswer
  -------- --------- ------ -------------- ------------------ ------- --------------- --------- ----------------- --------- ----------------- --------- ----------------- --------- ----------------- --------- ----------------- ---------------

  -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Untuk MCQ:

``` text
type = MCQ
correctAnswer = C
```

Untuk MCQ_COMPLEX:

``` text
type = MCQ_COMPLEX
correctAnswer = A|C|D
```

Untuk TRUE_FALSE:

``` text
type = TRUE_FALSE
correctAnswer = TRUE
```

`scoringMethod`:

``` text
EXACT
PARTIAL
```

Kolom opsi yang tidak diperlukan boleh kosong.

## Import behavior

Saat import:

1.  Validasi seluruh row.
2.  Laporkan row yang error.
3.  Jangan memasukkan row invalid.
4.  Row valid dapat dimasukkan.
5.  Hindari duplicate import dengan `importBatchId`.
6.  Setelah import, tampilkan ringkasan.

Contoh:

``` text
Berhasil: 27
Gagal: 3

Row 8: tipe tidak valid
Row 17: jawaban benar kosong
Row 22: score harus berupa angka
```

------------------------------------------------------------------------

# 20. Halaman Informasi Ujian Peserta

Sebelum mulai:

``` text
UJIAN MATEMATIKA
Persamaan Kuadrat

Mata Pelajaran: Matematika
Kelas: XII
Jumlah Soal: 30
Durasi: 60 Menit
KKM: 75

Petunjuk:
1. Bacalah soal dengan teliti.
2. Pastikan koneksi internet stabil.
3. Jawaban tersimpan otomatis.
4. Setelah waktu habis, ujian otomatis dikumpulkan.

[Nama]
[Kelas]
[NIS]

[ MULAI UJIAN ]
```

Validasi:

-   Nama tidak kosong.
-   Kelas tidak kosong.
-   NIS tidak kosong.

------------------------------------------------------------------------

# 21. Identitas Peserta

Peserta tidak memerlukan akun.

Field:

``` text
participantName
className
nis
```

Disimpan bersama setiap attempt.

Backend harus melakukan sanitasi.

------------------------------------------------------------------------

# 22. Attempt / Percobaan

Setiap peserta yang memulai ujian memperoleh:

``` text
attemptId
```

Format:

``` text
ATT_XXXXXXXX
```

Data attempt:

-   attemptId
-   examId
-   participantName
-   className
-   NIS
-   startedAt
-   deadlineAt
-   submittedAt
-   status
-   attemptNumber
-   score
-   percentage
-   passStatus

Status:

``` text
IN_PROGRESS
SUBMITTED
AUTO_SUBMITTED
EXPIRED
```

------------------------------------------------------------------------

# 23. Multiple Attempt

Guru menentukan:

``` text
maxAttempts
```

Contoh:

``` text
1
2
3
5
dst.
```

Jika lebih dari satu attempt, guru memilih:

``` text
HIGHEST
LATEST
AVERAGE
```

Nilai akhir peserta mengikuti metode tersebut.

Jika `maxAttempts = 1`, tidak ada pilihan ulang.

Backend harus menghitung jumlah attempt berdasarkan data server, bukan
parameter dari browser.

------------------------------------------------------------------------

# 24. Timer

Timer dimulai saat attempt dibuat oleh server.

Jangan mengandalkan waktu JavaScript browser sebagai sumber kebenaran.

Server menyimpan:

``` text
startedAt
deadlineAt
```

Frontend menampilkan countdown berdasarkan `deadlineAt`.

Saat waktu habis:

1.  frontend mencoba submit otomatis;
2.  backend tetap memeriksa waktu;
3.  jika deadline sudah lewat, backend dapat menandai `AUTO_SUBMITTED`;
4.  jawaban terakhir yang telah tersimpan digunakan untuk scoring.

Jika peserta menutup browser, attempt tetap memiliki deadline.

------------------------------------------------------------------------

# 25. Autosave

Autosave wajib.

Setiap perubahan jawaban:

``` text
Frontend
    ↓
debounce 500–1500ms
    ↓
saveAnswers()
    ↓
Backend
    ↓
validasi attempt
    ↓
simpan
```

Jangan memanggil server pada setiap perubahan checkbox secara berlebihan
tanpa debounce/batching.

Lebih baik mengirim kumpulan jawaban:

``` json
{
  "attemptId": "...",
  "answers": {
    "Q001": "B",
    "Q002": ["A","C"],
    "Q003": "TRUE"
  }
}
```

## Local backup

Selain server autosave, frontend dapat menggunakan `localStorage` untuk
backup sementara.

Saat reconnect:

-   sinkronkan jawaban terbaru.
-   server tetap menjadi sumber kebenaran utama.

------------------------------------------------------------------------

# 26. Anti Double Submit

Saat submit:

1.  tampilkan confirmation.
2.  disable tombol submit.
3.  backend melakukan lock.
4.  backend memeriksa status attempt.
5.  Jika sudah submitted, jangan hitung ulang sebagai submission baru.
6.  Gunakan `LockService` untuk mencegah race condition.

------------------------------------------------------------------------

# 27. Navigasi Soal

Mobile-first.

Gunakan:

-   nomor soal
-   Next
-   Previous
-   status sudah dijawab
-   status belum dijawab

Contoh:

``` text
[1] [2] [3] [4] [5]
[6] [7] [8] [9] [10]
```

Warna/status jangan hanya mengandalkan warna; gunakan indikator visual
tambahan.

------------------------------------------------------------------------

# 28. Pengacakan

Guru dapat mengaktifkan:

### Randomize Questions

Urutan soal diacak per attempt.

### Randomize Options

Urutan opsi diacak per attempt.

Penting:

Urutan yang ditampilkan harus disimpan pada attempt agar ketika peserta
reload, urutan tetap sama.

Jangan mengacak ulang setiap kali halaman dibuka.

------------------------------------------------------------------------

# 29. Scoring Engine

Scoring harus dilakukan **di backend Code.gs**.

Frontend tidak boleh menentukan nilai final.

## 29.1 Skor soal

Setiap soal memiliki:

``` text
maxScore
```

## 29.2 Skor raw

``` text
rawScore = sum(score setiap soal)
```

## 29.3 Maximum raw score

``` text
maxRawScore = sum(maxScore semua soal)
```

## 29.4 Nilai 0--100

``` text
finalScore = (rawScore / maxRawScore) * 100
```

Jika maxRawScore = 0:

``` text
finalScore = 0
```

Pembulatan disarankan 2 digit desimal.

------------------------------------------------------------------------

# 30. KKM

Guru menentukan KKM, misalnya:

``` text
75
```

Status:

``` text
finalScore >= KKM
```

→ `LULUS`

Selain itu:

→ `BELUM LULUS`

Simpan keduanya:

``` text
score
passStatus
```

agar histori tetap konsisten jika KKM ujian berubah kemudian.

------------------------------------------------------------------------

# 31. Penilaian MCQ

Jika benar:

``` text
questionScore = maxScore
```

Jika salah:

``` text
questionScore = 0
```

Tidak ada penalti kecuali konsep tersebut nanti dikembangkan sebagai
fitur terpisah.

------------------------------------------------------------------------

# 32. Penilaian True/False

Jika jawaban peserta sama dengan correctAnswer:

``` text
maxScore
```

Jika berbeda:

``` text
0
```

------------------------------------------------------------------------

# 33. Penilaian MCQ Complex

Implementasikan metode:

### EXACT

``` text
selectedSet == correctSet
```

Jika sama:

``` text
maxScore
```

Jika berbeda:

``` text
0
```

### PARTIAL

Gunakan:

``` text
correctSelected = intersection(selected, correct).length
wrongSelected = selected.length - correctSelected
totalCorrect = correct.length

ratio = (correctSelected - wrongSelected) / totalCorrect
ratio = clamp(ratio, 0, 1)

score = maxScore * ratio
```

Hasil dapat berupa desimal.

------------------------------------------------------------------------

# 34. Hasil Peserta

Jika guru mengaktifkan `showResult = true`, peserta melihat:

``` text
UJIAN SELESAI

Nama: Budi
Nilai: 82.50
KKM: 75
Status: LULUS

Benar: 24
Salah: 6
```

Angka benar/salah harus mengikuti definisi scoring yang konsisten. Untuk
MCQ complex, sediakan perhitungan detail bila diperlukan; jangan
menyamakan setiap opsi benar dengan satu "soal benar".

Jika `showResult = false`:

``` text
Ujian berhasil dikumpulkan.
Hasil akan diinformasikan oleh guru.
```

------------------------------------------------------------------------

# 35. Rekap Guru

Guru dapat memilih ujian.

Tampilkan:

-   Judul
-   Mata pelajaran
-   Materi
-   Kelas
-   Jumlah soal
-   Durasi
-   KKM
-   Status
-   Link
-   Total peserta
-   Total submission
-   Rata-rata
-   Nilai tertinggi
-   Nilai terendah
-   Lulus
-   Belum lulus

------------------------------------------------------------------------

# 36. Tabel Hasil Peserta

Kolom minimal:

  Kolom
  ---------------
  No
  Nama
  NIS
  Kelas
  Attempt
  Mulai
  Selesai
  Durasi aktual
  Raw Score
  Max Score
  Nilai
  KKM
  Status
  Detail

Fitur:

-   Search
-   Filter kelas
-   Filter status
-   Sort nilai
-   Sort nama
-   Pagination jika data banyak

------------------------------------------------------------------------

# 37. Detail Hasil Peserta

Guru dapat melihat:

``` text
Nama
NIS
Kelas
Ujian
Attempt
Waktu mulai
Waktu selesai
Nilai
Status
```

Kemudian daftar soal:

  No   Soal   Jawaban Siswa   Kunci     Skor Maks   Skor Diperoleh
  ---- ------ --------------- ------- ----------- ----------------

Gambar harus ditampilkan bila tersedia.

Untuk MCQ Complex tampilkan:

``` text
Dipilih: A, C
Benar: A, C, D
```

------------------------------------------------------------------------

# 38. Export Excel

Guru dapat mengekspor hasil satu ujian.

Karena Apps Script tidak boleh bergantung pada library eksternal,
pendekatan yang disarankan:

1.  Generate Spreadsheet sementara atau file `.xlsx`.
2.  Isi hasil.
3.  Export ke Excel menggunakan mekanisme Google Apps Script yang
    tersedia.
4.  Simpan file export ke folder Drive `EXPORTS`.
5.  Berikan link download/open kepada guru.

Jika implementasi `.xlsx` langsung terlalu berat untuk batasan Apps
Script, fallback resmi:

-   buat Google Spreadsheet export
-   sediakan URL export `.xlsx`.

File minimal berisi:

### Sheet `Summary`

-   Judul
-   Mata pelajaran
-   Materi
-   Kelas
-   KKM
-   Jumlah soal
-   Jumlah peserta
-   Rata-rata
-   Tertinggi
-   Terendah

### Sheet `Results`

Data seluruh peserta.

### Sheet `Answer_Detail`

Detail jawaban per peserta dan soal.

------------------------------------------------------------------------

# 39. Struktur Database Spreadsheet

Saat setup pertama, script harus otomatis membuat sheet yang diperlukan.

## Sheet: `Users`

  Kolom
  -----------
  userId
  username
  password
  name
  status
  createdAt
  updatedAt

Catatan keamanan: versi sederhana dapat menggunakan password pada
Spreadsheet karena requirement meminta username/password disimpan di
Spreadsheet. Namun implementasi sebaiknya mendukung hash password jika
memungkinkan. Jangan pernah mengekspos kolom password ke frontend.

------------------------------------------------------------------------

## Sheet: `Exams`

  Kolom
  --------------------
  examId
  ownerTeacherId
  title
  subject
  material
  className
  description
  instructions
  durationMinutes
  startAt
  endAt
  kkm
  maxAttempts
  attemptScoring
  randomizeQuestions
  randomizeOptions
  showResult
  status
  createdAt
  updatedAt

`attemptScoring`:

``` text
HIGHEST
LATEST
AVERAGE
```

------------------------------------------------------------------------

## Sheet: `Questions`

  Kolom
  ------------------
  questionId
  examId
  orderNo
  type
  questionText
  questionImageUrl
  score
  scoringMethod
  correctAnswer
  optionsJson
  createdAt
  updatedAt
  status

`optionsJson` digunakan agar arsitektur tetap sederhana dalam dua file.

Contoh:

``` json
[
  {"id":"A","text":"...","imageUrl":"..."},
  {"id":"B","text":"...","imageUrl":"..."},
  {"id":"C","text":"...","imageUrl":"..."},
  {"id":"D","text":"...","imageUrl":"..."}
]
```

------------------------------------------------------------------------

## Sheet: `Attempts`

  Kolom
  -------------------
  attemptId
  examId
  participantName
  className
  nis
  attemptNumber
  startedAt
  deadlineAt
  submittedAt
  status
  rawScore
  maxRawScore
  finalScore
  kkm
  passStatus
  questionOrderJson
  optionOrderJson
  createdAt
  updatedAt

------------------------------------------------------------------------

## Sheet: `Answers`

  Kolom
  ------------
  answerId
  attemptId
  examId
  questionId
  answerJson
  savedAt
  finalScore
  isCorrect
  maxScore

`answerJson` memungkinkan:

MCQ:

``` json
"B"
```

MCQ complex:

``` json
["A","C"]
```

TRUE_FALSE:

``` json
"TRUE"
```

------------------------------------------------------------------------

## Sheet: `Question_Import_Template`

Digunakan sebagai template import.

------------------------------------------------------------------------

## Sheet: `Settings`

Berisi konfigurasi aplikasi:

  Key                Value
  ------------------ ---------------
  APP_NAME           Web App Ujian
  UPLOAD_FOLDER_ID   ...
  EXPORT_FOLDER_ID   ...
  CREATED_AT         ...
  VERSION            1.0

------------------------------------------------------------------------

## Sheet: `Logs`

Opsional tetapi disarankan.

  Kolom
  ------------
  timestamp
  actorType
  actorId
  action
  targetType
  targetId
  status
  message

Jangan menyimpan password atau jawaban sensitif secara berlebihan.

------------------------------------------------------------------------

# 40. Relasi Data

``` text
Users
  │
  └──< Exams
         │
         └──< Questions
         │
         └──< Attempts
                  │
                  └──< Answers
```

Satu guru:

``` text
1 User → N Exams
```

Satu ujian:

``` text
1 Exam → N Questions
1 Exam → N Attempts
```

Satu attempt:

``` text
1 Attempt → N Answers
```

------------------------------------------------------------------------

# 41. Fungsi Backend `Code.gs`

Implementasi harus modular walaupun hanya satu file.

Kelompok fungsi:

## Entry

``` javascript
doGet(e)
```

## Setup

``` javascript
setupApp()
getOrCreateSheet()
getOrCreateUploadFolder()
initializeHeaders()
```

## Authentication

``` javascript
loginTeacher()
createSession()
validateSession()
logoutTeacher()
```

## Exam

``` javascript
createExam()
getTeacherExams()
getExam()
updateExam()
deleteExam()
duplicateExam()
setExamStatus()
generateExamLink()
```

## Questions

``` javascript
createQuestion()
getQuestions()
updateQuestion()
deleteQuestion()
reorderQuestions()
importQuestions()
validateImportedQuestion()
```

## Upload

``` javascript
uploadImage()
getDriveFileUrl()
```

## Participant

``` javascript
getPublicExam()
startAttempt()
saveAnswers()
getAttemptState()
submitAttempt()
autoSubmitAttempt()
```

## Scoring

``` javascript
calculateQuestionScore()
calculateExamScore()
calculateFinalAttemptScore()
calculateParticipantFinalScore()
```

## Results

``` javascript
getExamSummary()
getExamResults()
getParticipantDetail()
```

## Export

``` javascript
exportExamResults()
```

## Utility

``` javascript
generateId()
getTimestamp()
parseJsonSafe()
sanitizeInput()
normalizeAnswer()
arraysEqual()
```

------------------------------------------------------------------------

# 42. Fungsi Frontend `index.html`

HTML harus memuat:

-   CSS
-   JavaScript
-   halaman login
-   dashboard
-   modal/form
-   question builder
-   exam page
-   result page

Arsitektur frontend disarankan menggunakan state sederhana:

``` javascript
const AppState = {
  mode: null,
  user: null,
  currentExam: null,
  questions: [],
  attempt: null,
  answers: {},
  timer: null
};
```

Navigasi menggunakan view switching, bukan reload halaman penuh bila
memungkinkan.

------------------------------------------------------------------------

# 43. Backend API Contract

Gunakan `google.script.run`.

Contoh:

``` javascript
google.script.run
  .withSuccessHandler(...)
  .withFailureHandler(...)
  .loginTeacher(username, password);
```

Semua fungsi server harus mengembalikan struktur konsisten:

``` javascript
{
  success: true,
  data: {},
  message: ""
}
```

Error:

``` javascript
{
  success: false,
  data: null,
  message: "Pesan error yang aman ditampilkan"
}
```

Jangan mengirim stack trace kepada user.

------------------------------------------------------------------------

# 44. Validasi Ujian

Sebelum ujian diaktifkan:

-   Judul wajib.
-   Mata pelajaran wajib.
-   Materi wajib.
-   Kelas wajib.
-   Durasi \> 0.
-   KKM 0--100.
-   Minimal 1 soal.
-   Setiap soal memiliki skor \> 0.
-   Semua MCQ memiliki minimal 2 opsi.
-   MCQ memiliki tepat satu jawaban benar.
-   MCQ Complex memiliki minimal satu jawaban benar.
-   True/False memiliki jawaban benar.
-   Tidak ada questionId duplicate.
-   `examId` valid.
-   Tanggal mulai/akhir valid jika digunakan.

------------------------------------------------------------------------

# 45. Validasi Jawaban

Backend harus memeriksa:

-   attempt valid.
-   attempt milik exam yang benar.
-   attempt belum submitted.
-   waktu belum melewati deadline atau diproses sebagai auto-submit.
-   questionId memang bagian dari exam.
-   opsi yang dipilih memang opsi valid.
-   MCQ hanya menerima satu opsi.
-   MCQ Complex menerima array opsi valid.
-   True/False hanya menerima TRUE/FALSE.

Jawaban ilegal harus ditolak.

------------------------------------------------------------------------

# 46. Race Condition & Concurrency

Karena Google Spreadsheet dapat menerima banyak request bersamaan:

Gunakan:

``` javascript
LockService.getScriptLock()
```

pada operasi kritis seperti:

-   startAttempt
-   saveAnswers bila melakukan read-modify-write
-   submitAttempt
-   createQuestion
-   createExam
-   importQuestions

Hindari menahan lock terlalu lama.

------------------------------------------------------------------------

# 47. Optimasi Spreadsheet

Jangan melakukan:

``` javascript
getRange().getValue()
```

berulang kali untuk setiap cell.

Gunakan batch:

``` javascript
getDataRange().getValues()
```

Kemudian proses di memory.

Untuk penulisan gunakan:

``` javascript
setValues()
```

sebisa mungkin.

Hindari terlalu banyak `google.script.run` request.

------------------------------------------------------------------------

# 48. Cache

Gunakan `CacheService` bila bermanfaat untuk:

-   data exam publik
-   session
-   data yang jarang berubah

Jangan cache data yang dapat menyebabkan jawaban peserta atau hasil
menjadi stale secara berbahaya.

------------------------------------------------------------------------

# 49. UX & Design

Gunakan desain:

-   modern
-   bersih
-   profesional
-   mobile-first
-   readable
-   touch-friendly

## Guru

Dashboard dapat menggunakan sidebar:

``` text
Dashboard
Ujian Saya
Buat Ujian
Import Soal
Hasil
Profil
Logout
```

## Peserta

Tampilan minimal:

``` text
Header
  Judul
  Timer

Progress
  1 2 3 4 5 ...

Question Card

Navigation
  Sebelumnya
  Berikutnya

Submit
```

Timer harus selalu terlihat pada layar mobile.

------------------------------------------------------------------------

# 50. Responsive Breakpoints

Minimal:

-   Mobile: \< 640px
-   Tablet: 640--1024px
-   Desktop: \> 1024px

Tidak boleh ada horizontal scrolling pada halaman normal.

Tombol minimal nyaman disentuh.

Gunakan font size yang terbaca pada smartphone.

------------------------------------------------------------------------

# 51. Accessibility

-   Label form harus jelas.
-   Input memiliki `label`.
-   Tombol memiliki teks.
-   Jangan hanya menggunakan warna untuk status.
-   Fokus keyboard harus masuk akal.
-   Contrast cukup tinggi.
-   Gambar memiliki alt text bila memungkinkan.

------------------------------------------------------------------------

# 52. Error Handling

Pesan harus manusiawi.

Contoh:

``` text
Username atau password salah.
```

bukan:

``` text
Exception: TypeError...
```

Jika server error:

``` text
Terjadi kesalahan saat menyimpan jawaban.
Jawaban lokal Anda tetap tersimpan. Coba lagi.
```

Jika link invalid:

``` text
Ujian tidak ditemukan atau link sudah tidak berlaku.
```

Jika ujian inactive:

``` text
Ujian saat ini tidak tersedia.
```

Jika waktu habis:

``` text
Waktu ujian telah habis. Jawaban Anda sedang diproses.
```

------------------------------------------------------------------------

# 53. Empty States

Dashboard tanpa ujian:

``` text
Belum ada ujian.

Buat ujian pertama Anda untuk mulai membuat soal.

[+ Buat Ujian]
```

Hasil kosong:

``` text
Belum ada peserta yang mengumpulkan ujian ini.
```

------------------------------------------------------------------------

# 54. Loading State

Setiap operasi backend yang membutuhkan waktu harus mempunyai loading
state.

Contoh:

``` text
Menyimpan...
Memuat soal...
Menghitung hasil...
Mengekspor hasil...
```

Tombol jangan dapat ditekan berkali-kali saat request berjalan.

------------------------------------------------------------------------

# 55. Security Threat Model

AI agent implementer harus mempertimbangkan:

### Unauthorized teacher access

Guru A mencoba:

``` text
getExam(EXAM_GURU_B)
```

Backend harus menolak.

### Client score manipulation

Peserta mencoba mengirim:

``` text
score: 100
```

Backend mengabaikannya.

### Answer manipulation

Peserta mengirim option ID yang tidak ada.

Backend menolak.

### Attempt manipulation

Peserta mencoba mengganti:

``` text
attemptId
```

Backend memvalidasi seluruh relasi.

### Double submission

Backend memastikan satu attempt hanya final satu kali.

### URL guessing

ID random cukup panjang dan tidak berurutan secara mudah ditebak.

------------------------------------------------------------------------

# 56. Konfigurasi Deployment

Dokumentasi implementasi harus menjelaskan:

1.  Buat Google Spreadsheet.
2.  Buka Extensions → Apps Script.
3.  Buat `Code.gs`.
4.  Buat `index.html`.
5.  Paste source code.
6.  Jalankan setup awal.
7.  Berikan authorization.
8.  Deploy → New deployment.
9.  Type: Web app.
10. Execute as: Owner.
11. Who has access: sesuai kebutuhan aplikasi; karena peserta membuka
    link publik, deployment harus dapat diakses oleh target pengguna
    tanpa login Google.
12. Salin Web App URL.

Catatan: konfigurasi akses aktual dapat berbeda tergantung kebijakan
akun Google Workspace sekolah. Implementasi harus menangani kondisi
ketika organisasi membatasi akses anonymous/public.

------------------------------------------------------------------------

# 57. Initial Setup

Saat pertama kali dijalankan:

``` text
setupApp()
```

harus:

1.  Memastikan sheet database ada.
2.  Membuat header jika belum ada.
3.  Membuat folder upload.
4.  Membuat folder export.
5.  Menyimpan ID folder ke `Settings`.
6.  Memasukkan akun guru contoh/dummy jika database kosong.
7.  Membuat template import.
8.  Menampilkan status setup.

Jangan membuat duplicate sheet/folder jika setup dijalankan lagi.

------------------------------------------------------------------------

# 58. Dummy Data

Gunakan contoh guru:

``` text
username: andi
password: 123456
name: Andi
status: ACTIVE
```

Tambahkan minimal satu ujian dummy dan beberapa soal untuk memudahkan
testing.

Password dummy hanya untuk development/testing.

------------------------------------------------------------------------

# 59. Data Integrity Rules

-   Semua ID unik.
-   Timestamp dibuat server.
-   Teacher ownership berasal dari session.
-   Score master berasal dari Questions.
-   KKM hasil disalin saat submission.
-   Submission tidak boleh dihapus dari histori melalui UI guru pada
    versi 1.
-   Penghapusan ujian sebaiknya menggunakan `ARCHIVED`, bukan hard
    delete, jika sudah memiliki hasil.
-   Soal yang sudah pernah digunakan dalam submission sebaiknya tidak
    dihapus permanen; gunakan status inactive atau archive.

------------------------------------------------------------------------

# 60. Perilaku Edit Soal Setelah Ada Peserta

Ini sangat penting.

Jika sudah ada peserta yang mengerjakan/submission:

-   Guru boleh mengedit soal untuk ujian berikutnya.
-   Histori submission lama harus tetap dapat direkonstruksi.
-   Jangan mengubah jawaban/kunci histori secara retroaktif.

Implementasi disarankan menyimpan snapshot data soal yang diperlukan
pada saat submission, atau menyimpan informasi scoring/answer key yang
digunakan pada `Answers`.

Dengan demikian perubahan soal setelah ujian tidak mengubah hasil lama.

------------------------------------------------------------------------

# 61. Duplicate Exam

Ketika guru memilih `Duplicate`:

-   buat `examId` baru.
-   copy konfigurasi.
-   copy semua questions.
-   generate questionId baru.
-   reset:
    -   attempts
    -   results
    -   status → DRAFT
-   generate link baru.

------------------------------------------------------------------------

# 62. Search & Filter

Dashboard guru:

### Search

-   Judul
-   Materi
-   Mata pelajaran

### Filter

-   Status
-   Kelas
-   Tahun/periode jika nantinya ditambahkan

Hasil:

-   status
-   kelas
-   nilai

------------------------------------------------------------------------

# 63. Pagination

Untuk dataset kecil, seluruh data dapat dimuat sekaligus.

Untuk dataset besar, gunakan pagination.

Default:

``` text
20–50 rows/page
```

Jangan memuat seluruh jawaban seluruh peserta jika hanya sedang
menampilkan summary.

------------------------------------------------------------------------

# 64. Performance Target

Target UX:

-   Dashboard initial load ideal \< 3 detik untuk dataset kecil.
-   Membuka ujian ideal \< 3 detik.
-   Autosave ideal \< 2 detik.
-   Submit ideal \< 5 detik.

Karena Google Apps Script memiliki quota dan latency, jangan menjanjikan
angka tersebut sebagai SLA absolut.

------------------------------------------------------------------------

# 65. Google Apps Script Quota Awareness

AI agent harus:

-   meminimalkan Spreadsheet calls;
-   menghindari loop yang melakukan API call;
-   menggunakan batch read/write;
-   menggunakan cache jika tepat;
-   menggunakan LockService;
-   menangani quota error;
-   menangani concurrent users.

------------------------------------------------------------------------

# 66. Acceptance Criteria --- Login

-   [ ] Guru dapat login menggunakan username/password.
-   [ ] Guru invalid ditolak.
-   [ ] Session dibuat.
-   [ ] Password tidak dikirim balik ke frontend.
-   [ ] Guru dapat logout.
-   [ ] Session expired meminta login kembali.

------------------------------------------------------------------------

# 67. Acceptance Criteria --- Exam

-   [ ] Guru dapat membuat exam.
-   [ ] Exam memiliki unique ID.
-   [ ] Guru dapat edit.
-   [ ] Guru dapat archive.
-   [ ] Guru dapat duplicate.
-   [ ] Guru dapat activate/deactivate.
-   [ ] Link unik dibuat.
-   [ ] Guru hanya melihat exam miliknya.

------------------------------------------------------------------------

# 68. Acceptance Criteria --- Questions

-   [ ] MCQ tersedia.
-   [ ] MCQ Complex tersedia.
-   [ ] True/False tersedia.
-   [ ] Jumlah opsi MCQ dapat ditentukan.
-   [ ] Score individual tersedia.
-   [ ] Gambar pertanyaan tersedia.
-   [ ] Gambar opsi tersedia.
-   [ ] Upload tersedia.
-   [ ] URL gambar tersedia.
-   [ ] Import Spreadsheet tersedia.
-   [ ] Validasi soal tersedia.

------------------------------------------------------------------------

# 69. Acceptance Criteria --- Participant

-   [ ] Link exam dapat dibuka tanpa login.
-   [ ] Identitas wajib diisi.
-   [ ] Peserta dapat mulai.
-   [ ] Timer berjalan.
-   [ ] Soal dapat dinavigasi.
-   [ ] Autosave bekerja.
-   [ ] Reload tidak menghapus jawaban yang telah tersimpan.
-   [ ] Randomization konsisten selama attempt.
-   [ ] Submit manual bekerja.
-   [ ] Auto-submit bekerja.
-   [ ] Double submit ditolak.

------------------------------------------------------------------------

# 70. Acceptance Criteria --- Scoring

-   [ ] MCQ otomatis dinilai.
-   [ ] MCQ Complex exact bekerja.
-   [ ] MCQ Complex partial bekerja.
-   [ ] True/False otomatis dinilai.
-   [ ] Raw score benar.
-   [ ] Max score benar.
-   [ ] Nilai 0--100 benar.
-   [ ] KKM benar.
-   [ ] Status lulus benar.
-   [ ] Multiple attempts sesuai konfigurasi.
-   [ ] Nilai final sesuai HIGHEST/LATEST/AVERAGE.

------------------------------------------------------------------------

# 71. Acceptance Criteria --- Results

-   [ ] Dashboard menampilkan total ujian.
-   [ ] Rekap nilai tersedia.
-   [ ] Detail peserta tersedia.
-   [ ] Jawaban peserta tersedia.
-   [ ] Jawaban benar tersedia.
-   [ ] Skor per soal tersedia.
-   [ ] Export tersedia.
-   [ ] Hasil historis tidak berubah akibat edit soal baru.

------------------------------------------------------------------------

# 72. Acceptance Criteria --- Mobile

-   [ ] Berfungsi pada smartphone.
-   [ ] Tidak ada horizontal overflow.
-   [ ] Timer terlihat.
-   [ ] Opsi mudah ditekan.
-   [ ] Gambar responsive.
-   [ ] Navigation mudah digunakan.
-   [ ] Form identitas mudah diisi.
-   [ ] Submit mudah ditemukan.

------------------------------------------------------------------------

# 73. Testing Matrix

AI agent wajib membuat dan menjalankan test case berikut.

## Authentication

1.  Login benar.
2.  Password salah.
3.  Username tidak ada.
4.  User inactive.
5.  Session expired.
6.  Logout.

## Exam

1.  Create.
2.  Edit.
3.  Archive.
4.  Activate.
5.  Deactivate.
6.  Duplicate.
7.  Invalid exam ID.
8.  Guru A mengakses exam Guru B.

## Question

1.  MCQ 2 opsi.
2.  MCQ 5 opsi.
3.  MCQ correct A.
4.  MCQ Complex exact.
5.  MCQ Complex partial.
6.  True.
7.  False.
8.  Question image upload.
9.  Option image upload.
10. Invalid scoring.
11. Import valid.
12. Import invalid.

## Attempt

1.  First attempt.
2.  Second attempt allowed.
3.  Max attempt reached.
4.  Timer.
5.  Expired attempt.
6.  Reload.
7.  Network interruption simulation.
8.  Double submit.
9.  Invalid answer payload.

## Scoring

1.  100%.
2.  0%.
3.  Partial score.
4.  Decimal score.
5.  KKM boundary exactly 75.
6.  74.99.
7.  75. 
8.  Multiple attempts highest.
9.  Multiple attempts latest.
10. Multiple attempts average.

------------------------------------------------------------------------

# 74. Edge Cases

Wajib dipikirkan:

### Tidak ada soal

Exam tidak dapat diaktifkan.

### Semua soal score 0

Exam tidak dapat diaktifkan.

### Peserta refresh

Attempt tetap berjalan.

### Peserta membuka link dua tab

Backend harus membatasi/menangani attempt secara konsisten berdasarkan
identitas dan attempt.

### Browser tertutup

Attempt tetap tersimpan.

### Internet terputus

Local state tetap tersedia; ketika koneksi kembali, autosave melakukan
sinkronisasi.

### Timer habis saat offline

Server tetap menentukan deadline berdasarkan timestamp server ketika
request berikutnya diterima.

### Guru mengubah durasi setelah peserta mulai

Attempt yang sudah dimulai sebaiknya mempertahankan `deadlineAt` lama.

### Guru menonaktifkan exam ketika ada peserta sedang mengerjakan

Attempt yang sudah dimulai tetap dapat diselesaikan sampai deadline,
kecuali implementasi secara eksplisit menetapkan kebijakan berbeda.

### Guru mengubah KKM

Submission lama mempertahankan KKM snapshot.

------------------------------------------------------------------------

# 75. Keputusan Implementasi Penting

## Server adalah source of truth

Frontend tidak dipercaya untuk:

-   score
-   deadline
-   ownership
-   answer key
-   exam status
-   attempt number

## Spreadsheet adalah database

Tidak boleh ada database tersembunyi yang menjadi source of truth.

## Drive adalah file storage

Spreadsheet menyimpan file ID/URL, bukan binary file.

## Dua file saja

Semua kode frontend berada di `index.html`.

Semua backend berada di `Code.gs`.

------------------------------------------------------------------------

# 76. Rekomendasi Struktur Kode `Code.gs`

``` text
CONFIG / CONSTANTS
↓
doGet
↓
AUTH / SESSION
↓
SETUP / DATABASE
↓
EXAM CRUD
↓
QUESTION CRUD
↓
IMPORT
↓
UPLOAD
↓
PARTICIPANT / ATTEMPT
↓
AUTOSAVE
↓
SCORING
↓
RESULT
↓
EXPORT
↓
SECURITY / VALIDATION
↓
UTILITY
```

Gunakan komentar section yang jelas agar AI agent mudah melakukan
maintenance.

------------------------------------------------------------------------

# 77. Rekomendasi Struktur `index.html`

``` text
<head>
  CSS
</head>

<body>
  App Shell
  Login View
  Teacher Dashboard View
  Exam Management View
  Question Builder View
  Import View
  Result View
  Public Exam View
  Exam Taking View
  Participant Result View

  JavaScript:
    State
    Router/View
    API wrapper
    Teacher functions
    Exam functions
    Question functions
    Participant functions
    Timer
    Autosave
    Validation
    Modal
    Toast
    Utility
</body>
```

------------------------------------------------------------------------

# 78. API Naming Convention

Gunakan nama konsisten.

Contoh:

``` text
teacherLogin
teacherLogout
getDashboardData

createExam
updateExam
archiveExam
duplicateExam
getExamById

createQuestion
updateQuestion
deleteQuestion
getQuestionsByExam

uploadQuestionImage
uploadOptionImage

startExamAttempt
saveAttemptAnswers
getAttempt
submitExamAttempt

getExamResults
getParticipantResult
exportExam
```

------------------------------------------------------------------------

# 79. Tidak Boleh Ada Business Logic Penting di Frontend

Frontend hanya:

-   render;
-   input;
-   navigasi;
-   UI validation;
-   request backend.

Backend melakukan:

-   authorization;
-   scoring;
-   ownership;
-   timer verification;
-   attempt validation;
-   database writes;
-   export.

------------------------------------------------------------------------

# 80. Definition of Done

Aplikasi dianggap selesai apabila:

1.  Hanya membutuhkan `Code.gs` dan `index.html`.
2.  Dapat dipasang pada Spreadsheet kosong.
3.  Setup otomatis membuat struktur database.
4.  Guru dapat login.
5.  Banyak guru dapat menggunakan dashboard.
6.  Guru hanya dapat melihat data sendiri.
7.  Guru dapat membuat ujian.
8.  Ujian memiliki link unik.
9.  Semua tiga tipe soal bekerja.
10. Gambar soal dan opsi bekerja.
11. Upload dan URL gambar bekerja.
12. Guru menentukan skor setiap soal.
13. MCQ Complex mendukung exact dan partial.
14. Timer bekerja.
15. Random question bekerja.
16. Random option bekerja.
17. Autosave bekerja.
18. Multiple attempts bekerja.
19. Scoring backend bekerja.
20. Nilai 0--100 bekerja.
21. KKM bekerja.
22. Peserta dapat melihat hasil sesuai setting.
23. Guru dapat melihat rekap.
24. Guru dapat melihat detail.
25. Export Excel bekerja.
26. Import template bekerja.
27. Responsive/mobile friendly.
28. Security ownership check bekerja.
29. Double submission aman.
30. Historis hasil tidak rusak ketika soal diubah.
31. Error handling tersedia.
32. Dokumentasi instalasi tersedia.
33. Template Spreadsheet tersedia.

------------------------------------------------------------------------

# 81. Output yang Harus Dihasilkan AI Agent

AI agent implementer harus menghasilkan minimal:

``` text
1. Code.gs
2. index.html
3. Dokumentasi setup
4. Struktur Spreadsheet otomatis
5. Template import soal
6. Dummy data
7. Test checklist
```

Jika sistem pembuatan file mengharuskan template import sebagai file
terpisah, template tersebut **bukan source code aplikasi**; aplikasi
tetap hanya terdiri dari `Code.gs` dan `index.html`.

------------------------------------------------------------------------

# 82. Prioritas Pengembangan

## P0 --- Core

-   Setup database
-   Login guru
-   Exam CRUD
-   Question CRUD
-   Public exam
-   Attempt
-   Timer
-   Autosave
-   Submit
-   Scoring
-   Results

## P1 --- Essential Management

-   Randomization
-   Multiple attempts
-   KKM
-   Image upload
-   Image URL
-   Detail result
-   Export
-   Import

## P2 --- Quality

-   Dashboard statistics
-   Search/filter
-   Pagination
-   Duplicate exam
-   Archive
-   Activity logs
-   Enhanced UX
-   Local backup

------------------------------------------------------------------------

# 83. Catatan untuk AI Agent Implementer

Implementasi harus mengutamakan **reliability dibanding kompleksitas**.

Jangan menambahkan framework, library eksternal, backend service, atau
database eksternal hanya demi membuat kode lebih modern.

Jika terdapat konflik antara UX frontend dan keamanan backend,
**backend/security harus menang**.

Jika terdapat konflik antara fitur dan quota Google Apps Script,
optimalkan dengan batch operation dan caching terlebih dahulu.

Jangan membuat asumsi bahwa browser peserta selalu online.

Jangan mengandalkan waktu client sebagai sumber kebenaran.

Jangan pernah menerima skor final dari client.

Jangan pernah mempercayai `teacherId` dari client untuk authorization.

Seluruh ownership harus diturunkan dari session guru yang telah
diverifikasi.

Untuk submission, gunakan locking dan operasi idempotent agar request
ganda tidak menghasilkan dua hasil.

------------------------------------------------------------------------

# 84. Ringkasan Produk Final

``` text
                 GOOGLE SPREADSHEET
                       │
          ┌────────────┴────────────┐
          │                         │
      TEACHER                    STUDENT
          │                         │
 Username + Password            Unique Exam Link
          │                         │
          ▼                         ▼
    TEACHER DASHBOARD          EXAM LANDING
          │                         │
   ┌──────┼────────┐          Name/Class/NIS
   │      │        │                 │
 Exams Questions Results            ▼
   │      │        │             Start Attempt
   │      │        │                 │
   │      │        │              Timer
   │      │        │                 │
   │      │        │              Questions
   │      │        │                 │
   │      │        │              Autosave
   │      │        │                 │
   │      │        │              Submit
   │      │        │                 │
   └──────┴────────┴──────────► Scoring Engine
                                      │
                                      ▼
                              Score 0–100
                                      │
                              ┌───────┴───────┐
                              │               │
                           Student          Teacher
                            Result           Results
                                              │
                                              ▼
                                         Excel Export
```

**End of PRD**
