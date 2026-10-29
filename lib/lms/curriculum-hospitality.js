'use strict';

const q = (question, options, answer, why) => ({ question, options, answer, why });
const rb = (aspect, weight, critical = false) => ({ aspect, weight, critical });

/** Jalur Hospitality & Service Excellence — sisi layanan yang membuat pelanggan kembali. */
const HOS = [
  {
    code: 'HOS-101', title: 'Hospitality Mindset', track: 'hospitality', level: 'HOS', duration: 30,
    summary: 'Perbedaan service dan hospitality, serta standar keramahan Ondeway.',
    objectives: ['Membedakan service dan hospitality.', 'Menjelaskan tiga pilar hospitality Ondeway.', 'Menerapkan keramahan yang wajar dan konsisten.'],
    relevance: 'Produk yang sama bisa terasa berbeda hanya karena cara penyambutannya.',
    prerequisites: ['FND-04'],
    materials: [
      { title: 'Service vs hospitality', media: 'Teks', body: 'Service adalah memenuhi pesanan dengan benar dan tepat waktu. Hospitality adalah membuat pelanggan merasa diterima sebagai tamu. Keduanya harus ada.' },
      { title: 'Tiga pilar', media: 'Teks', body: 'Perhatian (melihat kebutuhan sebelum diminta), kehangatan (sapaan tulus), dan konsistensi (standar yang sama di setiap kunjungan).' },
      { title: 'Keramahan yang wajar', media: 'Teks', body: 'Senyum tanpa berlebihan, kontak mata singkat, nada bicara tenang. Hindari basa-basi panjang saat antrean padat.' },
    ],
    sop: { code: 'SOP-HOS-101', title: 'Standar keramahan', points: ['Sapa setiap tamu yang masuk.', 'Gunakan nama pelanggan bila dikenal.', 'Jaga nada bicara tetap tenang saat sibuk.'] },
    quiz: [
      q('Apa perbedaan utama hospitality dengan service?', ['Hospitality membuat tamu merasa diterima, service memenuhi pesanan', 'Keduanya sama', 'Service lebih penting', 'Hospitality hanya untuk pelanggan VIP'], 0, 'Hospitality menyentuh perasaan diterima.'),
      q('Tiga pilar hospitality Ondeway?', ['Perhatian, kehangatan, konsistensi', 'Kecepatan, harga, diskon', 'Promosi, iklan, sponsor', 'Kebersihan, gaji, jadwal'], 0, 'Tiga pilar tersebut menjaga pengalaman.'),
      q('Sikap yang tepat saat antrean padat?', ['Tetap menyapa singkat dan tenang', 'Mengobrol panjang', 'Menghindari kontak mata', 'Menurunkan standar'], 0, 'Sapaan singkat menjaga keramahan tanpa memperlambat.'),
    ],
    rubric: [rb('Pemahaman konsep hospitality', 40), rb('Penerapan keramahan', 40), rb('Konsistensi saat sibuk', 20)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus observasi keramahan minimal 80.',
  },
  {
    code: 'HOS-102', title: 'Greeting & First Impression', track: 'hospitality', level: 'HOS', duration: 30,
    summary: 'Lima detik pertama: sapaan, bahasa tubuh, dan kesan pertama yang konsisten.',
    objectives: ['Memberi sapaan standar dalam lima detik.', 'Menunjukkan bahasa tubuh terbuka.', 'Menyesuaikan sapaan untuk pelanggan reguler dan baru.'],
    relevance: 'Kesan pertama menentukan penilaian pelanggan terhadap seluruh kunjungan.',
    prerequisites: ['HOS-101'],
    materials: [
      { title: 'Sapaan standar', media: 'Teks', body: '"Selamat pagi, selamat datang di Ondeway." Lanjutkan dengan pertanyaan terbuka: "Mau minum apa hari ini?"' },
      { title: 'Bahasa tubuh', media: 'Teks', body: 'Berdiri tegak, tangan tidak menyilang, menghadap pelanggan, tidak melihat layar saat berbicara.' },
      { title: 'Pelanggan reguler', media: 'Teks', body: 'Sebutkan nama bila terdaftar sebagai member dan tanyakan apakah ingin pesanan yang sama. Jangan mengarang nama.' },
    ],
    sop: { code: 'SOP-HOS-102', title: 'Menyambut tamu', points: ['Sapa maksimal 5 detik sejak tamu masuk.', 'Hadapkan tubuh ke pelanggan saat berbicara.', 'Catat nama pelanggan reguler pada catatan shift.'] },
    quiz: [
      q('Batas waktu ideal memberi sapaan?', ['5 detik', '1 menit', '5 menit', 'Setelah pelanggan memesan'], 0, 'Sapaan lima detik adalah standar.'),
      q('Bahasa tubuh yang tepat?', ['Menghadap pelanggan dengan tangan terbuka', 'Menunduk melihat layar', 'Tangan menyilang', 'Membelakangi pelanggan'], 0, 'Menghadap pelanggan menunjukkan perhatian.'),
      q('Untuk pelanggan member, sebaiknya?', ['Menyebut nama dan menawarkan pesanan favoritnya', 'Mengabaikan nama', 'Menawarkan semua menu', 'Meminta ulang data'], 0, 'Menyebut nama menambah kesan personal.'),
    ],
    rubric: [rb('Ketepatan sapaan', 40), rb('Bahasa tubuh', 30), rb('Personalisasi', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus dengan tiga kali observasi berturut-turut.',
  },
  {
    code: 'HOS-103', title: 'Order Taking & Suggestive Selling', track: 'hospitality', level: 'HOS', duration: 45,
    summary: 'Menerima pesanan dengan akurat dan menawarkan tambahan yang relevan tanpa memaksa.',
    objectives: ['Mencatat pesanan lengkap dengan permintaan khusus.', 'Menawarkan satu hingga dua tambahan yang relevan.', 'Menangani pesanan rumit dan alergi.'],
    relevance: 'Pesanan akurat menurunkan remake, penawaran tepat menaikkan nilai transaksi.',
    prerequisites: ['FND-03', 'HOS-102'],
    materials: [
      { title: 'Mencatat pesanan', media: 'Teks', body: 'Ulangi pesanan lengkap: jumlah, produk, ukuran, suhu, es, gula, permintaan khusus. Untuk alergi, tanyakan detail dan sampaikan ke bar serta kitchen.' },
      { title: 'Suggestive selling', media: 'Teks', body: 'Tawarkan satu tambahan relevan: pastry untuk kopi pagi, air mineral untuk pesanan es, atau biji kopi untuk pelanggan yang bertanya soal kopi. Maksimal dua tawaran.' },
      { title: 'Pesanan rumit', media: 'Teks', body: 'Bila modifikasi di luar standar, jelaskan konsekuensi rasa dan biaya, lalu konfirmasi ulang sebelum diproses.' },
    ],
    sop: { code: 'SOP-HOS-103', title: 'Menerima pesanan', points: ['Ulangi pesanan sebelum dibayar.', 'Catat alergi dan permintaan khusus pada tiket.', 'Tawarkan maksimal dua tambahan.', 'Jangan mengubah komposisi tanpa persetujuan bar.' ] },
    quiz: [
      q('Berapa maksimal tawaran tambahan yang disampaikan?', ['Dua', 'Lima', 'Sepuluh', 'Tidak boleh menawarkan'], 0, 'Dua tawaran agar tidak terasa memaksa.'),
      q('Permintaan alergi harus?', ['Dicatat pada tiket dan disampaikan ke bar serta kitchen', 'Diabaikan', 'Dijawab sendiri tanpa cek', 'Disampaikan setelah produk jadi'], 0, 'Alergi harus tercatat dan dikomunikasikan.'),
      q('Pesanan dengan modifikasi di luar standar sebaiknya?', ['Dijelaskan konsekuensinya lalu dikonfirmasi ulang', 'Langsung dibuat', 'Ditolak', 'Dibuat setengah porsi'], 0, 'Konfirmasi mencegah salah paham.'),
    ],
    rubric: [rb('Akurasi pesanan', 40), rb('Kualitas tawaran tambahan', 30), rb('Penanganan pesanan khusus', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus role-play pesanan kompleks minimal 80.',
  },
  {
    code: 'HOS-104', title: 'Counter & Table Service Flow', track: 'hospitality', level: 'HOS', duration: 45,
    summary: 'Alur pelayanan di kasir dan area duduk: penyerahan, pembersihan meja, dan perpisahan.',
    objectives: ['Menjalankan alur pelayanan kasir dan meja.', 'Menjaga kebersihan area duduk secara berkala.', 'Menutup kunjungan dengan kesan baik.'],
    relevance: 'Area duduk yang kotor menghapus kesan baik dari produk yang enak.',
    prerequisites: ['HOS-102'],
    materials: [
      { title: 'Alur kasir', media: 'Teks', body: 'Sapa, terima pesanan, konfirmasi, pembayaran, berikan nomor pesanan, jelaskan cara pengambilan.' },
      { title: 'Alur meja', media: 'Teks', body: 'Antar pesanan ke meja dengan menyebut nama pelanggan, tawarkan tisu dan air, lalu periksa kembali lima menit kemudian bila memungkinkan.' },
      { title: 'Perpisahan', media: 'Teks', body: 'Ucapkan terima kasih dan ajakan kembali yang wajar: "Terima kasih, sampai jumpa lagi."' },
    ],
    sop: { code: 'SOP-HOS-104', title: 'Layanan kasir & meja', points: ['Bersihkan meja maksimal 3 menit setelah pelanggan pergi.', 'Antar pesanan dengan menyebut nama pelanggan.', 'Ucapkan terima kasih saat pelanggan pergi.'] },
    quiz: [
      q('Batas waktu membersihkan meja setelah pelanggan pergi?', ['3 menit', '30 menit', '1 jam', 'Sebelum tutup'], 0, 'Tiga menit menjaga kenyamanan pelanggan berikutnya.'),
      q('Saat mengantar pesanan ke meja sebaiknya?', ['Menyebut nama pelanggan', 'Meletakkan tanpa bicara', 'Menyebut total harga', 'Menyebut nomor meja saja'], 0, 'Menyebut nama menambah kesan personal.'),
      q('Penutup kunjungan yang baik?', ['Terima kasih dan ajakan kembali yang wajar', 'Diam saja', 'Menawarkan promo terus', 'Menagih ulasan'], 0, 'Penutup yang hangat menutup pengalaman positif.'),
    ],
    rubric: [rb('Alur kasir', 30), rb('Kebersihan area duduk', 35), rb('Penutupan kunjungan', 35)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus observasi area layanan.',
  },
  {
    code: 'HOS-105', title: 'Complaint Handling', track: 'hospitality', level: 'HOS', duration: 45,
    summary: 'Menerima keluhan dengan tenang, mengklasifikasikan, dan menindaklanjuti.',
    objectives: ['Menerapkan empat langkah menangani keluhan.', 'Mengklasifikasikan keluhan ringan, sedang, berat.', 'Mencatat keluhan untuk perbaikan.'],
    relevance: 'Keluhan yang ditangani cepat mencegah ulasan buruk dan kehilangan pelanggan.',
    prerequisites: ['HOS-101'],
    materials: [
      { title: 'Empat langkah', media: 'Teks', body: 'Dengarkan, minta maaf atas pengalaman, tawarkan solusi konkret dengan waktu, lalu konfirmasi kepuasan.' },
      { title: 'Klasifikasi', media: 'Teks', body: 'Ringan: salah racikan minor, dapat diselesaikan barista. Sedang: produk harus dibuat ulang atau menunggu lama, libatkan shift leader. Berat: keluhan keselamatan, kesehatan, atau permintaan refund, wajib manajer.' },
      { title: 'Pencatatan', media: 'Teks', body: 'Catat waktu, produk, keluhan, tindakan, dan hasil. Data ini menjadi bahan perbaikan proses.' },
    ],
    sop: { code: 'SOP-HOS-105', title: 'Menangani keluhan', points: ['Jangan memotong pembicaraan pelanggan.', 'Beri solusi dengan estimasi waktu.', 'Eskalasi keluhan berat kepada manajer.', 'Catat setiap keluhan pada log.'] },
    quiz: [
      q('Keluhan yang wajib dieskalasi ke manajer?', ['Keluhan keselamatan atau permintaan refund', 'Salah ejaan nama', 'Permintaan tisu', 'Pertanyaan menu'], 0, 'Isu keselamatan dan refund adalah kewenangan manajer.'),
      q('Langkah setelah mendengarkan keluhan?', ['Minta maaf atas pengalaman pelanggan', 'Menjelaskan prosedur', 'Menawarkan diskon', 'Menghubungi polisi'], 0, 'Permintaan maaf atas pengalaman membuka solusi.'),
      q('Solusi kepada pelanggan sebaiknya disertai?', ['Estimasi waktu penyelesaian', 'Janji tanpa dasar', 'Biaya tambahan', 'Syarat rumit'], 0, 'Estimasi waktu membuat pelanggan tenang.'),
    ],
    rubric: [rb('Sikap saat menerima keluhan', 35), rb('Ketepatan solusi dan eskalasi', 40), rb('Pencatatan keluhan', 25)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus role-play tiga jenis keluhan.',
  },
  {
    code: 'HOS-106', title: 'Service Recovery & Remake', track: 'hospitality', level: 'HOS', duration: 30,
    summary: 'Membuat ulang produk dan memberi pemulihan yang proporsional tanpa pemborosan.',
    objectives: ['Menentukan kapan remake diperlukan.', 'Memberi pemulihan proporsional.', 'Mencatat remake sebagai waste terkendali.'],
    relevance: 'Remake yang berlebihan membebani biaya, tetapi menolak remake merusak kepercayaan.',
    prerequisites: ['HOS-105', 'BAR-107'],
    materials: [
      { title: 'Kapan remake', media: 'Teks', body: 'Remake wajib bila produk tidak sesuai resep, suhu, atau tampilan, atau bila pesanan salah karena kelalaian tim. Bukan untuk pelanggan yang berubah pikiran setelah produk dibuat.' },
      { title: 'Pemulihan proporsional', media: 'Teks', body: 'Remake cepat, permintaan maaf tulus, dan bila perlu satu tambahan kecil. Hindari memberi produk gratis berulang tanpa otorisasi.' },
      { title: 'Pencatatan', media: 'Teks', body: 'Catat remake sebagai waste kategori remake dengan alasan dan penyebab agar bisa dianalisis.' },
    ],
    sop: { code: 'SOP-HOS-106', title: 'Remake', points: ['Utamakan remake sebelum menawarkan refund.', 'Catat setiap remake.', 'Laporkan remake berulang pada produk yang sama.'] },
    quiz: [
      q('Kondisi yang mewajibkan remake?', ['Produk tidak sesuai resep atau pesanan salah karena kelalaian tim', 'Pelanggan berubah pikiran', 'Pelanggan ingin diskon', 'Pelanggan baru datang'], 0, 'Remake untuk kesalahan standar atau pesanan.'),
      q('Remake dicatat sebagai?', ['Waste kategori remake', 'Penjualan tambahan', 'Stok keluar biasa', 'Piutang'], 0, 'Remake adalah waste terkendali.'),
      q('Yang perlu dilaporkan bila remake berulang?', ['Produk yang sama bermasalah', 'Nama pelanggan', 'Jumlah pengunjung', 'Cuaca'], 0, 'Remake berulang menandakan masalah proses.'),
    ],
    rubric: [rb('Ketepatan keputusan remake', 40), rb('Proporsionalitas pemulihan', 30), rb('Pencatatan waste', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus observasi penanganan remake.',
  },
  {
    code: 'HOS-107', title: 'Communication & Team Handover', track: 'hospitality', level: 'HOS', duration: 30,
    summary: 'Komunikasi antar peran dan serah terima informasi layanan antar shift.',
    objectives: ['Menggunakan format komunikasi singkat antar peran.', 'Menyampaikan informasi pelanggan penting saat serah terima.', 'Menjaga kerahasiaan data pelanggan.'],
    relevance: 'Informasi yang hilang saat pergantian shift menyebabkan pelanggan mengulang cerita.',
    prerequisites: ['FND-08'],
    materials: [
      { title: 'Format singkat', media: 'Teks', body: 'Gunakan struktur: siapa, apa, kapan. Contoh: "Meja 3, pesanan Mont Blanc tanpa es, siap 2 menit."' },
      { title: 'Informasi pelanggan', media: 'Teks', body: 'Sampaikan permintaan khusus, keluhan yang belum selesai, dan pesanan tertunda. Jangan menyebarkan data pribadi pelanggan di luar kebutuhan kerja.' },
      { title: 'Kerahasiaan', media: 'Teks', body: 'Nomor telepon, alamat, dan riwayat transaksi pelanggan hanya dipakai untuk keperluan layanan dan tidak dibahas di area publik.' },
    ],
    sop: { code: 'SOP-HOS-107', title: 'Serah terima layanan', points: ['Gunakan format siapa-apa-kapan.', 'Catat keluhan yang belum selesai.', 'Jangan membahas data pelanggan di area publik.'] },
    quiz: [
      q('Format komunikasi singkat yang dianjurkan?', ['Siapa, apa, kapan', 'Bebas', 'Hanya angka', 'Bahasa asing'], 0, 'Format tersebut cepat dipahami.'),
      q('Data pelanggan boleh dipakai untuk?', ['Keperluan layanan', 'Bahan obrolan', 'Konten media sosial', 'Dijual'], 0, 'Data hanya untuk layanan.'),
      q('Informasi wajib saat serah terima?', ['Permintaan khusus dan keluhan yang belum selesai', 'Jadwal libur', 'Gaji rekan', 'Menu baru'], 0, 'Informasi layanan yang belum tuntas wajib diteruskan.'),
    ],
    rubric: [rb('Kejelasan komunikasi', 40), rb('Kelengkapan serah terima', 35), rb('Kepatuhan kerahasiaan', 25, true)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus simulasi serah terima.',
  },
  {
    code: 'HOS-108', title: 'Service Quality Audit & Sertifikasi Hospitality', track: 'hospitality', level: 'HOS', duration: 45,
    summary: 'Audit kualitas layanan dengan mystery guest internal dan penilaian standar hospitality.',
    objectives: ['Menjalankan audit layanan dengan checklist standar.', 'Menilai pengalaman pelanggan secara konsisten.', 'Menyusun rencana perbaikan layanan.'],
    relevance: 'Standar layanan harus diukur, bukan diasumsikan.',
    prerequisites: ['HOS-101', 'HOS-102', 'HOS-103', 'HOS-104', 'HOS-105', 'HOS-106', 'HOS-107'],
    materials: [
      { title: 'Checklist audit', media: 'Teks', body: 'Enam titik sentuh dinilai 1 sampai 4: tampak depan, sapaan, pemesanan, penyajian, penyerahan, perpisahan. Total skor maksimal 24.' },
      { title: 'Mystery guest internal', media: 'Teks', body: 'Rekan dari outlet lain mengunjungi sebagai pelanggan biasa, menilai dengan checklist, lalu memberikan umpan balik pada manajer.' },
      { title: 'Rencana perbaikan', media: 'Teks', body: 'Titik sentuh dengan skor terendah menjadi prioritas perbaikan bulan berikutnya.' },
    ],
    sop: { code: 'SOP-HOS-108', title: 'Audit layanan', points: ['Lakukan audit minimal sekali per bulan per outlet.', 'Gunakan checklist yang sama.', 'Sampaikan hasil pada briefing tanpa menyebut nama individu.'] },
    quiz: [
      q('Skor maksimal checklist enam titik sentuh?', ['24', '12', '100', '6'], 0, 'Enam titik dikali skor maksimal 4 = 24.'),
      q('Siapa yang melakukan mystery guest internal?', ['Rekan dari outlet lain', 'Pelanggan acak', 'Pemilik saja', 'Konsultan luar'], 0, 'Rekan outlet lain menjaga objektivitas.'),
      q('Prioritas perbaikan diambil dari?', ['Titik sentuh berskor terendah', 'Titik sentuh favorit', 'Menu termahal', 'Jadwal shift'], 0, 'Skor terendah menjadi prioritas.'),
    ],
    rubric: [rb('Ketepatan audit', 35), rb('Konsistensi penilaian', 35), rb('Rencana perbaikan', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus audit; badge Service Excellence diterbitkan setelah semua modul HOS selesai.',
  },
];

/** Badge mengikuti framework: hanya diberikan bila kompetensi terbukti, bukan hanya menonton video. */
const BADGES = [
  { code: 'explorer', name: 'Ondeway Explorer', track: 'foundation', level: 'FND', requirement: 'Semua modul Foundation lulus', icon: 'sparkles' },
  { code: 'coffee_learner', name: 'Coffee Learner', track: 'barista', level: 'B0', requirement: 'Semua modul Barista B0 lulus', icon: 'coffee' },
  { code: 'espresso_ready', name: 'Espresso Ready', track: 'barista', level: 'B1', requirement: 'Semua modul Barista B1 lulus (khususnya BAR-201/202/205)', icon: 'gauge' },
  { code: 'signature_specialist', name: 'Signature Specialist', track: 'barista', level: 'B1', requirement: 'Lulus BAR-206 dan praktik seluruh menu signature', icon: 'gift' },
  { code: 'service_excellence', name: 'Service Excellence', track: 'hospitality', level: 'HOS', requirement: 'Semua modul Hospitality lulus', icon: 'users' },
  { code: 'quality_guardian', name: 'Quality Guardian', track: 'barista', level: 'B2', requirement: 'Semua modul Barista B2 lulus', icon: 'check' },
  { code: 'mentor', name: 'Mentor', track: 'barista', level: 'B3', requirement: 'Lulus BAR-408 dan uji mengajar', icon: 'target' },
  { code: 'shift_leader', name: 'Shift Leader', track: 'barista', level: 'B3', requirement: 'Semua modul Barista B3 lulus', icon: 'trophy' },
];

/** Learning path sesuai framework: Foundation wajib untuk semua, lalu jalur per jabatan. */
const PATHS = [
  {
    code: 'PATH-FND', name: 'Foundation Program', role_target: 'Semua karyawan baru', track: 'foundation',
    description: 'Wajib untuk seluruh karyawan: budaya, brand, produk, pelayanan, higiene, SOP dasar, POS, dan kerja tim.',
    courses: ['FND-01', 'FND-02', 'FND-03', 'FND-04', 'FND-05', 'FND-06', 'FND-07', 'FND-08', 'FND-09'],
  },
  {
    code: 'PATH-BAR', name: 'Barista Academy (B0 → B3)', role_target: 'Barista, kasir peracik, calon bar supervisor', track: 'barista',
    description: 'Jalur teknis lengkap: pengetahuan kopi, peralatan, espresso, susu, signature drink, sensoris, kualitas, hingga kepemimpinan bar.',
    courses: ['BAR-101', 'BAR-102', 'BAR-103', 'BAR-104', 'BAR-105', 'BAR-106', 'BAR-107', 'BAR-108',
      'BAR-201', 'BAR-202', 'BAR-203', 'BAR-204', 'BAR-205', 'BAR-206', 'BAR-207', 'BAR-208', 'BAR-209', 'BAR-210',
      'BAR-301', 'BAR-302', 'BAR-303', 'BAR-304', 'BAR-305', 'BAR-306', 'BAR-307', 'BAR-308',
      'BAR-401', 'BAR-402', 'BAR-403', 'BAR-404', 'BAR-405', 'BAR-406', 'BAR-407', 'BAR-408'],
  },
  {
    code: 'PATH-HOS', name: 'Hospitality & Service Excellence', role_target: 'Semua yang berhadapan dengan pelanggan', track: 'hospitality',
    description: 'Keramahan, kesan pertama, penawaran menu, alur layanan kasir dan meja, penanganan keluhan, pemulihan layanan, dan audit kualitas layanan.',
    courses: ['HOS-101', 'HOS-102', 'HOS-103', 'HOS-104', 'HOS-105', 'HOS-106', 'HOS-107', 'HOS-108'],
  },
];

/** Dokumen pustaka: SOP turunan modul + recipe master (kartu resep). */
const RECIPES = [
  {
    code: 'RCP-DIRTY-LATTE', title: 'Recipe Master — Dirty Latte', version: '1.1', owner: 'Head Barista',
    summary: 'Signature latte dengan lapisan espresso pekat di atas susu dingin, disajikan tanpa diaduk.',
    body: 'Gelas: 240 ml. Komponen: 18 g espresso (yield 36 g), susu segar 160 ml disajikan dingin, es batu 100 g, gula aren cair 10 ml (opsional). Urutan: siapkan gelas, tuang gula aren, tambahkan es, tuang susu, lalu tuang espresso perlahan di atas permukaan. Tampilan: dua lapisan jelas, tanpa cipratan. Kesalahan umum: espresso terlalu panas, penuangan terlalu cepat, atau es terlalu banyak hingga lapisan pecah.',
  },
  {
    code: 'RCP-MONT-BLANC', title: 'Recipe Master — Mont Blanc', version: '1.0', owner: 'Head Barista',
    summary: 'Minuman susu dengan krim manis dan taburan bubuk kopi, disajikan dingin.',
    body: 'Gelas: 300 ml. Komponen: susu 180 ml, krim manis 40 ml, espresso 18 g (opsional sesuai varian), bubuk kopi 0,5 g, es 120 g. Urutan: es, susu, krim, lalu taburan bubuk kopi di atasnya. Tampilan: krim stabil, taburan rata, tidak menggumpal. Kesalahan umum: krim terlalu encer atau taburan terlalu tebal hingga pahit.',
  },
  {
    code: 'RCP-LIONS-TAMER', title: 'Recipe Master — Lions Tamer', version: '1.0', owner: 'Head Barista',
    summary: 'Kopi dingin rasa kuat dengan pemanis seimbang, cocok untuk pelanggan yang ingin segar namun tetap pekat.',
    body: 'Gelas: 300 ml. Komponen: espresso 36 g, air 60 ml, gula aren 15 ml, es 140 g. Urutan: gula aren, es, air, espresso, aduk satu kali sebelum disajikan. Tampilan: warna merata, tidak ada gula mengendap. Kesalahan umum: es berlebih sehingga rasa encer atau gula tidak larut.',
  },
  {
    code: 'SOP-BAR-OPENING', kind: 'sop', title: 'SOP Opening Bar (job aid)', version: '1.0', owner: 'Shift Leader',
    summary: 'Checklist persiapan area bar sebelum operasional.',
    body: '1) Nyalakan mesin espresso dan tunggu 20 menit. 2) Cek suhu grup dan pressure. 3) Isi hopper dan catat setelan grinder. 4) Siapkan pitcher bersih dan susu sesuai par stock. 5) Lakukan shot percobaan dan buang. 6) Cek kebersihan meja, knock box, dan drip tray. 7) Catat stok kritis pada lembar shift.',
  },
  {
    code: 'SOP-BAR-CLOSING', kind: 'sop', title: 'SOP Closing Bar (job aid)', version: '1.0', owner: 'Shift Leader',
    summary: 'Checklist penutupan area bar dan perawatan mesin.',
    body: '1) Hentikan penjualan sesuai jam. 2) Backflush mesin dengan deterjen food grade. 3) Bersihkan grup, keranjang, dan shower screen. 4) Buang sisa susu dan catat waste. 5) Cuci pitcher dan alat. 6) Kosongkan knock box dan tempat sampah. 7) Matikan mesin sesuai prosedur dan catat alat bermasalah.',
  },
];

module.exports = { HOS, BADGES, PATHS, RECIPES };
