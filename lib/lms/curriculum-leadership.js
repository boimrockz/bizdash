'use strict';

/**
 * Leadership Academy — jalur kepemimpinan berjenjang sesuai struktur organisasi:
 *   SUP (S1) : Supervisor lini (Head Barista, Supervisor Produksi)
 *   MGR (M2) : Manajer unit/outlet (Manajer Outlet, Kepala Unit, Finance & Accounting)
 *   DIR (E3) : Direktur, Chief, dan Owner
 *
 * Isi modul sengaja memakai angka & istilah yang sama dengan aplikasi (HPP, prime cost,
 * BSC, OKR, RACI, neraca, arus kas, absensi) supaya materi bisa langsung dipraktikkan
 * memakai data di dashboard, bukan teori terpisah.
 */

const q = (question, options, answer, why) => ({ question, options, answer, why });
const rb = (aspect, weight, critical = false) => ({ aspect, weight, critical });

// ---------------------------------------------------------------- S1 · Supervisor

const SUP = [
  {
    code: 'SUP-101', title: 'Dari Barista ke Supervisor', track: 'leadership', level: 'SUP', duration: 45,
    summary: 'Perpindahan peran dari pelaksana menjadi pengatur kerja: otoritas, tanggung jawab, dan batas keputusan.',
    objectives: [
      'Menjelaskan tiga perubahan utama saat menjadi supervisor: hasil lewat orang lain, keputusan lebih cepat, dan tanggung jawab atas standar.',
      'Membedakan keputusan yang boleh diambil sendiri dan yang harus dieskalasi ke manajer.',
      'Menyusun rencana 30 hari pertama sebagai supervisor di shift sendiri.',
    ],
    relevance: 'Promosi ke supervisor paling sering gagal bukan karena skill teknis, tapi karena orangnya masih bekerja seperti barista.',
    prerequisites: ['FND-08'],
    materials: [
      { title: 'Tiga perubahan peran', media: 'Teks', body: 'Sebagai barista Anda dinilai dari minuman yang Anda buat. Sebagai supervisor Anda dinilai dari minuman yang dibuat tim Anda sepanjang shift. Ada tiga perubahan: hasil lewat orang lain, keputusan diambil lebih cepat dengan informasi tidak lengkap, dan Anda pemegang standar ketika tidak ada yang mengawasi.' },
      { title: 'Otoritas dan batasnya', media: 'Teks', body: 'Supervisor memegang otoritas harian: pembagian station, urutan antrean, stop penjualan produk yang tidak sesuai standar, dan penggantian minuman yang gagal. Yang harus dieskalasi ke manajer: refund di atas batas yang ditetapkan, disiplin karyawan, perubahan harga/promo, dan pembelian mendesak di luar anggaran.' },
      { title: '30 hari pertama', media: 'Teks', body: 'Minggu 1: dengarkan tim dan catat tiga hambatan terbesar di shift. Minggu 2: rapikan satu hal kecil yang berdampak jelas (mis. checklist opening). Minggu 3: latih satu orang pada satu keterampilan. Minggu 4: tinjau hasil bersama manajer dengan angka: waktu tunggu, keluhan, dan waste.' },
    ],
    sop: { code: 'SOP-SUP-101', title: 'Serah terima shift', points: ['Terima catatan shift sebelumnya dan sisa kas.', 'Hitung kas awal bersama saksi.', 'Cek stok kritis dan alat bermasalah.', 'Bagikan station dan target hari ini.', 'Catat tiga risiko hari ini di lembar shift.'] },
    quiz: [
      q('Ukuran keberhasilan utama seorang supervisor adalah...', ['Hasil kerja tim sepanjang shift, bukan hanya pekerjaannya sendiri', 'Jumlah minuman yang ia buat sendiri', 'Kecepatan pulang setelah tutup', 'Jumlah jam lembur'], 0, 'Supervisor dinilai dari kinerja tim yang ia atur.'),
      q('Keputusan mana yang harus dieskalasi ke manajer?', ['Refund di atas batas otoritas supervisor', 'Mengatur urutan antrean saat ramai', 'Mengganti minuman yang tidak sesuai standar', 'Menugaskan barista ke station kasir'], 0, 'Refund besar, harga, dan disiplin adalah wilayah manajer.'),
      q('Langkah pertama yang paling tepat pada minggu pertama menjabat?', ['Mendengarkan tim dan mencatat hambatan nyata di shift', 'Mengubah semua SOP sekaligus', 'Menegur yang paling sering terlambat', 'Menambah menu baru'], 0, 'Diagnosis dulu, baru perbaikan kecil yang berdampak.'),
    ],
    rubric: [rb('Pemahaman peran dan batas otoritas', 35), rb('Komunikasi instruksi ke tim', 35), rb('Keteladanan standar kerja', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Lulus kuis 80 dan observasi satu shift penuh sebagai supervisor dengan nilai minimal 85.',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-102', title: 'Briefing & Memimpin Shift', track: 'leadership', level: 'SUP', duration: 40,
    summary: 'Briefing 10 menit yang benar-benar mengubah perilaku shift: angka, target, kendala, dan peran.',
    objectives: [
      'Menyusun briefing 10 menit dengan struktur angka kemarin, target hari ini, kendala, dan pembagian peran.',
      'Menyampaikan koreksi tanpa membuat tim defensif.',
      'Menutup shift dengan evaluasi singkat yang bisa diukur.',
    ],
    relevance: 'Shift tanpa briefing mengulang kesalahan yang sama setiap hari; briefing yang terlalu panjang justru diabaikan.',
    prerequisites: ['SUP-101'],
    materials: [
      { title: 'Struktur 10 menit', media: 'Teks', body: 'Menit 1-2: angka kemarin (penjualan, waktu tunggu, keluhan, waste). Menit 3-5: target dan prioritas hari ini, termasuk promo yang sedang berjalan. Menit 6-8: kendala (stok, alat, orang) dan siapa yang menangani. Menit 9-10: pembagian station dan satu perilaku fokus hari ini.' },
      { title: 'Menyampaikan koreksi', media: 'Teks', body: 'Sebutkan perilaku, bukan orangnya: "kemarin dua shot terbuang karena doser tidak ditimbang" lebih diterima daripada "kamu ceroboh". Koreksi di depan tim hanya untuk hal yang menyangkut standar bersama; sisanya empat mata.' },
      { title: 'Menutup shift', media: 'Teks', body: 'Lima menit sebelum tutup: apa yang berjalan baik, apa yang menghambat, satu perbaikan untuk shift berikutnya. Tulis di catatan shift agar supervisor berikutnya tidak memulai dari nol.' },
    ],
    sop: { code: 'SOP-SUP-102', title: 'Briefing shift standar', points: ['Siapkan tiga angka kunci sebelum briefing.', 'Sebutkan satu target perilaku, bukan hanya target omzet.', 'Konfirmasi setiap orang tahu station-nya.', 'Catat kendala dan penanggung jawabnya.', 'Tutup dengan pertanyaan: ada yang menghambat?'] },
    quiz: [
      q('Bagian briefing yang paling sering dilewatkan tetapi paling penting adalah...', ['Kendala dan penanggung jawabnya', 'Daftar menu', 'Salam pembuka', 'Jadwal libur bulan depan'], 0, 'Tanpa penanggung jawab, kendala hanya menjadi keluhan.'),
      q('Kalimat koreksi yang paling tepat?', ['Perilaku disebut, bukan orangnya', 'Menyebut nama di depan semua orang untuk efek jera', 'Diamkan sampai evaluasi bulanan', 'Sampaikan lewat grup tanpa konteks'], 0, 'Fokus pada perilaku menjaga harga diri dan kejelasan.'),
      q('Target perilaku pada briefing berguna karena...', ['Mengarahkan perhatian tim pada satu hal yang bisa diperbaiki hari itu', 'Menambah panjang briefing', 'Menggantikan target omzet', 'Membuat tim takut'], 0, 'Satu fokusperbaikan lebih efektif daripada daftar panjang.'),
    ],
    rubric: [rb('Kelengkapan struktur briefing', 40), rb('Kejelasan instruksi', 30), rb('Penutupan shift dan catatan', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Praktik briefing dinilai trainer langsung (minimal 85).',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-103', title: 'Pembagian Tugas & Alur Antrean', track: 'leadership', level: 'SUP', duration: 45,
    summary: 'Menaikkan kapasitas shift tanpa menambah orang: station, batching, dan akses kasir.',
    objectives: [
      'Memetakan station bar dan menempatkan orang sesuai kecepatan serta kompetensinya.',
      'Mengenali bottleneck antrean pada jam sibuk dan mengambil tindakan dalam 5 menit.',
      'Mengatur antrean agar tidak menumpuk di satu titik (kasir, pickup, bar).',
    ],
    relevance: 'Waktu tunggu adalah keluhan nomor satu di jam sibuk, dan penyebabnya lebih sering alur kerja daripada jumlah orang.',
    prerequisites: ['SUP-102'],
    materials: [
      { title: 'Station dan kompetensi', media: 'Teks', body: 'Pisahkan station espresso, milk, kasir, dan runner. Tempatkan orang tercepat di bottleneck, bukan di station yang paling nyaman baginya. Barista yang belum lulus asesmen praktik bekerja berpasangan, bukan sendiri.' },
      { title: 'Membaca bottleneck', media: 'Teks', body: 'Bottleneck terlihat dari tumpukan: cangkir menunggu susu berarti milk station lambat; struk menumpuk di bar berarti espresso lambat; antrean panjang di kasir tetapi bar kosong berarti kasir lambat. Pindahkan satu orang ke titik tumpukan, bukan menambah orang di semua titik.' },
      { title: 'Batching dan urutan', media: 'Teks', body: 'Kumpulkan pesanan dengan profil sama (mis. empat latte) dan kerjakan berurutan, bukan satu per satu. Dahulukan pesanan minuman panas sederhana saat antrean memanjang, dan tawarkan alternatif menu cepat untuk pesanan besar.' },
    ],
    sop: { code: 'SOP-SUP-103', title: 'Manajemen antrean jam sibuk', points: ['Sebelum jam sibuk: cek par stock susu, cup, dan es.', 'Tentukan station dan pasangan kerja.', 'Pantau tumpukan setiap 10 menit.', 'Buka jalur pickup terpisah saat antrean melewati 6 orang.', 'Catat waktu tunggu akhir shift.'] },
    quiz: [
      q('Cara paling tepat mengatasi bottleneck adalah...', ['Memindahkan kapasitas ke titik yang menumpuk', 'Menambah orang di semua station', 'Menurunkan standar penyajian', 'Mengurangi jumlah menu saat ramai tanpa informasi'], 0, 'Perbaikan alur lebih murah daripada menambah orang.'),
      q('Tumpukan struk di bar dengan kasir lengang menandakan...', ['Espresso/bar lambat', 'Kasir lambat', 'Pelanggan sedikit', 'Stok susu habis'], 0, 'Struk menumpuk berarti pesanan tidak diproses di bar.'),
      q('Batching berarti...', ['Mengelompokkan pesanan berprofil sama dan mengerjakannya berurutan', 'Membuat semua pesanan sekaligus tanpa urutan', 'Menunda semua pesanan besar', 'Mengurangi jumlah barista'], 0, 'Batching mengurangi perpindahan kerja dan menjaga konsistensi.'),
    ],
    rubric: [rb('Penempatan orang sesuai kompetensi', 35), rb('Kecepatan respons terhadap bottleneck', 35), rb('Keputusan alur antrean', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Observasi satu jam sibuk dengan waktu tunggu terukur.',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-104', title: 'Coaching & Umpan Balik', track: 'leadership', level: 'SUP', duration: 50,
    summary: 'Membuat orang lain lebih baik: percakapan SBI, coaching bertanya, dan umpan balik ke rekan senior.',
    objectives: [
      'Menyampaikan umpan balik dengan kerangka Situation-Behavior-Impact.',
      'Membedakan instruksi, mentoring, dan coaching serta memilih yang tepat.',
      'Memberi umpan balik ke rekan yang lebih senior tanpa merusak hubungan kerja.',
    ],
    relevance: 'Supervisor yang hanya memberi instruksi akan selalu kehabisan waktu; coaching membuat tim mampu memutuskan sendiri.',
    prerequisites: ['SUP-103'],
    materials: [
      { title: 'Kerangka SBI', media: 'Teks', body: 'Situation: kapan dan di mana. Behavior: perilaku spesifik yang terlihat. Impact: dampaknya pada pelanggan, tim, atau biaya. Contoh: "Tadi jam 9 saat antrean panjang (S), tiga shot dibuang karena tidak ditimbang (B), pelanggan menunggu 2 menit lebih lama dan kita rugi bahan (I)."' },
      { title: 'Instruksi, mentoring, coaching', media: 'Teks', body: 'Instruksi dipakai saat risiko tinggi dan waktu sempit (mis. alat berbahaya). Mentoring dipakai saat orang butuh pengalaman Anda. Coaching dipakai saat orang punya cukup pengetahuan tetapi perlu berpikir sendiri: ajukan pertanyaan, jangan langsung memberi jawaban.' },
      { title: 'Umpan balik ke senior', media: 'Teks', body: 'Minta izin singkat, gunakan data, dan hindari menyalahkan: "Boleh saya sampaikan satu observasi soal setelan grinder pagi ini?" Bila tidak ada perubahan berulang, bawa ke manajer dengan catatan, bukan ke grup tim.' },
    ],
    sop: { code: 'SOP-SUP-104', title: 'Percakapan coaching 10 menit', points: ['Pilih satu perilaku yang bisa diubah.', 'Tanyakan pendapat orang tersebut lebih dulu.', 'Sampaikan observasi dengan SBI.', 'Sepakati satu tindakan dan tenggatnya.', 'Catat dan tinjau pada shift berikutnya.'] },
    quiz: [
      q('Urutan kerangka SBI yang benar?', ['Situation, Behavior, Impact', 'Story, Blame, Instruction', 'Skill, Behavior, Idea', 'Situation, Blame, Intention'], 0, 'SBI menjaga umpan balik tetap spesifik dan tidak menyerang pribadi.'),
      q('Coaching paling tepat dipakai ketika...', ['Orang sudah tahu caranya tetapi perlu memutuskan sendiri', 'Ada bahaya keselamatan langsung', 'Karyawan baru hari pertama', 'Alat rusak dan harus diperbaiki'], 0, 'Coaching menumbuhkan kemandirian berpikir.'),
      q('Umpan balik ke rekan senior sebaiknya...', ['Minta izin, pakai data, dan disampaikan empat mata', 'Disampaikan di grup tim', 'Didiamkan sampai evaluasi tahunan', 'Disampaikan lewat pelanggan'], 0, 'Cara dan konteks menentukan diterima atau tidaknya umpan balik.'),
    ],
    rubric: [rb('Penggunaan kerangka SBI', 40), rb('Kualitas pertanyaan coaching', 30), rb('Etika umpan balik ke senior', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Simulasi satu percakapan coaching dinilai trainer (minimal 85).',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-105', title: 'Eskalasi Keluhan & Pemulihan Layanan', track: 'leadership', level: 'SUP', duration: 45,
    summary: 'Menangani keluhan sulit di lantai dan memulihkan kepercayaan pelanggan tanpa membuka kerugian baru.',
    objectives: [
      'Menerapkan urutan Listen-Apologize-Solve-Thank dengan batas kewenangan yang jelas.',
      'Membedakan keluhan produk, layanan, dan kebijakan serta menanganinya sesuai jalur.',
      'Menutup kasus dengan catatan yang bisa dipakai manajer untuk perbaikan.',
    ],
    relevance: 'Satu keluhan yang ditangani buruk di depan antrean menghapus kerja pemasaran sebulan.',
    prerequisites: ['SUP-104'],
    materials: [
      { title: 'Urutan LAST', media: 'Teks', body: 'Listen tanpa memotong, Apologize untuk pengalaman pelanggan (bukan mengakui kesalahan yang belum terbukti), Solve dengan pilihan konkret, Thank karena sudah memberi tahu. Hindari menjelaskan SOP panjang di depan pelanggan yang masih marah.' },
      { title: 'Batas kewenangan', media: 'Teks', body: 'Supervisor boleh mengganti minuman, memberi satu item kompensasi kecil, dan mempercepat pesanan. Yang harus dieskalasi: refund uang, keluhan yang menyangkut kesehatan, ancaman di media sosial, dan permintaan kompensasi berulang dari pelanggan yang sama.' },
      { title: 'Catatan kasus', media: 'Teks', body: 'Catat waktu, produk, jenis keluhan, tindakan, dan hasilnya. Tiga keluhan sejenis dalam sepekan bukan masalah orang, tetapi masalah proses dan harus masuk agenda perbaikan manajer.' },
    ],
    sop: { code: 'SOP-SUP-105', title: 'Penanganan keluhan di lantai', points: ['Bawa pelanggan menjauh dari antrean bila perlu.', 'Dengarkan sampai selesai tanpa membela diri.', 'Tawarkan dua pilihan penyelesaian.', 'Catat kasus sebelum shift berakhir.', 'Eskalasi bila melewati batas kewenangan.'] },
    quiz: [
      q('Urutan LAST adalah...', ['Listen, Apologize, Solve, Thank', 'Look, Ask, Sell, Thank', 'Listen, Argue, Solve, Talk', 'Look, Apologize, Stop, Transfer'], 0, 'Urutan ini menjaga pelanggan merasa didengar sebelum solusi.'),
      q('Permintaan yang harus dieskalasi ke manajer?', ['Refund uang', 'Mengganti minuman yang tumpah', 'Mempercepat pesanan', 'Memberi satu kudapan kecil'], 0, 'Refund menyentuh kas dan kebijakan, bukan wewenang lantai.'),
      q('Tiga keluhan sejenis dalam sepekan menandakan...', ['Ada masalah proses yang perlu diperbaiki', 'Pelanggan terlalu sensitif', 'Tim malas', 'Cuaca buruk'], 0, 'Pola keluhan adalah sinyal proses, bukan kebetulan.'),
    ],
    rubric: [rb('Penerapan urutan LAST', 40), rb('Kepatuhan batas kewenangan', 30), rb('Kualitas catatan kasus', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Simulasi keluhan sulit dinilai trainer (minimal 85).',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-106', title: 'Kontrol Kualitas di Lini', track: 'leadership', level: 'SUP', duration: 40,
    summary: 'Titik kontrol kualitas yang bisa dijalankan supervisor tanpa menghentikan produksi.',
    objectives: [
      'Menjalankan tiga titik kontrol: bahan masuk, proses seduh, dan penyajian.',
      'Mengambil sampel rasa secara berkala dan mencatat penyimpangan.',
      'Memutuskan kapan harus stop menjual satu produk atau batch.',
    ],
    relevance: 'Kualitas yang hanya dicek saat ada keluhan berarti Anda sudah terlambat.',
    prerequisites: ['SUP-103'],
    materials: [
      { title: 'Tiga titik kontrol', media: 'Teks', body: 'Bahan masuk: suhu susu, tanggal kedaluwarsa, kondisi green bean. Proses: dosis, waktu shot (25-32 detik), suhu susu 55-65 derajat. Penyajian: suhu minuman, kebersihan cangkir, kesesuaian pesanan.' },
      { title: 'Sampling rasa', media: 'Teks', body: 'Minimal dua kali per shift pada jam berbeda, dan setiap kali grinder diubah. Bandingkan dengan profil rasa standar: manis, asam, pahit, aftertaste. Catat satu kata untuk setiap komponen agar trennya terlihat.' },
      { title: 'Kapan berhenti menjual', media: 'Teks', body: 'Stop menjual bila bahan tidak sesuai standar (susu asam, biji apek), alat tidak stabil, atau reject rate tinggi tanpa penyebab jelas. Stop sementara lebih murah daripada sepuluh minuman gagal dan satu ulasan buruk.' },
    ],
    sop: { code: 'SOP-SUP-106', title: 'Checklist kualitas shift', points: ['Cek suhu chiller dan susu saat membuka.', 'Timbang dosis dan ukur waktu shot di awal shift.', 'Catat sampel rasa dua kali per shift.', 'Tandai produk yang dihentikan sementara beserta alasannya.', 'Laporkan penyimpangan berulang ke manajer.'] },
    quiz: [
      q('Rentang suhu susu yang dianjurkan untuk latte?', ['55-65 derajat Celsius', '80-90 derajat Celsius', '30-40 derajat Celsius', 'Tidak ada standar'], 0, 'Di atas 70 derajat susu kehilangan rasa manis alami.'),
      q('Waktu shot espresso yang wajar?', ['25-32 detik', '5-10 detik', '60-90 detik', 'Tidak diukur'], 0, 'Waktu shot adalah indikator paling cepat untuk setelan grinder.'),
      q('Menghentikan penjualan satu produk sebaiknya dilakukan ketika...', ['Bahan atau alat tidak lagi memenuhi standar kualitas', 'Antrean terlalu panjang', 'Stok cup menipis', 'Ada promo lain'], 0, 'Kualitas yang gagal lebih mahal daripada satu menu yang kosong.'),
    ],
    rubric: [rb('Ketepatan titik kontrol', 40), rb('Konsistensi sampling dan pencatatan', 30), rb('Keputusan stop jual', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Audit kualitas satu shift dengan catatan lengkap.',
    owner: 'Head Barista',
  },
  {
    code: 'SUP-107', title: 'Kas, Void & Serah Terima', track: 'leadership', level: 'SUP', duration: 45,
    summary: 'Administrasi shift yang rapi: hitung kas, kewenangan void, absensi, dan serah terima tanpa selisih.',
    objectives: [
      'Menjalankan penutupan kas dengan selisih nol dan bukti yang lengkap.',
      'Menggunakan void dan refund sesuai kewenangan serta mencatat alasannya.',
      'Menutup shift dengan serah terima yang bisa diaudit.',
    ],
    relevance: 'Selisih kas kecil yang dibiarkan menjadi kebiasaan besar, dan void tanpa alasan adalah pintu kebocoran pendapatan.',
    prerequisites: ['SUP-101'],
    materials: [
      { title: 'Penutupan kas', media: 'Teks', body: 'Hitung kas fisik dua kali dengan saksi, cocokkan dengan laporan sistem, dan catat selisih beserta dugaan penyebabnya. Selisih di atas ambang yang ditetapkan manajer wajib dilaporkan hari yang sama.' },
      { title: 'Void dan refund', media: 'Teks', body: 'Void hanya untuk transaksi yang benar-benar gagal (salah input, pelanggan batal sebelum dibuat). Setiap void wajib punya alasan dan pelaku. Void berulang pada jam atau kasir yang sama adalah sinyal kecurangan, bukan kesalahan teknis.' },
      { title: 'Serah terima', media: 'Teks', body: 'Serahkan kas, kunci, catatan shift, stok kritis, dan alat bermasalah. Tanda tangan kedua pihak. Supervisor pagi meninjau catatan shift malam sebelum operasional, bukan sesudah masalah muncul.' },
    ],
    sop: { code: 'SOP-SUP-107', title: 'Penutupan kas & serah terima', points: ['Hitung kas dengan saksi.', 'Cocokkan dengan laporan sistem per metode bayar.', 'Periksa daftar void dan alasannya.', 'Catat stok kritis dan alat bermasalah.', 'Serahkan kunci dan catatan dengan tanda tangan.'] },
    quiz: [
      q('Selisih kas di atas ambang harus...', ['Dilaporkan pada hari yang sama', 'Ditutupi dari tip', 'Diabaikan bila kecil', 'Dicatat bulan berikutnya'], 0, 'Pelaporan cepat mencegah kebiasaan dan kecurangan.'),
      q('Void yang sah adalah...', ['Transaksi gagal dengan alasan dan pelaku tercatat', 'Menghapus transaksi setelah pelanggan pulang', 'Menggabungkan beberapa transaksi', 'Mengubah metode bayar'], 0, 'Void harus dapat diaudit lengkap.'),
      q('Serah terima shift wajib memuat...', ['Kas, kunci, catatan shift, stok kritis, alat bermasalah', 'Hanya kunci', 'Daftar menu besok', 'Jadwal libur'], 0, 'Semua elemen itu dibutuhkan shift berikutnya untuk bekerja aman.'),
    ],
    rubric: [rb('Ketelitian penutupan kas', 40), rb('Kepatuhan prosedur void', 30), rb('Kelengkapan serah terima', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Satu penutupan kas diawasi manajer tanpa selisih tidak terjelaskan.',
    owner: 'Manajer Outlet',
  },
  {
    code: 'SUP-108', title: 'Higiene, Keselamatan & Kepatuhan Lantai', track: 'leadership', level: 'SUP', duration: 40,
    summary: 'Menjaga standar higiene dan keselamatan berjalan setiap hari, bukan hanya saat audit.',
    objectives: [
      'Menjalankan checklist higiene harian dan mingguan sesuai area.',
      'Mengenali bahaya kerja di bar dan mengambil tindakan pencegahan.',
      'Mencatat dan menindaklanjuti near miss tanpa mencari kambing hitam.',
    ],
    relevance: 'Satu insiden higiene bisa menutup outlet; pencegahan harian jauh lebih murah daripada pemulihan reputasi.',
    prerequisites: ['SUP-106'],
    materials: [
      { title: 'Zona higiene', media: 'Teks', body: 'Pisahkan area bersih (penyajian, es, susu) dan area kotor (cuci, sampah, knock box). Alat pembersih tidak boleh melewati batas zona. Cuci tangan wajib setelah menyentuh uang, sampah, atau lantai.' },
      { title: 'Bahaya di bar', media: 'Teks', body: 'Bahaya utama: air panas dan uap, permukaan basah, kabel mesin, tabung gas, dan alat tajam. Periksa selang dan regulator gas setiap membuka, dan jangan menaruh cairan panas di jalur pelanggan.' },
      { title: 'Near miss', media: 'Teks', body: 'Kejadian hampir celaka dicatat tanpa menyalahkan orang: apa yang terjadi, apa penyebabnya, apa yang diubah. Catatan near miss adalah data perbaikan, bukan bahan hukuman.' },
    ],
    sop: { code: 'SOP-SUP-108', title: 'Higiene & keselamatan harian', points: ['Cek suhu chiller dan freezer saat buka.', 'Pastikan sabun, sanitizer, dan lap bersih tersedia.', 'Periksa kabel, selang gas, dan permukaan basah.', 'Bersihkan area sesuai jadwal zona.', 'Catat near miss dan tindak lanjutnya.'] },
    quiz: [
      q('Prinsip pemisahan zona higiene adalah...', ['Area bersih dan kotor tidak boleh saling melewati', 'Semua area dibersihkan sekaligus', 'Area kotor cukup dibersihkan malam', 'Zona hanya berlaku saat audit'], 0, 'Kontaminasi silang adalah penyebab utama masalah higiene.'),
      q('Near miss sebaiknya...', ['Dicatat tanpa menyalahkan orang untuk perbaikan', 'Disembunyikan agar tidak panik', 'Dijadikan bahan teguran', 'Dilaporkan sebulan sekali saja'], 0, 'Near miss adalah data perbaikan termurah.'),
      q('Tindakan yang benar saat mencium bau gas?', ['Hentikan penggunaan, matikan sumber, buka ventilasi, lapor', 'Nyalakan exhaust saja', 'Lanjutkan produksi sambil mencari sumber', 'Tutup semua jendela'], 0, 'Keselamatan didahulukan sebelum penjualan.'),
    ],
    rubric: [rb('Kepatuhan checklist higiene', 40), rb('Identifikasi bahaya', 30), rb('Pelaporan near miss', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Audit higiene satu shift oleh trainer (minimal 85).',
    owner: 'Manajer Outlet',
  },
];

// ---------------------------------------------------------------- M2 · Manajer unit/outlet

const MGR = [
  {
    code: 'MGR-101', title: 'Membaca Angka Outlet', track: 'leadership', level: 'MGR', duration: 55,
    summary: 'Lima angka yang menentukan sehat tidaknya satu outlet: omzet, HPP, prime cost, biaya tenaga kerja, dan laba.',
    objectives: [
      'Menghitung HPP, margin kotor, prime cost, dan laba operasi satu outlet dari data bulanan.',
      'Menjelaskan penyebab turunnya margin tanpa menebak.',
      'Menetapkan satu prioritas perbaikan berdasarkan angka, bukan perasaan.',
    ],
    relevance: 'Manajer yang tidak membaca angka akan sibuk pada hal yang tidak mengubah laba.',
    prerequisites: ['SUP-107'],
    materials: [
      { title: 'Lima angka inti', media: 'Teks', body: 'Omzet (penjualan bersih setelah diskon), HPP (harga pokok dari resep), margin kotor (omzet dikurangi HPP), prime cost (HPP ditambah biaya tenaga kerja), dan laba operasi (setelah beban operasional). Prime cost di atas 65 persen biasanya membuat outlet sulit menabung untuk perbaikan.' },
      { title: 'Mencari penyebab', media: 'Teks', body: 'Margin turun bisa berasal dari tiga hal: harga jual tidak naik saat biaya bahan naik, porsi atau susut membesar, atau diskon terlalu sering. Periksa satu per satu dengan data: bandingkan HPP teoritis resep dengan nilai persediaan aktual.' },
      { title: 'Satu prioritas', media: 'Teks', body: 'Pilih satu tuas dengan dampak terbesar dan usaha paling kecil. Contoh: menaikkan harga dua menu terlaris 5 persen mungkin lebih berdampak daripada menegur seluruh tim soal waste.' },
    ],
    sop: { code: 'SOP-MGR-101', title: 'Tinjauan angka bulanan outlet', points: ['Tarik laporan laba rugi bulan ini dan bulan lalu.', 'Bandingkan HPP aktual dengan HPP resep.', 'Hitung prime cost dan bandingkan dengan target.', 'Tandai dua penyimpangan terbesar.', 'Tetapkan satu perbaikan dengan penanggung jawab dan tenggat.'] },
    quiz: [
      q('Prime cost adalah...', ['HPP ditambah biaya tenaga kerja', 'Omzet dikurangi diskon', 'Total beban operasional', 'Laba bersih setelah pajak'], 0, 'Prime cost adalah biaya yang paling langsung dikendalikan outlet.'),
      q('Margin kotor turun padahal harga jual tetap. Penyebab paling mungkin?', ['HPP naik atau susut bahan membesar', 'Jumlah pelanggan turun', 'Biaya listrik naik', 'Jam operasional berubah'], 0, 'Margin kotor hanya terpengaruh harga jual dan HPP.'),
      q('Cara memastikan HPP aktual menyimpang dari resep?', ['Bandingkan nilai persediaan aktual dengan pemakaian teoritis resep', 'Menanyakan ke barista', 'Melihat jumlah keluhan', 'Menghitung jumlah pengunjung'], 0, 'Perbandingan pemakaian teoritis dan aktual menunjukkan selisih nyata.'),
    ],
    rubric: [rb('Ketepatan perhitungan lima angka', 40), rb('Analisis penyebab berbasis data', 35), rb('Prioritas perbaikan', 25)],
    passTheory: 80, passPractical: 85,
    gate: 'Membuat tinjauan angka satu outlet yang lolos review direktur.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-102', title: 'Perencanaan Tenaga Kerja & Produktivitas', track: 'leadership', level: 'MGR', duration: 50,
    summary: 'Menempatkan orang pada jam yang menghasilkan uang, tanpa lembur yang tidak perlu.',
    objectives: [
      'Menghitung kebutuhan tenaga kerja dari pola kunjungan per jam.',
      'Mengukur produktivitas dengan transaksi per jam kerja dan biaya tenaga kerja terhadap omzet.',
      'Menyusun jadwal yang menekan lembur dan tetap memenuhi standar layanan.',
    ],
    relevance: 'Biaya tenaga kerja adalah biaya terbesar kedua setelah bahan, dan jadwal adalah alat utamanya.',
    prerequisites: ['MGR-101'],
    materials: [
      { title: 'Pola kunjungan', media: 'Teks', body: 'Tarik penjualan per jam selama empat pekan. Sebagian besar outlet kopi punya dua puncak: pagi dan sore. Jadwal harus mengikuti puncak, bukan pembagian rata sepanjang hari.' },
      { title: 'Produktivitas', media: 'Teks', body: 'Transaksi per jam kerja mengukur efisiensi, tetapi jangan dipakai sendiri: waktu tunggu dan keluhan harus tetap dalam batas. Biaya tenaga kerja idealnya 20-28 persen dari omzet untuk kafe dengan layanan meja.' },
      { title: 'Mengendalikan lembur', media: 'Teks', body: 'Lembur muncul dari penutupan yang lambat, absen mendadak, dan jadwal yang tidak cocok. Siapkan daftar pengganti lintas outlet, dan tetapkan batas lembur per orang per pekan.' },
    ],
    sop: { code: 'SOP-MGR-102', title: 'Menyusun jadwal dua pekan', points: ['Tarik data penjualan per jam empat pekan terakhir.', 'Tentukan kebutuhan orang per jam.', 'Cocokkan dengan kompetensi dan ketersediaan.', 'Sisakan satu pengganti per pekan.', 'Tinjau lembur dan waktu tunggu setelah jadwal berjalan.'] },
    quiz: [
      q('Jadwal tenaga kerja sebaiknya mengikuti...', ['Pola kunjungan per jam', 'Kesukaan karyawan', 'Jumlah menu', 'Jadwal pengiriman bahan'], 0, 'Tenaga kerja harus mengikuti permintaan.'),
      q('Rasio biaya tenaga kerja terhadap omzet yang wajar untuk kafe layanan meja?', ['20-28 persen', '5-10 persen', '45-55 persen', 'Tidak perlu diukur'], 0, 'Di atas 30 persen biasanya menekan margin secara signifikan.'),
      q('Transaksi per jam kerja tidak boleh dipakai sendirian karena...', ['Bisa membaik dengan mengorbankan waktu tunggu dan kualitas', 'Sulit dihitung', 'Tidak tersedia di laporan', 'Hanya berlaku untuk barista'], 0, 'Produktivitas harus dilihat bersama kualitas layanan.'),
    ],
    rubric: [rb('Ketepatan proyeksi kebutuhan orang', 40), rb('Kualitas jadwal', 30), rb('Pengendalian lembur', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Menyusun jadwal dua pekan dengan lembur di bawah batas.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-103', title: 'Pengendalian HPP & Susut', track: 'leadership', level: 'MGR', duration: 50,
    summary: 'Menutup kebocoran bahan: selisih resep, over-pour, dan waste yang tidak tercatat.',
    objectives: [
      'Menghitung varians pemakaian bahan aktual terhadap teoritis.',
      'Mengidentifikasi lima sumber susut paling umum di kafe.',
      'Membangun log waste dan ritual peninjauan mingguan.',
    ],
    relevance: 'Susut 3 persen dari HPP terlihat kecil, tetapi pada omzet ratusan juta per bulan nilainya setara satu karyawan.',
    prerequisites: ['MGR-101'],
    materials: [
      { title: 'Varians pemakaian', media: 'Teks', body: 'Pemakaian teoritis dihitung dari resep dikali jumlah terjual. Selisih terhadap pemakaian nyata adalah varians. Varians konsisten di satu bahan menandakan resep salah catat atau porsi berlebih, bukan sekadar kesalahan orang.' },
      { title: 'Lima sumber susut', media: 'Teks', body: 'Over-pour susu, shot gagal tanpa pencatatan, minuman uji coba tanpa otorisasi, stok kedaluwarsa, dan pemakaian pribadi. Setiap sumber perlu penanganan berbeda: alat ukur, pelatihan, otorisasi, rotasi stok, dan aturan tegas.' },
      { title: 'Log waste', media: 'Teks', body: 'Catat setiap pembuangan: bahan, jumlah, alasan, pelaku. Tinjau mingguan, cari pola pada jam atau orang tertentu. Target realistis untuk kafe specialty adalah waste di bawah 2 persen dari HPP.' },
    ],
    sop: { code: 'SOP-MGR-103', title: 'Peninjauan susut mingguan', points: ['Hitung pemakaian teoritis dari resep dan penjualan.', 'Bandingkan dengan mutasi stok aktual.', 'Urutkan selisih terbesar.', 'Tentukan penyebab paling mungkin dan aksinya.', 'Tinjau ulang pekan berikutnya.'] },
    quiz: [
      q('Varians pemakaian bahan adalah...', ['Selisih pemakaian aktual dengan pemakaian teoritis dari resep', 'Selisih harga beli antar pemasok', 'Jumlah stok di gudang', 'Total pembelian bulan ini'], 0, 'Varians menunjukkan kebocoran nyata di operasional.'),
      q('Over-pour susu paling efektif dikendalikan dengan...', ['Alat ukur dan kalibrasi rutin', 'Menegur barista', 'Menambah menu', 'Menaikkan harga'], 0, 'Alat ukur mengubah kebiasaan tanpa perlu pengawasan terus-menerus.'),
      q('Target waste yang wajar untuk kafe specialty?', ['Di bawah 2 persen dari HPP', '10-15 persen', 'Tidak perlu diukur', '25 persen'], 0, 'Di atas 3 persen biasanya sudah menekan margin secara nyata.'),
    ],
    rubric: [rb('Perhitungan varians', 40), rb('Identifikasi sumber susut', 30), rb('Ritual peninjauan mingguan', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Menyerahkan analisis varians satu bulan dengan rencana aksi.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-104', title: 'Manajemen Stok & Pemasok', track: 'leadership', level: 'MGR', duration: 45,
    summary: 'Stok cukup tanpa menumpuk modal: par level, lead time, dan penilaian pemasok.',
    objectives: [
      'Menetapkan par level dan titik pemesanan ulang per bahan.',
      'Menilai pemasok dengan harga, ketepatan waktu, dan konsistensi mutu.',
      'Menjalankan stock opname yang hasilnya bisa dipercaya.',
    ],
    relevance: 'Stok habis kehilangan penjualan, stok menumpuk mengunci modal dan menua. Keduanya bisa dihindari dengan angka sederhana.',
    prerequisites: ['MGR-103'],
    materials: [
      { title: 'Par level dan reorder point', media: 'Teks', body: 'Par level adalah stok maksimum yang wajar untuk satu periode. Titik pemesanan ulang = pemakaian harian rata-rata dikali lead time ditambah stok pengaman. Bahan dengan lead time panjang butuh pengaman lebih besar.' },
      { title: 'Menilai pemasok', media: 'Teks', body: 'Nilai tiga hal: harga (bandingkan per satuan, bukan per kemasan), ketepatan waktu, dan konsistensi mutu. Satu pemasok cadangan per bahan kritis lebih murah daripada kehilangan penjualan sehari.' },
      { title: 'Stock opname', media: 'Teks', body: 'Hitung fisik tanpa melihat catatan sistem lebih dulu. Lakukan pada waktu yang sama setiap bulan, dengan dua orang. Selisih dicatat per bahan, bukan hanya total, agar sumbernya bisa dilacak.' },
    ],
    sop: { code: 'SOP-MGR-104', title: 'Pengelolaan stok bulanan', points: ['Perbarui par level dari pemakaian tiga bulan terakhir.', 'Tetapkan titik pemesanan ulang.', 'Catat lead time tiap pemasok.', 'Lakukan stock opname blind count.', 'Tinjau selisih dan tindak lanjutnya.'] },
    quiz: [
      q('Titik pemesanan ulang dihitung dari...', ['Pemakaian harian rata-rata dikali lead time ditambah stok pengaman', 'Setengah par level', 'Jumlah stok terakhir', 'Harga bahan'], 0, 'Rumus ini mencegah habis tanpa menumpuk.'),
      q('Stock opname yang baik dilakukan dengan...', ['Blind count oleh dua orang pada waktu yang konsisten', 'Melihat catatan sistem lebih dulu', 'Satu orang agar cepat', 'Hanya pada bahan mahal'], 0, 'Blind count mencegah penyesuaian sadar terhadap catatan.'),
      q('Harga pemasok sebaiknya dibandingkan...', ['Per satuan bahan', 'Per kemasan', 'Per pengiriman', 'Per faktur'], 0, 'Kemasan berbeda ukuran membuat perbandingan menyesatkan.'),
    ],
    rubric: [rb('Penetapan par level', 35), rb('Penilaian pemasok', 30), rb('Kualitas stock opname', 35)],
    passTheory: 80, passPractical: 85,
    gate: 'Menetapkan par level seluruh bahan kritis outlet.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-105', title: 'Penjualan & Pemasaran Lokal', track: 'leadership', level: 'MGR', duration: 50,
    summary: 'Menumbuhkan penjualan outlet dengan campuran kanal, promo terukur, dan basis member.',
    objectives: [
      'Membaca campuran kanal (walk-in, B2C member, B2B) dan kontribusinya.',
      'Menilai efektivitas promo dengan kenaikan penjualan bersih, bukan jumlah kupon.',
      'Menyusun rencana akuisisi member dan penjualan B2B di area sekitar.',
    ],
    relevance: 'Promo yang tidak diukur hanya memindahkan penjualan yang sudah ada sambil memotong margin.',
    prerequisites: ['MGR-101'],
    materials: [
      { title: 'Campuran kanal', media: 'Teks', body: 'Walk-in memberi volume tetapi mahal diakuisisi; member memberi frekuensi dan data; B2B memberi nilai transaksi besar dengan margin lebih tipis. Outlet sehat punya minimal dua kanal yang berkontribusi.' },
      { title: 'Mengukur promo', media: 'Teks', body: 'Bandingkan penjualan bersih selama promo dengan periode sama sebelumnya, lalu kurangi biaya diskon dan bahan tambahan. Promo yang tidak menaikkan jumlah transaksi baru hanya memotong margin.' },
      { title: 'Akuisisi lokal', media: 'Teks', body: 'Untuk B2B, sasar kantor, kafe kecil, dan hotel dalam radius dekat dengan penawaran uji rasa. Untuk member, manfaatkan program poin: pastikan kasir menawarkan pendaftaran pada transaksi pertama, bukan sekadar memasang poster.' },
    ],
    sop: { code: 'SOP-MGR-105', title: 'Rencana pemasaran outlet bulanan', points: ['Tarik campuran kanal bulan lalu.', 'Pilih satu kanal yang akan ditumbuhkan.', 'Siapkan satu promo terukur dengan batas biaya.', 'Latih kasir menawarkan program member.', 'Tinjau hasil pada akhir bulan.'] },
    quiz: [
      q('Promo dinilai berhasil bila...', ['Penjualan bersih naik setelah dikurangi biaya diskon', 'Banyak kupon terpakai', 'Banyak unggahan media sosial', 'Jumlah menu bertambah'], 0, 'Kupon ramai belum tentu menambah laba.'),
      q('Kanal yang memberi data pelanggan dan frekuensi kunjungan adalah...', ['Member B2C', 'Walk-in', 'Pesanan tanpa identitas', 'Penjualan tunai tanpa kasir'], 0, 'Member menyimpan identitas dan riwayat transaksi.'),
      q('Penawaran B2B paling efektif dimulai dengan...', ['Uji rasa dan contoh produk ke kantor/kafe sekitar', 'Diskon besar tanpa syarat', 'Iklan nasional', 'Menambah jumlah outlet'], 0, 'Uji rasa menurunkan risiko bagi pembeli B2B.'),
    ],
    rubric: [rb('Analisis campuran kanal', 35), rb('Desain promo terukur', 35), rb('Rencana akuisisi lokal', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Menyusun rencana pemasaran bulanan dengan target dan batas biaya.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-106', title: 'Mengelola Kinerja Tim', track: 'leadership', level: 'MGR', duration: 55,
    summary: 'Dari penilaian tahunan ke percakapan kinerja rutin: target, umpan balik, dan disiplin yang adil.',
    objectives: [
      'Menetapkan indikator kinerja individu yang terhubung ke target outlet.',
      'Menjalankan percakapan kinerja bulanan dan rencana perbaikan yang terukur.',
      'Menerapkan tangga disiplin secara konsisten dan terdokumentasi.',
    ],
    relevance: 'Karyawan berkinerja rendah yang dibiarkan menurunkan standar seluruh tim lebih cepat daripada yang bisa diperbaiki.',
    prerequisites: ['SUP-104'],
    materials: [
      { title: 'Indikator individu', media: 'Teks', body: 'Pilih maksimal empat indikator: kualitas (reject rate), kecepatan (waktu tunggu), kedisiplinan (keterlambatan), dan kontribusi (member baru). Indikator harus bisa dipengaruhi karyawan, bukan hanya hasil outlet.' },
      { title: 'Percakapan bulanan', media: 'Teks', body: 'Tiga pertanyaan: apa yang berjalan baik, apa yang menghambat, dan apa satu hal yang disepakati bulan depan. Catat kesepakatan, bukan penilaian perasaan. Bila ada masalah berulang, buat rencana perbaikan dengan tenggat jelas.' },
      { title: 'Tangga disiplin', media: 'Teks', body: 'Percakapan lisan, catatan tertulis, peringatan, hingga tindakan sesuai kebijakan perusahaan. Setiap tahap butuh bukti dan kesempatan memperbaiki. Konsistensi lebih penting daripada beratnya sanksi.' },
    ],
    sop: { code: 'SOP-MGR-106', title: 'Percakapan kinerja bulanan', points: ['Siapkan data indikator tiap orang.', 'Mulai dari kekuatan nyata.', 'Bahas satu hambatan utama.', 'Sepakati satu target perilaku.', 'Catat dan tindak lanjuti.'] },
    quiz: [
      q('Indikator individu yang baik adalah...', ['Bisa dipengaruhi karyawan dan terhubung target outlet', 'Sama untuk semua posisi apa pun kondisinya', 'Hanya omzet outlet', 'Berdasarkan penilaian perasaan manajer'], 0, 'Indikator harus adil dan bisa dikendalikan.'),
      q('Rencana perbaikan kinerja wajib memiliki...', ['Tenggat, dukungan, dan cara mengukur', 'Sanksi langsung', 'Pengumuman ke tim', 'Pemotongan gaji otomatis'], 0, 'Perbaikan butuh kejelasan dan dukungan, bukan hanya ancaman.'),
      q('Yang lebih penting dalam disiplin?', ['Konsistensi penerapan', 'Beratnya sanksi', 'Kecepatan hukuman', 'Jumlah saksi'], 0, 'Konsistensi membangun kepercayaan pada aturan.'),
    ],
    rubric: [rb('Kualitas indikator individu', 35), rb('Percakapan kinerja', 35), rb('Dokumentasi disiplin', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Melakukan dua percakapan kinerja dengan catatan lengkap.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'MGR-107', title: 'Anggaran & Pengendalian Biaya', track: 'leadership', level: 'MGR', duration: 50,
    summary: 'Menyusun anggaran outlet dan menjaga belanja tetap pada jalurnya.',
    objectives: [
      'Menyusun anggaran bulanan outlet dari angka historis dan rencana pertumbuhan.',
      'Membedakan belanja modal dan biaya operasional beserta dampaknya ke laporan.',
      'Menjelaskan penyimpangan anggaran dengan analisis, bukan alasan umum.',
    ],
    relevance: 'Tanpa anggaran, setiap permintaan belanja menjadi negosiasi ulang dan biaya naik perlahan tanpa disadari.',
    prerequisites: ['MGR-102'],
    materials: [
      { title: 'Menyusun anggaran', media: 'Teks', body: 'Mulai dari omzet yang realistis (bukan target optimis), lalu HPP sesuai resep, biaya tenaga kerja sesuai jadwal, sewa dan utilitas tetap, lalu sisakan margin untuk perbaikan. Tambahkan buffer 3-5 persen untuk hal tak terduga.' },
      { title: 'Modal vs operasional', media: 'Teks', body: 'Pembelian mesin adalah belanja modal yang disusutkan, bukan biaya bulan berjalan. Salah menggolongkan membuat laba bulan ini terlihat buruk padahal investasinya bermanfaat bertahun-tahun.' },
      { title: 'Menjelaskan penyimpangan', media: 'Teks', body: 'Setiap penyimpangan di atas 5 persen perlu penjelasan yang bisa diuji: volume naik, harga bahan naik, atau pembelian tidak terencana. Sertakan tindakan koreksi dan dampaknya ke bulan berikutnya.' },
    ],
    sop: { code: 'SOP-MGR-107', title: 'Siklus anggaran bulanan', points: ['Tutup angka bulan lalu.', 'Susun anggaran bulan depan per pos.', 'Ajukan persetujuan direktur.', 'Pantau realisasi setiap pekan.', 'Jelaskan penyimpangan di atas 5 persen.'] },
    quiz: [
      q('Pembelian mesin espresso baru digolongkan sebagai...', ['Belanja modal yang disusutkan', 'Biaya operasional bulan ini', 'HPP penjualan', 'Piutang'], 0, 'Aset tetap dipakai bertahun-tahun dan disusutkan.'),
      q('Anggaran disusun dari...', ['Angka historis dan rencana realistis', 'Target paling optimis', 'Permintaan tiap karyawan', 'Sisa kas saja'], 0, 'Anggaran harus dapat dipertanggungjawabkan.'),
      q('Penyimpangan anggaran di atas 5 persen sebaiknya...', ['Dijelaskan dengan analisis dan tindakan koreksi', 'Dibiarkan sampai akhir tahun', 'Ditutupi dari pos lain', 'Dihapus dari laporan'], 0, 'Penjelasan yang bisa diuji menjaga kendali anggaran.'),
    ],
    rubric: [rb('Struktur anggaran', 35), rb('Klasifikasi modal/operasional', 30), rb('Analisis penyimpangan', 35)],
    passTheory: 80, passPractical: 85,
    gate: 'Menyusun anggaran outlet satu bulan yang disetujui direktur.',
    owner: 'Direktur Keuangan',
  },
  {
    code: 'MGR-108', title: 'Perbaikan Berkelanjutan & Manajemen Perubahan', track: 'leadership', level: 'MGR', duration: 45,
    summary: 'Menjalankan proyek perbaikan kecil dengan akar masalah yang benar dan hasil yang bertahan.',
    objectives: [
      'Menggunakan PDCA dan analisis akar masalah (5 why, diagram tulang ikan).',
      'Menjalankan uji coba kecil sebelum mengubah standar seluruh outlet.',
      'Membuat perubahan bertahan melalui standar, pelatihan, dan audit.',
    ],
    relevance: 'Sebagian besar perbaikan gagal bukan karena idenya salah, tetapi karena tidak dibakukan dan tidak diaudit.',
    prerequisites: ['MGR-103'],
    materials: [
      { title: 'PDCA singkat', media: 'Teks', body: 'Plan: satu masalah dengan ukuran jelas. Do: uji coba satu pekan pada satu shift. Check: bandingkan angka sebelum dan sesudah. Act: bakukan bila berhasil, ulangi siklus bila belum.' },
      { title: 'Akar masalah', media: 'Teks', body: 'Tanya mengapa sampai lima tingkat. Contoh: minuman terlambat, karena susu habis di bar, karena tidak ada par stock, karena checklist tidak jalan, karena supervisor tidak tahu tanggung jawabnya. Perbaikan pada tingkat akar bertahan lebih lama.' },
      { title: 'Membakukan perubahan', media: 'Teks', body: 'Perubahan bertahan bila masuk SOP, dilatih singkat, ada penanggung jawab, dan diperiksa berkala. Tanpa empat hal itu, semuanya kembali seperti semula dalam dua pekan.' },
    ],
    sop: { code: 'SOP-MGR-108', title: 'Proyek perbaikan 30 hari', points: ['Tulis masalah dan ukurannya.', 'Cari akar masalah dengan 5 why.', 'Uji satu solusi pada satu titik.', 'Bandingkan hasil sebelum dan sesudah.', 'Bakukan di SOP dan audit sesudahnya.'] },
    quiz: [
      q('Urutan PDCA yang benar?', ['Plan, Do, Check, Act', 'Plan, Check, Act, Do', 'Do, Plan, Act, Check', 'Check, Plan, Do, Act'], 0, 'Siklus dimulai dari rencana hingga pembakuan.'),
      q('Perbaikan yang menyentuh akar masalah lebih baik karena...', ['Hasilnya bertahan, bukan menutupi gejala', 'Lebih cepat dikerjakan', 'Tidak perlu uji coba', 'Tidak perlu biaya'], 0, 'Gejala akan muncul lagi bila akarnya tidak diperbaiki.'),
      q('Agar perubahan bertahan, wajib ada...', ['SOP, pelatihan, penanggung jawab, dan audit', 'Pengumuman di grup', 'Sanksi berat', 'Penambahan karyawan'], 0, 'Empat elemen itu menjaga standar baru berjalan.'),
    ],
    rubric: [rb('Kualitas analisis akar masalah', 40), rb('Desain uji coba', 30), rb('Pembakuan dan audit', 30)],
    passTheory: 80, passPractical: 85,
    gate: 'Menyelesaikan satu proyek perbaikan dengan hasil terukur.',
    owner: 'Direktur Operasional',
  },
];

// ---------------------------------------------------------------- E3 · Direktur, Chief & Owner

const DIR = [
  {
    code: 'DIR-101', title: 'Strategi & Model Bisnis Farm-to-Cup', track: 'leadership', level: 'DIR', duration: 60,
    summary: 'Dari mana laba benar-benar datang di rantai kebun, roastery, dan kafe — dan di mana harus bertaruh.',
    objectives: [
      'Memetakan rantai nilai dan margin di setiap tahap (green bean, roasting, retail).',
      'Menjelaskan sumber keunggulan yang sulit ditiru pesaing.',
      'Menyusun pilihan strategi tiga horizon: pertahankan, kembangkan, dan eksplorasi.',
    ],
    relevance: 'Tanpa peta margin per tahap, ekspansi bisa menambah omzet sekaligus menurunkan laba.',
    prerequisites: ['MGR-101'],
    materials: [
      { title: 'Rantai nilai dan margin', media: 'Teks', body: 'Green bean memberi margin tipis dengan volume besar; roasting menambah nilai paling besar per kilogram; kafe retail memberi margin per cangkir tinggi tetapi menanggung sewa dan tenaga kerja. Keputusan penting: di tahap mana perusahaan ingin menang.' },
      { title: 'Keunggulan yang bertahan', media: 'Teks', body: 'Keunggulan yang sulit ditiru biasanya kombinasi pasokan sendiri, konsistensi mutu, dan hubungan pelanggan. Diskon dan desain interior mudah ditiru, sehingga bukan fondasi strategi.' },
      { title: 'Tiga horizon', media: 'Teks', body: 'Horizon 1: pertahankan outlet dan kanal yang sudah menghasilkan. Horizon 2: kembangkan yang terbukti (mis. wholesale ke kafe lain). Horizon 3: eksplorasi kecil berisiko terbatas (mis. produk siap minum). Alokasikan sumber daya eksplisit untuk ketiganya.' },
    ],
    sop: { code: 'SOP-DIR-101', title: 'Kajian strategi tahunan', points: ['Hitung margin per tahap rantai nilai.', 'Identifikasi tiga sumber keunggulan nyata.', 'Tetapkan prioritas untuk tiga horizon.', 'Sepakati ukuran keberhasilan tiap horizon.', 'Tinjau setiap kuartal.'] },
    quiz: [
      q('Tahap rantai nilai yang biasanya memberi tambahan nilai terbesar per kilogram adalah...', ['Roasting', 'Green bean', 'Kemasan', 'Distribusi'], 0, 'Roasting mengubah komoditas menjadi produk bernilai tinggi.'),
      q('Yang termasuk keunggulan sulit ditiru?', ['Pasokan sendiri yang konsisten mutunya', 'Harga diskon', 'Interior kekinian', 'Iklan besar'], 0, 'Kombinasi pasokan dan mutu butuh waktu untuk ditiru.'),
      q('Horizon 3 dalam strategi berarti...', ['Eksplorasi berisiko terbatas untuk peluang baru', 'Mempertahankan bisnis inti', 'Menutup outlet yang rugi', 'Mengurangi biaya'], 0, 'Horizon 3 menyiapkan masa depan dengan risiko terkendali.'),
    ],
    rubric: [rb('Peta margin rantai nilai', 40), rb('Analisis keunggulan', 30), rb('Alokasi tiga horizon', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Menyusun dokumen strategi satu halaman yang disetujui pemegang saham.',
    owner: 'Direktur Utama',
  },
  {
    code: 'DIR-102', title: 'Membaca Laporan Keuangan Perusahaan', track: 'leadership', level: 'DIR', duration: 60,
    summary: 'Tiga laporan yang harus dibaca bersama: laba rugi, arus kas, dan neraca.',
    objectives: [
      'Menjelaskan hubungan laba rugi, arus kas, dan neraca dalam satu cerita.',
      'Menghitung modal kerja dan menilai kemampuan membayar kewajiban jangka pendek.',
      'Membedakan laba akuntansi dari kas yang benar-benar tersedia.',
    ],
    relevance: 'Perusahaan bisa untung di laporan tetapi kehabisan kas; keduanya harus dibaca bersama.',
    prerequisites: ['MGR-107'],
    materials: [
      { title: 'Tiga laporan satu cerita', media: 'Teks', body: 'Laba rugi menjelaskan kinerja satu periode. Arus kas menjelaskan dari mana uang datang dan pergi. Neraca menjelaskan posisi aset, kewajiban, dan ekuitas pada satu tanggal. Laba bersih menambah ekuitas, tetapi kas bisa berbeda karena piutang dan persediaan.' },
      { title: 'Modal kerja', media: 'Teks', body: 'Modal kerja = aset lancar dikurangi kewajiban jangka pendek. Piutang B2B dan persediaan menyerap kas. Rasio lancar di bawah 1,2 pada bisnis ritel dengan penjualan harian perlu perhatian.' },
      { title: 'Laba vs kas', media: 'Teks', body: 'Laba naik karena penjualan kredit belum tertagih bukan berarti kas bertambah. Periksa arus kas operasi: bila negatif sementara laba positif, ada yang salah pada penagihan atau persediaan.' },
    ],
    sop: { code: 'SOP-DIR-102', title: 'Tinjauan keuangan bulanan dewan', points: ['Baca laba rugi dan bandingkan dengan anggaran.', 'Periksa arus kas operasi.', 'Hitung modal kerja dan rasio lancar.', 'Tandai penyimpangan di atas 5 persen.', 'Tetapkan tindakan dan penanggung jawab.'] },
    quiz: [
      q('Perusahaan laba bersih positif tetapi kas menurun. Kemungkinan penyebab?', ['Piutang dan persediaan menyerap kas', 'Penjualan tunai meningkat', 'Hutang dilunasi dengan laba', 'Beban penyusutan naik'], 0, 'Kenaikan piutang dan persediaan adalah penyerap kas utama.'),
      q('Modal kerja dihitung sebagai...', ['Aset lancar dikurangi kewajiban jangka pendek', 'Total aset dikurangi total kewajiban', 'Laba bersih ditambah penyusutan', 'Omzet dikurangi HPP'], 0, 'Angka ini menunjukkan likuiditas jangka pendek.'),
      q('Arus kas operasi negatif sementara laba positif menandakan...', ['Ada masalah penagihan atau penumpukan persediaan', 'Perusahaan pasti bangkrut', 'Beban pajak terlalu kecil', 'Penjualan terlalu tinggi'], 0, 'Kas operasi adalah indikator kesehatan yang lebih jujur.'),
    ],
    rubric: [rb('Pemahaman keterkaitan tiga laporan', 40), rb('Analisis modal kerja', 30), rb('Keputusan berbasis kas', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Mempresentasikan tinjauan keuangan satu bulan kepada dewan.',
    owner: 'Direktur Keuangan',
  },
  {
    code: 'DIR-103', title: 'Balanced Scorecard, OKR & Tata Kelola Kinerja', track: 'leadership', level: 'DIR', duration: 60,
    summary: 'Menerjemahkan strategi menjadi ukuran yang saling terhubung dan ritme tinjauan yang disiplin.',
    objectives: [
      'Menyusun sasaran di empat perspektif BSC beserta ukuran utama dan pendukung.',
      'Membedakan peran OKR (ambisi) dan KPI (kesehatan operasional).',
      'Menjalankan ritme tinjauan: mingguan operasional, bulanan kinerja, kuartalan strategi.',
    ],
    relevance: 'Strategi tanpa ukuran berhenti sebagai presentasi; ukuran tanpa ritme berhenti sebagai laporan.',
    prerequisites: ['DIR-101'],
    materials: [
      { title: 'Empat perspektif', media: 'Teks', body: 'Keuangan (margin, pertumbuhan), pelanggan (kepuasan, retensi), proses internal (waktu tunggu, reject rate, on-time delivery), dan pembelajaran (kompetensi tersertifikasi, retensi karyawan). Perspektif bawah adalah pendorong perspektif atas.' },
      { title: 'OKR vs KPI', media: 'Teks', body: 'OKR menjawab perubahan besar yang ingin dicapai dalam satu kuartal dengan hasil kunci terukur. KPI menjaga kesehatan operasional harian. Jangan memakai KPI sebagai OKR, dan jangan menilai orang hanya dari OKR.' },
      { title: 'Ritme tinjauan', media: 'Teks', body: 'Mingguan: angka operasional dan hambatan, 30 menit. Bulanan: kinerja unit dan keuangan, 90 menit. Kuartalan: strategi dan OKR, setengah hari. Setiap forum punya keluaran berupa keputusan, bukan hanya informasi.' },
    ],
    sop: { code: 'SOP-DIR-103', title: 'Siklus kinerja kuartalan', points: ['Tetapkan maksimal tiga OKR per kuartal.', 'Hubungkan tiap OKR dengan KPI pendukung.', 'Tunjuk satu pemilik per hasil kunci.', 'Tinjau setiap bulan dengan data.', 'Tutup kuartal dengan pelajaran, bukan hanya skor.'] },
    quiz: [
      q('Perbedaan utama OKR dan KPI?', ['OKR untuk perubahan besar per kuartal, KPI untuk kesehatan operasional', 'OKR untuk harian, KPI untuk tahunan', 'Keduanya sama', 'KPI hanya untuk keuangan'], 0, 'Keduanya berbeda peran dan tidak saling menggantikan.'),
      q('Perspektif BSC yang menjadi pendorong jangka panjang adalah...', ['Pembelajaran dan pertumbuhan', 'Keuangan', 'Pelanggan', 'Proses internal'], 0, 'Kompetensi dan budaya adalah fondasi perspektif lain.'),
      q('Keluaran forum tinjauan kinerja seharusnya...', ['Keputusan dan penanggung jawab', 'Dokumen panjang', 'Daftar alasan', 'Jadwal rapat berikutnya'], 0, 'Tanpa keputusan, forum hanya menjadi laporan.'),
    ],
    rubric: [rb('Kualitas rancangan sasaran dan ukuran', 40), rb('Pemisahan OKR dan KPI', 25), rb('Disiplin ritme tinjauan', 35)],
    passTheory: 85, passPractical: 85,
    gate: 'Menyusun BSC dan OKR satu kuartal yang disetujui dewan.',
    owner: 'Direktur Utama',
  },
  {
    code: 'DIR-104', title: 'Ekspansi & Keputusan Investasi', track: 'leadership', level: 'DIR', duration: 60,
    summary: 'Membuka outlet atau lini baru dengan angka yang jujur, termasuk risiko kanibalisasi.',
    objectives: [
      'Menyusun studi kelayakan sederhana: investasi awal, titik impas, dan pengembalian.',
      'Menilai kanibalisasi penjualan outlet yang sudah ada.',
      'Menetapkan tahap investasi dan kriteria berhenti.',
    ],
    relevance: 'Outlet baru yang tampak ramai bisa menurunkan laba grup bila kanibalisasi dan biaya tetap tidak dihitung.',
    prerequisites: ['DIR-102'],
    materials: [
      { title: 'Studi kelayakan', media: 'Teks', body: 'Hitung investasi awal (renovasi, mesin, stok awal, jaminan sewa), biaya tetap bulanan, margin kontribusi per transaksi, dan jumlah transaksi minimum untuk titik impas. Sertakan skenario pesimis, bukan hanya realistis.' },
      { title: 'Kanibalisasi', media: 'Teks', body: 'Sebagian pelanggan outlet baru adalah pelanggan outlet lama. Kurangi perkiraan penjualan dengan proporsi itu, terutama bila jaraknya dekat. Keputusan harus dinilai pada tingkat grup, bukan per outlet.' },
      { title: 'Tahapan dan kriteria berhenti', media: 'Teks', body: 'Bagi investasi menjadi tahap: uji lokasi kecil, lalu bangun penuh. Tetapkan sebelumnya: bila titik impas tidak tercapai dalam enam bulan pada skenario pesimis, apa yang dihentikan atau diubah.' },
    ],
    sop: { code: 'SOP-DIR-104', title: 'Keputusan investasi', points: ['Susun tiga skenario keuangan.', 'Hitung titik impas dan pengembalian.', 'Nilai dampak ke outlet lain.', 'Tetapkan tahapan dan kriteria berhenti.', 'Catat keputusan beserta asumsinya.'] },
    quiz: [
      q('Kanibalisasi harus dihitung karena...', ['Sebagian penjualan outlet baru berasal dari outlet lama', 'Menambah biaya pajak', 'Mengurangi jumlah karyawan', 'Mempengaruhi kurs'], 0, 'Tanpa koreksi itu, laba grup akan dilebih-lebihkan.'),
      q('Titik impas adalah kondisi ketika...', ['Margin kontribusi menutup seluruh biaya tetap', 'Omzet pertama diterima', 'Investasi awal kembali', 'Karyawan selesai dilatih'], 0, 'Titik impas bicara tentang laba operasi, bukan pengembalian modal.'),
      q('Kriteria berhenti ditetapkan...', ['Sebelum investasi dimulai', 'Setelah enam bulan berjalan', 'Saat rugi pertama muncul', 'Saat dewan meminta'], 0, 'Kriteria yang ditetapkan lebih awal mencegah eskalasi komitmen.'),
    ],
    rubric: [rb('Kelengkapan studi kelayakan', 40), rb('Analisis kanibalisasi', 30), rb('Perancangan tahapan dan kriteria berhenti', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Mempresentasikan satu proposal ekspansi dengan skenario dan kriteria berhenti.',
    owner: 'Direktur Utama',
  },
  {
    code: 'DIR-105', title: 'Manajemen Risiko & Kepatuhan', track: 'leadership', level: 'DIR', duration: 55,
    summary: 'Mengenali risiko yang bisa menghentikan bisnis dan memastikan izin serta kepatuhan terjaga.',
    objectives: [
      'Menyusun risk register sederhana dengan dampak, kemungkinan, dan mitigasi.',
      'Mengidentifikasi kepatuhan wajib: izin usaha, sertifikasi halal, higiene, pajak, dan ketenagakerjaan.',
      'Memutuskan risiko mana yang dihindari, dikurangi, dialihkan, atau diterima.',
    ],
    relevance: 'Satu izin yang terlewat bisa menutup outlet lebih lama daripada perbaikan mesin paling mahal.',
    prerequisites: ['DIR-102'],
    materials: [
      { title: 'Risk register', media: 'Teks', body: 'Daftar risiko dengan empat kolom: dampak (1-5), kemungkinan (1-5), skor, dan mitigasi beserta pemilik. Tinjau setiap kuartal; risiko baru dari pemasok tunggal, ketergantungan satu outlet, dan konsentrasi pelanggan B2B sering terlewat.' },
      { title: 'Kepatuhan wajib', media: 'Teks', body: 'Izin usaha dan lokasi, sertifikasi halal untuk produk makanan/minuman, higiene dan keamanan pangan, kewajiban pajak (termasuk PPh final UMKM bila berlaku), BPJS, dan perjanjian kerja. Simpan tanggal kedaluwarsa pada kalender perusahaan.' },
      { title: 'Pilihan penanganan', media: 'Teks', body: 'Hindari (hentikan aktivitas berisiko tinggi), kurangi (prosedur dan pelatihan), alihkan (asuransi, kontrak), atau terima (risiko kecil dengan pemantauan). Keputusan harus tertulis agar tidak bergantung pada ingatan.' },
    ],
    sop: { code: 'SOP-DIR-105', title: 'Tinjauan risiko kuartalan', points: ['Perbarui daftar risiko dan skornya.', 'Periksa tanggal kedaluwarsa izin dan sertifikat.', 'Tetapkan mitigasi dan pemiliknya.', 'Tinjau kejadian nyata kuartal lalu.', 'Laporkan risiko utama ke dewan.'] },
    quiz: [
      q('Skor risiko dihitung dari...', ['Dampak dikali kemungkinan', 'Jumlah karyawan terdampak', 'Biaya mitigasi', 'Lama kejadian'], 0, 'Perkalian itu membantu memprioritaskan.'),
      q('Sertifikasi yang wajib untuk produk makanan dan minuman yang dijual luas adalah...', ['Halal dan higiene keamanan pangan', 'Sertifikat merek saja', 'ISO 9001', 'Sertifikat ekspor'], 0, 'Keduanya menyangkut izin edar dan kepercayaan pasar.'),
      q('Risiko dengan dampak tinggi dan kemungkinan rendah sebaiknya...', ['Dialihkan atau disiapkan rencana kontinjensi', 'Diabaikan', 'Ditanggung sendiri tanpa rencana', 'Ditunda setahun'], 0, 'Risiko besar jarang tetap butuh kesiapan.'),
    ],
    rubric: [rb('Kelengkapan risk register', 35), rb('Pemetaan kepatuhan', 35), rb('Ketepatan pilihan penanganan', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Menyerahkan risk register perusahaan yang ditinjau dewan.',
    owner: 'Direktur Utama',
  },
  {
    code: 'DIR-106', title: 'Kepemimpinan Lintas Unit & RACI', track: 'leadership', level: 'DIR', duration: 50,
    summary: 'Satu perusahaan, banyak unit: siapa memutuskan apa, dan bagaimana konflik diselesaikan.',
    objectives: [
      'Menyusun RACI untuk proses lintas unit yang paling sering macet.',
      'Membedakan wewenang keputusan pusat dan unit.',
      'Memimpin rapat lintas unit yang menghasilkan keputusan, bukan perdebatan.',
    ],
    relevance: 'Kebanyakan keterlambatan lintas unit bukan karena orang malas, tetapi karena tidak jelas siapa memutuskan.',
    prerequisites: ['DIR-103'],
    materials: [
      { title: 'RACI yang bekerja', media: 'Teks', body: 'Satu aktivitas punya satu accountable (yang menanggung hasil), beberapa responsible (yang mengerjakan), consulted (dimintai pendapat), dan informed (diberi tahu). Bila ada dua accountable, keputusan akan berhenti.' },
      { title: 'Pusat vs unit', media: 'Teks', body: 'Pusat menetapkan standar mutu, harga, merek, dan pelaporan. Unit mengatur operasional harian, jadwal, dan tindakan perbaikan lokal. Ketidakjelasan batas ini adalah sumber gesekan berulang.' },
      { title: 'Rapat yang memutuskan', media: 'Teks', body: 'Agenda dengan satu keputusan per item, data disiapkan sebelum rapat, dan setiap keputusan dicatat dengan pemilik dan tenggat. Bila data tidak siap, item ditunda, bukan dibahas dengan dugaan.' },
    ],
    sop: { code: 'SOP-DIR-106', title: 'Rapat lintas unit', points: ['Bagikan data dua hari sebelum rapat.', 'Satu item satu keputusan.', 'Tandai accountable tiap keputusan.', 'Catat tenggat di tempat.', 'Tinjau keputusan tertunda di awal rapat berikutnya.'] },
    quiz: [
      q('Dalam RACI, jumlah accountable untuk satu aktivitas sebaiknya...', ['Satu', 'Dua agar seimbang', 'Sebanyak unit terlibat', 'Tidak perlu'], 0, 'Dua accountable membuat keputusan menggantung.'),
      q('Yang sebaiknya ditetapkan pusat, bukan unit?', ['Standar mutu, harga, dan merek', 'Jadwal shift harian', 'Penataan station bar', 'Tindakan perbaikan lokal'], 0, 'Konsistensi merek dan harga butuh keputusan pusat.'),
      q('Bila data untuk satu item rapat belum siap, sebaiknya...', ['Item ditunda, bukan diputuskan dengan dugaan', 'Diputuskan cepat', 'Dibahas tanpa angka', 'Dihapus dari agenda permanen'], 0, 'Keputusan tanpa data cenderung diulang dan merugikan.'),
    ],
    rubric: [rb('Kualitas RACI lintas unit', 40), rb('Kejelasan batas wewenang', 30), rb('Efektivitas rapat keputusan', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Menyusun RACI satu proses lintas unit dan memimpin satu rapat keputusan.',
    owner: 'Direktur Operasional',
  },
  {
    code: 'DIR-107', title: 'Talent, Suksesi & Budaya', track: 'leadership', level: 'DIR', duration: 55,
    summary: 'Memastikan perusahaan tidak bergantung pada satu orang, termasuk Anda.',
    objectives: [
      'Menilai talenta dengan dua dimensi: kinerja dan potensi.',
      'Menetapkan rencana suksesi untuk posisi kritis.',
      'Menjelaskan cara membangun budaya standar melalui perilaku pemimpin.',
    ],
    relevance: 'Posisi kunci tanpa calon pengganti adalah risiko bisnis, bukan hanya risiko HR.',
    prerequisites: ['DIR-103'],
    materials: [
      { title: 'Kinerja dan potensi', media: 'Teks', body: 'Petakan orang pada dua sumbu: hasil saat ini dan kemampuan tumbuh. Bintang (tinggi-tinggi) butuh tantangan, bukan promosi cepat tanpa kesiapan. Kinerja rendah dengan potensi tinggi butuh coaching, bukan langsung sanksi.' },
      { title: 'Suksesi posisi kritis', media: 'Teks', body: 'Tandai posisi yang bila kosong akan menghentikan operasi: kepala produksi, head barista, finance. Untuk tiap posisi, siapkan dua calon dengan rencana pengembangan 6-12 bulan dan penugasan nyata.' },
      { title: 'Budaya lewat perilaku', media: 'Teks', body: 'Budaya terbentuk dari apa yang ditoleransi dan apa yang diberi penghargaan. Bila pemimpin melewati standar higiene saat sibuk, seluruh tim akan melakukannya juga. Tinjau perilaku pemimpin sendiri setiap kuartal.' },
    ],
    sop: { code: 'SOP-DIR-107', title: 'Tinjauan talenta tahunan', points: ['Petakan kinerja dan potensi seluruh karyawan kunci.', 'Tandai posisi kritis tanpa calon pengganti.', 'Sepakati rencana pengembangan tiap calon.', 'Beri penugasan nyata, bukan hanya pelatihan.', 'Tinjau ulang setiap enam bulan.'] },
    quiz: [
      q('Karyawan dengan kinerja rendah tetapi potensi tinggi sebaiknya...', ['Diberi coaching dan penugasan yang jelas', 'Langsung dikeluarkan', 'Dipromosikan agar termotivasi', 'Dibiarkan tanpa intervensi'], 0, 'Potensi butuh arahan, bukan sanksi langsung.'),
      q('Posisi kritis adalah posisi yang...', ['Bila kosong menghentikan operasi', 'Paling tinggi gajinya', 'Paling lama masa kerjanya', 'Paling dekat dengan pemilik'], 0, 'Kekosongannya berdampak langsung ke operasi.'),
      q('Budaya standar paling kuat dibentuk oleh...', ['Perilaku pemimpin yang konsisten menegakkan standar', 'Poster di dinding', 'Sanksi berat', 'Rapat bulanan'], 0, 'Apa yang ditoleransi pemimpin menjadi standar nyata.'),
    ],
    rubric: [rb('Kualitas pemetaan talenta', 35), rb('Rencana suksesi', 35), rb('Konsistensi perilaku budaya', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Menyerahkan peta talenta dan rencana suksesi posisi kritis.',
    owner: 'Direktur Utama',
  },
  {
    code: 'DIR-108', title: 'Pelaporan Dewan & Pemegang Saham', track: 'leadership', level: 'DIR', duration: 50,
    summary: 'Menyampaikan kondisi perusahaan dengan jujur, ringkas, dan bisa diambil keputusannya.',
    objectives: [
      'Menyusun paket laporan dewan satu halaman plus lampiran.',
      'Menyampaikan kinerja buruk dengan analisis dan rencana, bukan pembelaan.',
      'Menyiapkan proyeksi skenario dan permintaan keputusan yang jelas.',
    ],
    relevance: 'Dewan yang menerima laporan tanpa angka jujur akan mengambil keputusan berdasarkan asumsi yang salah.',
    prerequisites: ['DIR-102'],
    materials: [
      { title: 'Paket laporan dewan', media: 'Teks', body: 'Halaman satu berisi: ringkasan kinerja terhadap rencana, tiga angka kunci, tiga risiko, dan keputusan yang diminta. Lampiran memuat detail keuangan, operasional, dan SDM. Konsisten formatnya setiap bulan agar mudah dibandingkan.' },
      { title: 'Menyampaikan kinerja buruk', media: 'Teks', body: 'Sebutkan angkanya, penyebab yang terverifikasi, dan tindakan yang sudah dimulai beserta tenggatnya. Hindari menyalahkan pasar sebelum memeriksa eksekusi internal.' },
      { title: 'Permintaan keputusan', media: 'Teks', body: 'Setiap laporan sebaiknya diakhiri dengan keputusan yang diminta: menyetujui belanja, mengubah target, atau menerima risiko. Tanpa itu, rapat berakhir tanpa arah.' },
    ],
    sop: { code: 'SOP-DIR-108', title: 'Rapat dewan bulanan', points: ['Kirim paket laporan tiga hari sebelumnya.', 'Sajikan kinerja terhadap rencana.', 'Jelaskan penyimpangan dan tindakannya.', 'Ajukan keputusan yang diminta.', 'Catat keputusan dan tindak lanjutnya.'] },
    quiz: [
      q('Halaman pertama paket laporan dewan sebaiknya memuat...', ['Kinerja terhadap rencana, risiko, dan keputusan yang diminta', 'Seluruh jurnal transaksi', 'Daftar menu baru', 'Profil karyawan'], 0, 'Dewan butuh ringkasan untuk memutuskan.'),
      q('Kinerja buruk disampaikan dengan...', ['Angka, penyebab terverifikasi, dan tindakan bertenggat', 'Penjelasan umum tentang pasar', 'Menyalahkan tim', 'Menunda sampai kuartal berikutnya'], 0, 'Kejujuran berbasis data menjaga kepercayaan dewan.'),
      q('Laporan tanpa permintaan keputusan berisiko...', ['Rapat berakhir tanpa arah tindak lanjut', 'Terlalu panjang', 'Salah hitung', 'Tidak dibaca'], 0, 'Keputusan yang diminta membuat rapat produktif.'),
    ],
    rubric: [rb('Struktur paket laporan', 35), rb('Kejujuran dan ketepatan analisis', 35), rb('Kejelasan permintaan keputusan', 30)],
    passTheory: 85, passPractical: 85,
    gate: 'Mempresentasikan laporan dewan satu bulan dan memperoleh keputusan.',
    owner: 'Direktur Utama',
  },
];

// ---------------------------------------------------------------- badge & learning path

const LEADERSHIP_BADGES = [
  { code: 'floor_leader', name: 'Floor Leader', track: 'leadership', level: 'SUP', requirement: 'Semua modul Supervisor (S1) lulus', icon: 'users' },
  { code: 'people_developer', name: 'People Developer', track: 'leadership', level: 'SUP', requirement: 'Lulus SUP-104 Coaching & Umpan Balik beserta praktiknya', icon: 'target' },
  { code: 'unit_manager', name: 'Unit Manager', track: 'leadership', level: 'MGR', requirement: 'Semua modul Manajer (M2) lulus', icon: 'building' },
  { code: 'cost_controller', name: 'Cost Controller', track: 'leadership', level: 'MGR', requirement: 'Lulus MGR-103 dan MGR-107 dengan praktik minimal 85', icon: 'wallet' },
  { code: 'strategy_executive', name: 'Strategy Executive', track: 'leadership', level: 'DIR', requirement: 'Semua modul Direktur & Chief (E3) lulus', icon: 'flag' },
  { code: 'board_ready', name: 'Board Ready', track: 'leadership', level: 'DIR', requirement: 'Lulus DIR-108 dan satu presentasi laporan dewan', icon: 'trophy' },
];

const LEADERSHIP_PATHS = [
  {
    code: 'PATH-SUP', name: 'Leadership — Supervisor (S1)', role_target: 'Supervisor lini, Head Barista, Supervisor Produksi', track: 'leadership',
    description: 'Bekal memimpin shift: peran supervisor, briefing, alur antrean, coaching, keluhan, kualitas, kas, dan keselamatan lantai.',
    courses: ['SUP-101', 'SUP-102', 'SUP-103', 'SUP-104', 'SUP-105', 'SUP-106', 'SUP-107', 'SUP-108'],
  },
  {
    code: 'PATH-MGR', name: 'Leadership — Manajer (M2)', role_target: 'Manajer Outlet, Kepala Unit, Finance & Accounting', track: 'leadership',
    description: 'Mengelola unit sebagai bisnis: angka outlet, tenaga kerja, HPP dan susut, stok, pemasaran lokal, kinerja tim, anggaran, dan perbaikan berkelanjutan.',
    courses: ['MGR-101', 'MGR-102', 'MGR-103', 'MGR-104', 'MGR-105', 'MGR-106', 'MGR-107', 'MGR-108'],
  },
  {
    code: 'PATH-DIR', name: 'Leadership — Direktur & Chief (E3)', role_target: 'Direktur, Chief, dan Owner', track: 'leadership',
    description: 'Menentukan arah perusahaan: strategi farm-to-cup, laporan keuangan, BSC/OKR, investasi dan ekspansi, risiko dan kepatuhan, kepemimpinan lintas unit, talenta, serta pelaporan dewan.',
    courses: ['DIR-101', 'DIR-102', 'DIR-103', 'DIR-104', 'DIR-105', 'DIR-106', 'DIR-107', 'DIR-108'],
  },
];

module.exports = { SUP, MGR, DIR, LEADERSHIP_BADGES, LEADERSHIP_PATHS };
