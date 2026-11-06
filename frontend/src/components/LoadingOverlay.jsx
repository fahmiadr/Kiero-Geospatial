/**
 * Komponen overlay yang dapat digunakan kembali untuk menunjukkan status pemuatan.
 * Komponen ini menampilkan spinner CSS dan pesan teks yang dapat disesuaikan di atas
 * latar belakang semi-transparan, mencegah interaksi pengguna dengan konten di bawahnya saat memuat.
 *
 * @param {object} props - Properti komponen.
 * @param {string} props.text - Pesan teks untuk ditampilkan di bawah spinner (misalnya, "Memuat...").
 * @returns {JSX.Element} Elemen overlay pemuatan.
 */
const LoadingOverlay = ({ text }) => (
  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
    <div className="spinner"></div>
    <p className="mt-4 text-gray-700 font-medium">{text}</p>
  </div>
);

export default LoadingOverlay;