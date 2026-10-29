'use strict';

/**
 * Kurikulum Ondeway Coffee Academy.
 *
 * Disusun mengikuti framework "LMS Internal Training — Barista & Kitchen Academy":
 *  - 4 learning path (Foundation, Barista, Hospitality, Leadership)
 *  - Level B0–B3 untuk barista, FND untuk foundation, HOS untuk hospitality
 *  - Setiap modul memuat 12 komponen: ID, judul, objective, business relevance,
 *    prerequisite, learning material, SOP/job aid, knowledge check, practical
 *    assignment, rubric, certification gate, versi & review date.
 *
 * Angka parameter seduh/resep di sini adalah standar internal yang bisa diubah
 * trainer di halaman /academy/manage — jangan menambal dengan angka generik.
 */

const q = (question, options, answer, why) => ({ question, options, answer, why });
const rb = (aspect, weight, critical = false) => ({ aspect, weight, critical });

const FOUNDATION = [
  {
    code: 'FND-01', title: 'Sejarah, Visi, Misi & Nilai Ondeway', track: 'foundation', level: 'FND', duration: 30,
    summary: 'Mengapa Ondeway ada, bagaimana rantai nilai farm-to-cup bekerja, dan nilai yang wajib dibawa setiap orang.',
    objectives: [
      'Menjelaskan sejarah singkat dan model bisnis farm-to-cup Ondeway.',
      'Menyebutkan visi, misi, dan lima nilai perusahaan beserta contoh perilakunya.',
      'Mengaitkan perannya di outlet dengan rantai nilai dari kebun sampai cangkir.',
    ],
    relevance: 'Karyawan yang memahami arah perusahaan mengambil keputusan harian lebih tepat dan lebih bangga pada produk yang disajikan.',
    prerequisites: [],
    materials: [
      { title: 'Perjalanan Ondeway', media: 'Teks', body: 'Ondeway mengelola rantai kopi sendiri: kebun dan proses pascapanen, roastery, lalu coffeeshop, coffee station, coffee bike, dan coffee truck. Setiap tahap menentukan rasa akhir di cangkir pelanggan. Karena itu barista bukan hanya penyaji terakhir, tetapi penjaga kualitas seluruh rantai.' },
      { title: 'Visi, misi, nilai', media: 'Teks', body: 'Visi: menghadirkan kopi lokal berkualitas dengan pengalaman minum yang konsisten dan hangat. Misi: mengelola rantai farm-to-cup secara profesional, memberdayakan petani dan tim, serta memberi layanan yang ramah dan cepat. Nilai: (1) Jujur pada kualitas, (2) Cepat dan tepat, (3) Ramah dan peduli, (4) Bersih dan aman, (5) Terus belajar.' },
      { title: 'Perilaku yang dinilai', media: 'Contoh', body: 'Jujur pada kualitas berarti tidak menyajikan produk yang tidak sesuai standar. Cepat dan tepat berarti antrean dikelola tanpa menurunkan mutu. Ramah dan peduli berarti menyapa dan mengingat pelanggan. Bersih dan aman berarti workstation rapi dan alat steril. Terus belajar berarti menyelesaikan modul dan menerima coaching.' },
    ],
    sop: { code: 'SOP-FND-01', title: 'Induksi budaya kerja', points: ['Ikuti sesi induksi bersama trainer pada hari pertama.', 'Baca dan tandatangani lembar pemahaman nilai perusahaan.', 'Tanyakan hal yang belum jelas kepada shift leader, jangan menebak.'] },
    quiz: [
      q('Apa arti farm-to-cup pada model bisnis Ondeway?', ['Hanya menjual biji kopi', 'Mengelola rantai dari kebun, roasting, sampai penyajian di cangkir', 'Membeli kopi jadi dari supplier', 'Menjual kopi hanya lewat online'], 1, 'Ondeway mengelola kebun, roastery, dan outlet sekaligus.'),
      q('Salah satu nilai Ondeway adalah jujur pada kualitas. Contoh perilakunya?', ['Menyajikan produk apa adanya walau tidak sesuai standar', 'Tidak menyajikan produk yang tidak memenuhi standar dan membuat ulang', 'Menyembunyikan kesalahan dari shift leader', 'Menambah air agar porsi terlihat penuh'], 1, 'Kualitas yang tidak sesuai standar tidak boleh disajikan.'),
      q('Siapa yang paling tepat ditanyai saat prosedur kerja belum dipahami?', ['Pelanggan', 'Teman sebaya yang juga baru', 'Shift leader atau trainer', 'Media sosial'], 2, 'Shift leader dan trainer adalah rujukan standar operasional.'),
    ],
    rubric: [rb('Pemahaman nilai perusahaan', 40), rb('Kemampuan menjelaskan rantai farm-to-cup', 40), rb('Sikap dan keterlibatan sesi induksi', 20)],
    passTheory: 80, passPractical: 80,
    gate: 'Wajib lulus sebelum mengikuti modul Foundation lainnya.',
  },
  {
    code: 'FND-02', title: 'Brand Identity & Pengalaman Pelanggan', track: 'foundation', level: 'FND', duration: 30,
    summary: 'Identitas visual dan verbal Ondeway serta standar pengalaman pelanggan di setiap titik sentuh.',
    objectives: [
      'Mengenali elemen identitas brand dan aturan penggunaannya.',
      'Menjelaskan standar pengalaman pelanggan dari datang sampai pulang.',
      'Menunjukkan cara menjaga konsistensi brand di outlet.',
    ],
    relevance: 'Brand yang konsisten membuat pelanggan mengenali Ondeway dan bersedia kembali.',
    prerequisites: ['FND-01'],
    materials: [
      { title: 'Elemen brand', media: 'Teks', body: 'Warna brand merah bata dengan latar krem hangat, logo roda gigi dan biji kopi, serta tipografi tegas. Logo tidak boleh diubah warna, dipotong, atau diletakkan pada latar yang membuatnya tidak terbaca.' },
      { title: 'Bahasa dan nada komunikasi', media: 'Teks', body: 'Sapa pelanggan dengan bahasa Indonesia yang hangat dan tidak berlebihan. Sebut nama produk dengan benar. Hindari istilah teknis yang membingungkan, ganti dengan penjelasan singkat.' },
      { title: 'Titik sentuh pengalaman', media: 'Teks', body: 'Enam titik sentuh yang dinilai: tampak depan outlet, sapaan saat masuk, proses pemesanan, penyajian produk, penyerahan pesanan, dan perpisahan. Setiap titik punya standar minimal yang wajib dijalankan.' },
    ],
    sop: { code: 'SOP-FND-02', title: 'Standar titik sentuh pelanggan', points: ['Pastikan area masuk bersih dan papan menu terbaca.', 'Sapa dalam 5 detik sejak pelanggan mendekat.', 'Ulangi pesanan sebelum diproses.', 'Serahkan produk dengan menyebut nama pesanan.'] },
    quiz: [
      q('Apa yang tidak boleh dilakukan pada logo Ondeway?', ['Menempatkan pada latar terang', 'Mengubah warna dan memotong bentuk', 'Mencetak pada kemasan', 'Memasang di dinding outlet'], 1, 'Logo tidak boleh diubah warna maupun dipotong.'),
      q('Berapa lama target maksimal menyapa pelanggan yang mendekat?', ['5 detik', '30 detik', '1 menit', 'Sampai pelanggan memanggil'], 0, 'Sapaan cepat adalah standar pengalaman pertama.'),
      q('Mengapa pesanan perlu diulang sebelum diproses?', ['Agar terdengar ramah saja', 'Mencegah kesalahan pesanan dan remake', 'Menambah waktu tunggu', 'Agar pelanggan membatalkan'], 1, 'Konfirmasi pesanan menekan risiko salah produksi.'),
    ],
    rubric: [rb('Penerapan elemen brand', 30), rb('Penerapan nada komunikasi', 30), rb('Konsistensi titik sentuh pelanggan', 40)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus teori minimal 80 dan dinilai trainer pada simulasi pelayanan.',
  },
  {
    code: 'FND-03', title: 'Product Knowledge & Pengenalan Menu', track: 'foundation', level: 'FND', duration: 60,
    summary: 'Seluruh kategori menu Ondeway, bahan utama, karakter rasa, dan cara menjelaskannya kepada pelanggan.',
    objectives: [
      'Mengelompokkan menu menjadi espresso based, manual brew, non-coffee, dan makanan.',
      'Menjelaskan karakter rasa tiap kategori dan bahan utamanya.',
      'Merekomendasikan menu sesuai preferensi pelanggan.',
    ],
    relevance: 'Rekomendasi yang tepat meningkatkan nilai transaksi dan kepuasan pelanggan.',
    prerequisites: ['FND-02'],
    materials: [
      { title: 'Kategori menu', media: 'Teks', body: 'Espresso based: espresso, americano, latte, cappuccino, serta signature seperti Dirty Latte, Mont Blanc, dan Lions Tamer. Manual brew: V60 dan tubruk. Non-coffee: matcha, chocolate, teh. Makanan: menu kitchen seperti bakmi ayam jamur dan pastry.' },
      { title: 'Karakter rasa', media: 'Teks', body: 'Biji kopi Ondeway dominan cokelat, karamel, dan buah kering dengan keasaman sedang. Susu membuat tekstur lebih lembut dan manis alami. Signature drink menambahkan lapisan rasa untuk pelanggan yang ingin pengalaman berbeda.' },
      { title: 'Cara merekomendasikan', media: 'Contoh', body: 'Tanyakan preferensi: kuat atau lembut, panas atau dingin, dengan atau tanpa susu. Contoh: pelanggan yang ingin rasa kuat diarahkan ke americano atau long black; yang ingin lembut diarahkan ke latte atau Mont Blanc.' },
    ],
    sop: { code: 'SOP-FND-03', title: 'Menjelaskan menu', points: ['Gunakan nama menu resmi tanpa singkatan yang membingungkan.', 'Sebutkan 2 bahan utama dan karakter rasanya.', 'Tawarkan satu alternatif bila menu habis.'] },
    quiz: [
      q('Menu berikut yang termasuk manual brew adalah?', ['Cappuccino', 'V60', 'Dirty Latte', 'Mont Blanc'], 1, 'V60 diseduh manual, bukan mesin espresso.'),
      q('Pelanggan meminta rasa kuat tanpa susu. Rekomendasi paling tepat?', ['Mont Blanc', 'Latte', 'Americano', 'Matcha latte'], 2, 'Americano adalah espresso dengan air, tanpa susu.'),
      q('Cara terbaik merekomendasikan menu adalah?', ['Menawarkan menu termahal', 'Menanyakan preferensi lalu menyesuaikan', 'Menawarkan semua menu sekaligus', 'Membiarkan pelanggan memilih sendiri'], 1, 'Rekomendasi harus berbasis preferensi pelanggan.'),
    ],
    rubric: [rb('Ketepatan menjelaskan kategori & bahan', 40), rb('Ketepatan rekomendasi', 30), rb('Kelengkapan informasi produk', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus kuis produk minimal 80.',
  },
  {
    code: 'FND-04', title: 'Customer Service Excellence', track: 'foundation', level: 'FND', duration: 60,
    summary: 'Sikap, kalimat, dan alur pelayanan yang membuat pelanggan merasa dihargai tanpa memperlambat antrean.',
    objectives: [
      'Menerapkan lima langkah pelayanan dasar Ondeway.',
      'Menggunakan kalimat positif dan menghindari kalimat yang memicu konflik.',
      'Menangani situasi antrean panjang dengan tenang.',
    ],
    relevance: 'Pelayanan yang konsisten adalah pembeda utama kedai kopi lokal.',
    prerequisites: ['FND-02'],
    materials: [
      { title: 'Lima langkah pelayanan', media: 'Teks', body: 'Sapa, tanyakan kebutuhan, konfirmasi pesanan, informasikan waktu tunggu, serahkan dengan ucapan terima kasih. Setiap langkah dilakukan dengan kontak mata dan senyum yang wajar.' },
      { title: 'Kalimat yang dipakai dan dihindari', media: 'Contoh', body: 'Pakai: "Baik, saya siapkan ya", "Mohon tunggu sekitar 4 menit", "Terima kasih sudah menunggu". Hindari: "Bukan saya yang buat", "Terserah", "Sudah dari tadi saya bilang".' },
      { title: 'Mengelola antrean', media: 'Teks', body: 'Saat antrean panjang: beri tahu estimasi waktu, prioritaskan pesanan yang sudah dibayar sesuai urutan, dan minta bantuan rekan bila antrean melebihi lima orang.' },
    ],
    sop: { code: 'SOP-FND-04', title: 'Pelayanan dasar', points: ['Lakukan kontak mata dan sapaan saat pelanggan datang.', 'Konfirmasi pesanan dan estimasi waktu.', 'Catat permintaan khusus, jangan mengandalkan ingatan.', 'Ucapkan terima kasih saat menyerahkan produk.'] },
    quiz: [
      q('Urutan pelayanan dasar yang benar adalah?', ['Sapa, konfirmasi, informasikan waktu, serahkan', 'Konfirmasi, sapa, serahkan', 'Sapa, serahkan, konfirmasi', 'Informasikan waktu, sapa, serahkan'], 0, 'Sapaan selalu lebih dulu, penyerahan diakhiri ucapan terima kasih.'),
      q('Kalimat mana yang harus dihindari?', ['Mohon tunggu sekitar 4 menit', 'Baik, saya siapkan ya', 'Itu bukan tugas saya', 'Terima kasih sudah menunggu'], 2, 'Kalimat yang melempar tanggung jawab merusak pengalaman.'),
      q('Bila antrean lebih dari lima orang, tindakan yang tepat?', ['Mempercepat dengan melewati standar resep', 'Memberi estimasi waktu dan meminta bantuan rekan', 'Menutup kasir', 'Membiarkan antrean tanpa informasi'], 1, 'Komunikasi waktu tunggu dan bantuan rekan adalah standar.'),
    ],
    rubric: [rb('Penerapan lima langkah pelayanan', 40), rb('Penggunaan kalimat positif', 30), rb('Pengelolaan antrean dan tekanan', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus simulasi pelayanan dengan nilai minimal 80.',
  },
  {
    code: 'FND-05', title: 'Hygiene, Sanitasi & Keselamatan Kerja', track: 'foundation', level: 'FND', duration: 60,
    summary: 'Standar kebersihan pribadi, sanitasi peralatan, penanganan bahan, dan keselamatan listrik serta panas.',
    objectives: [
      'Menjelaskan standar higiene pribadi sebelum bekerja.',
      'Melakukan sanitasi alat dan area kerja sesuai urutan.',
      'Mengenali bahaya listrik, air panas, dan bahan kimia pembersih.',
    ],
    relevance: 'Keamanan pangan dan keselamatan kerja adalah syarat mutlak, bukan pilihan.',
    prerequisites: [],
    materials: [
      { title: 'Higiene pribadi', media: 'Teks', body: 'Cuci tangan sebelum dan sesudah menangani bahan, setelah dari toilet, setelah memegang uang. Kuku pendek dan bersih, rambut tertutup atau terikat, tidak bekerja saat sakit menular.' },
      { title: 'Sanitasi alat dan area', media: 'Teks', body: 'Bilas, sabun, bilas, lalu sanitasi. Lap bersih dipisah per fungsi: bar, kitchen, dan lantai. Portafilter dibersihkan setiap akhir shift dan mesin di-backflush sesuai jadwal.' },
      { title: 'Keselamatan kerja', media: 'Teks', body: 'Jangan menyentuh area mesin yang panas tanpa pelindung. Jangan menumpahkan air ke area listrik. Bahan kimia pembersih disimpan dalam wadah berlabel, jauh dari bahan pangan, dan tidak boleh dipindah ke botol minuman.' },
    ],
    sop: { code: 'SOP-FND-05', title: 'Sanitasi dan keselamatan', points: ['Cuci tangan 20 detik sebelum bekerja.', 'Gunakan sarung tangan saat menangani makanan siap saji.', 'Beri label semua wadah bahan kimia.', 'Laporkan segera luka bakar, sengatan listrik, atau tumpahan bahan kimia.'] },
    quiz: [
      q('Urutan sanitasi peralatan yang benar?', ['Sanitasi, sabun, bilas', 'Bilas, sabun, bilas, sanitasi', 'Sabun, sanitasi, bilas', 'Bilas lalu langsung pakai'], 1, 'Kotoran dibilas dulu, baru disabun, dibilas, dan disanitasi.'),
      q('Bahan kimia pembersih sebaiknya disimpan di?', ['Botol minuman bekas', 'Wadah berlabel jauh dari bahan pangan', 'Dekat kompor', 'Dalam lemari es'], 1, 'Wadah berlabel dan terpisah dari pangan mencegah kontaminasi.'),
      q('Tindakan benar saat air panas tumpah mengenai tangan?', ['Diberi pasta gigi', 'Didinginkan air mengalir lalu lapor shift leader', 'Dibiarkan saja', 'Diberi minyak'], 1, 'Pendinginan dengan air mengalir adalah pertolongan pertama yang benar.'),
    ],
    rubric: [rb('Penerapan higiene pribadi', 30), rb('Prosedur sanitasi alat', 30, true), rb('Kepatuhan keselamatan kerja', 40, true)],
    passTheory: 80, passPractical: 80,
    gate: 'Kesalahan kritis pada keselamatan berarti tidak lulus, berapa pun nilai teorinya.',
  },
  {
    code: 'FND-06', title: 'SOP Opening, Closing & Pergantian Shift', track: 'foundation', level: 'FND', duration: 60,
    summary: 'Checklist persiapan buka, penutupan, dan serah terima shift agar operasional tidak bergantung pada ingatan.',
    objectives: [
      'Menjalankan checklist opening dan closing secara berurutan.',
      'Melakukan serah terima shift dengan catatan yang jelas.',
      'Mengenali kondisi yang harus dilaporkan ke shift leader.',
    ],
    relevance: 'Checklist yang konsisten mencegah kehilangan stok, alat rusak, dan keluhan pagi hari.',
    prerequisites: ['FND-05'],
    materials: [
      { title: 'Opening', media: 'Teks', body: 'Buka area, nyalakan lampu dan peralatan sesuai urutan, cek kebersihan, cek stok kritis, panaskan mesin espresso 20 menit, kalibrasi grinder, siapkan bahan display, cek kas awal.' },
      { title: 'Closing', media: 'Teks', body: 'Hentikan penjualan sesuai jam, bersihkan seluruh area, backflush mesin, kosongkan dan bersihkan display, catat waste, hitung kas, kunci penyimpanan, matikan peralatan sesuai prosedur.' },
      { title: 'Serah terima shift', media: 'Teks', body: 'Catat stok kritis, alat bermasalah, promo aktif, pesanan tertunda, dan kejadian penting. Serahkan lisan dan tertulis kepada shift berikutnya.' },
    ],
    sop: { code: 'SOP-FND-06', title: 'Opening & closing', points: ['Gunakan checklist dan centang setiap butir.', 'Laporkan alat yang tidak berfungsi normal.', 'Catat waste harian sebelum menutup.', 'Serah terima shift wajib berisi kondisi stok dan alat.'] },
    quiz: [
      q('Berapa lama mesin espresso sebaiknya dipanaskan sebelum dipakai?', ['2 menit', '20 menit', '60 menit', 'Tidak perlu'], 1, 'Pemanasan 20 menit membuat suhu grup stabil.'),
      q('Apa yang wajib ada dalam serah terima shift?', ['Kabar pribadi', 'Stok kritis, alat bermasalah, promo aktif, dan kejadian penting', 'Daftar menu baru', 'Jadwal libur karyawan'], 1, 'Serah terima fokus pada kondisi operasional.'),
      q('Waste sebaiknya dicatat kapan?', ['Setiap akhir shift sebelum menutup', 'Setiap akhir bulan', 'Hanya saat ada audit', 'Tidak perlu dicatat'], 0, 'Pencatatan waste harian membuat biaya terkendali.'),
    ],
    rubric: [rb('Kelengkapan checklist opening', 30), rb('Kelengkapan checklist closing', 30), rb('Kualitas serah terima shift', 40)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus checklist observasi minimal 80 tanpa butir kritis terlewat.',
  },
  {
    code: 'FND-07', title: 'POS, Pencatatan Transaksi & Komunikasi Pesanan', track: 'foundation', level: 'FND', duration: 60,
    summary: 'Menggunakan POS Ondeway dengan benar: pilih pelanggan, tambah item, promo, pembayaran, dan komunikasi ke bar.',
    objectives: [
      'Membuat transaksi baru dengan benar termasuk pelanggan dan promo.',
      'Menjelaskan metode pembayaran yang tersedia dan alur QRIS.',
      'Mengomunikasikan pesanan ke bar dan kitchen tanpa kesalahan.',
    ],
    relevance: 'Kesalahan input berdampak langsung pada stok, omzet, dan pengalaman pelanggan.',
    prerequisites: ['FND-03'],
    materials: [
      { title: 'Alur transaksi', media: 'Teks', body: 'Pilih pelanggan (walk-in atau member), tambahkan produk, masukkan kode promo bila ada, tentukan poin, pilih metode bayar, lalu simpan. Struk dapat dicetak ke printer thermal atau dikirim via WhatsApp.' },
      { title: 'Metode pembayaran', media: 'Teks', body: 'Tunai, kartu debit/kredit, transfer, dan QRIS. Untuk QRIS, nominal diisi otomatis oleh sistem; transaksi tidak boleh disimpan sebelum pembayaran terverifikasi.' },
      { title: 'Komunikasi pesanan', media: 'Teks', body: 'Gunakan format: jumlah, nama produk, ukuran, suhu, permintaan khusus. Contoh: "Dua latte panas, satu less sugar". Ulangi kembali ke bar jika pesanan lebih dari tiga item.' },
    ],
    sop: { code: 'SOP-FND-07', title: 'Transaksi POS', points: ['Konfirmasi pelanggan sebelum menambah item.', 'Periksa kembali keranjang sebelum bayar.', 'Jangan menyimpan transaksi QRIS yang belum lunas.', 'Sebutkan total dan metode bayar kepada pelanggan.'] },
    quiz: [
      q('Transaksi QRIS boleh disimpan saat status pembayaran?', ['Belum lunas', 'Sudah terverifikasi lunas', 'Kapan saja', 'Setelah pelanggan pergi'], 1, 'Sistem menolak QRIS yang belum lunas.'),
      q('Format komunikasi pesanan ke bar yang benar?', ['Dua latte panas less sugar', 'Latte', 'Pesanan nomor dua', 'Lima ribu dua ratus'], 0, 'Format memuat jumlah, produk, suhu, dan permintaan khusus.'),
      q('Mengapa pelanggan perlu dipilih sebelum transaksi?', ['Agar harga tier, poin, dan riwayat tercatat benar', 'Agar struk lebih panjang', 'Agar bisa memakai promo apa pun', 'Tidak ada pengaruhnya'], 0, 'Tier harga dan poin bergantung pada pelanggan yang dipilih.'),
    ],
    rubric: [rb('Ketepatan input transaksi', 40), rb('Penanganan pembayaran & QRIS', 30), rb('Komunikasi pesanan ke bar', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus praktik POS dengan pendampingan minimal satu shift.',
  },
  {
    code: 'FND-08', title: 'Kerja Tim, Komunikasi & Penyelesaian Masalah', track: 'foundation', level: 'FND', duration: 45,
    summary: 'Cara berkomunikasi di dalam shift, membagi beban kerja, dan menyelesaikan masalah kecil sebelum membesar.',
    objectives: [
      'Menjelaskan pembagian peran dalam satu shift.',
      'Menggunakan komunikasi singkat yang jelas saat jam sibuk.',
      'Menerapkan langkah penyelesaian masalah sederhana.',
    ],
    relevance: 'Tim yang berkomunikasi baik melayani lebih cepat dengan kesalahan lebih sedikit.',
    prerequisites: ['FND-04'],
    materials: [
      { title: 'Peran dalam shift', media: 'Teks', body: 'Shift leader mengatur alur dan keputusan. Barista fokus pada produksi minuman. Kasir menangani transaksi dan pelanggan. Kitchen menyiapkan makanan. Runner menyerahkan pesanan. Setiap peran wajib saling memberi informasi.' },
      { title: 'Komunikasi saat sibuk', media: 'Teks', body: 'Gunakan kalimat pendek dan spesifik: "Butuh bantuan kasir", "Latte dua siap", "Susu habis". Hindari kalimat panjang dan asumsi.' },
      { title: 'Langkah penyelesaian masalah', media: 'Teks', body: 'Hentikan risiko, identifikasi penyebab, tentukan tindakan cepat, jalankan, lalu catat dan laporkan. Untuk masalah yang menyangkut keselamatan, segera hentikan aktivitas dan lapor shift leader.' },
    ],
    sop: { code: 'SOP-FND-08', title: 'Briefing & eskalasi', points: ['Ikuti briefing 5 menit sebelum shift.', 'Laporkan hambatan lebih awal, bukan setelah selesai.', 'Eskalasi ke shift leader bila masalah berdampak ke pelanggan.'] },
    quiz: [
      q('Siapa yang mengambil keputusan alur saat shift berjalan?', ['Barista', 'Kasir', 'Shift leader', 'Pelanggan'], 2, 'Shift leader mengatur alur dan keputusan operasional.'),
      q('Kalimat komunikasi paling efektif saat jam sibuk?', ['"Sepertinya kita perlu menambah stok susu karena tadi saya lihat..."', '"Susu habis"', '"Semuanya berantakan"', '"Nanti saja"'], 1, 'Kalimat pendek dan spesifik paling efektif.'),
      q('Langkah pertama saat menemukan masalah berisiko keselamatan?', ['Mencatat dulu', 'Menghentikan aktivitas dan melapor', 'Menunggu shift selesai', 'Mencari penyebab selama satu jam'], 1, 'Risiko dihentikan lebih dulu, baru dianalisis.'),
    ],
    rubric: [rb('Kejelasan komunikasi', 40), rb('Kolaborasi dalam shift', 30), rb('Pengambilan tindakan saat masalah', 30)],
    passTheory: 80, passPractical: 80,
    gate: 'Dinilai melalui observasi shift oleh shift leader.',
  },
  {
    code: 'FND-09', title: 'Evaluasi Foundation & Sertifikasi Awal', track: 'foundation', level: 'FND', duration: 45,
    summary: 'Ujian akhir Foundation: pengetahuan produk, SOP dasar, layanan, dan keselamatan.',
    objectives: [
      'Menuntaskan seluruh modul Foundation FND-01 sampai FND-08.',
      'Lulus ujian teori minimal 80.',
      'Lulus observasi pelayanan dan kebersihan.',
    ],
    relevance: 'Sertifikasi Foundation adalah syarat bekerja mandiri pada tugas dasar.',
    prerequisites: ['FND-01', 'FND-02', 'FND-03', 'FND-04', 'FND-05', 'FND-06', 'FND-07', 'FND-08'],
    materials: [
      { title: 'Cakupan evaluasi', media: 'Teks', body: 'Ujian mencakup nilai perusahaan, produk, pelayanan, higiene dan keselamatan, opening-closing, POS, serta kerja tim. Siapkan catatan pribadi dari modul sebelumnya.' },
      { title: 'Observasi praktik', media: 'Teks', body: 'Trainer mengamati satu shift penuh: kebersihan, pelayanan, ketepatan transaksi, dan kepatuhan keselamatan. Kesalahan kritis membuat peserta belum lulus.' },
    ],
    sop: { code: 'SOP-FND-09', title: 'Sertifikasi Foundation', points: ['Selesaikan seluruh materi FND-01..08.', 'Kerjakan kuis modul ini minimal skor 80.', 'Ikuti observasi shift bersama trainer.', 'Badge Ondeway Explorer diterbitkan setelah semua syarat terpenuhi.'] },
    quiz: [
      q('Nilai minimal teori untuk lulus Foundation?', ['60', '70', '80', '90'], 2, 'Standar internal Foundation adalah 80.'),
      q('Bila peserta mengabaikan keselamatan meski nilai teori tinggi?', ['Tetap lulus', 'Lulus dengan catatan', 'Belum lulus', 'Lulus setelah satu minggu'], 2, 'Kesalahan kritis keselamatan menggugurkan kelulusan.'),
      q('Dokumen yang wajib dipahami sebelum bekerja mandiri?', ['SOP keselamatan dan higiene', 'Daftar harga', 'Jadwal libur', 'Struktur modal'], 0, 'SOP keselamatan dan higiene adalah syarat kerja mandiri.'),
    ],
    rubric: [rb('Ujian teori terpadu', 50), rb('Observasi kebersihan & keselamatan', 25, true), rb('Observasi pelayanan', 25)],
    passTheory: 80, passPractical: 80,
    gate: 'Lulus teori dan observasi; badge Ondeway Explorer otomatis diterbitkan.',
  },
];

module.exports = { FOUNDATION };
