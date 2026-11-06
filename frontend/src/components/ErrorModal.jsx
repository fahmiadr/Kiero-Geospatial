/**
 * Komponen modal yang dapat digunakan kembali untuk menampilkan pesan kesalahan kepada pengguna.
 * Komponen ini menyajikan dialog yang bersih dan terpusat dengan judul, pesan kesalahan,
 * dan tombol "Tutup".
 *
 * @param {object} props - Properti komponen.
 * @param {string} props.message - Pesan kesalahan untuk ditampilkan di badan modal.
 * @param {Function} props.onClose - Fungsi callback yang akan dieksekusi saat tombol "Tutup" diklik.
 * @returns {JSX.Element} Komponen dialog modal untuk menampilkan kesalahan.
 */
const ErrorModal = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="text-center">
          <h3 className="text-lg leading-6 font-medium text-red-600">Terjadi Kesalahan</h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">{message}</p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorModal;