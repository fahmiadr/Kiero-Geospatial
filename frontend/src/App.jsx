import { Routes, Route, Link } from 'react-router-dom';
import { Tooltip as GlobalTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import MapPage from './pages/MapPage';
import IframeFullMapPage from './pages/IframeFullMapPage';
import GlobalErrorHandler from './components/GlobalErrorHandler';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Komponen halaman 404 (Not Found) sederhana.
 * Ditampilkan oleh router ketika tidak ada rute lain yang cocok.
 * Menyertakan <Link> (dari React Router) untuk kembali ke halaman utama.
 * @returns {JSX.Element} Halaman 404.
 */
const NotFound = () => (
    <div className="w-screen h-screen flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold mb-4">404 - Halaman Tidak Ditemukan</h1>
        <p className="text-lg">Maaf, halaman yang Anda cari tidak ada.</p>
        <Link to="/" className="mt-8 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Kembali ke Peta
        </Link>
    </div>
);

/**
 * Komponen root aplikasi yang mengatur routing sisi klien menggunakan React Router.
 * Komponen ini mendefinisikan rute-rute utama aplikasi dan me-render
 * komponen halaman yang sesuai berdasarkan URL saat ini.
 * * Rute yang Didefinisikan:
 * - `/`: Aplikasi peta utama (`MapPage`).
 * - `/share`: Halaman untuk menampilkan lokasi yang dibagikan (`SharePage`).
 * - `/map-iframe`: Versi peta minimalis untuk disematkan (`IframeMapPage`).
 * - `*` (catch-all): Halaman 404 (`NotFound`) jika tidak ada rute lain yang cocok.
 *
 * Catatan: Semua path ini relatif terhadap `basename` yang diatur dalam
 * `<BrowserRouter>` di `main.jsx`.
 *
 * @returns {JSX.Element} Komponen <Routes> yang berisi halaman aktif.
 */
const App = () => {

    return (
        <>
            <GlobalErrorHandler />
            <ErrorBoundary>
                <Routes>
                    <Route path="/" element={<MapPage />} />
                    <Route path="/map-iframe-full" element={<IframeFullMapPage />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </ErrorBoundary>

            {/* Global Tooltip Instance */}
            <GlobalTooltip
                id="main-tooltip"
                className="!bg-gray-900/95 !backdrop-blur-sm !rounded-lg !text-xs !font-medium !px-2.5 !py-1.5 !z-[99999]"
                style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    padding: '0.375rem 0.625rem',
                    zIndex: 99999
                }}
                noArrow={false}
            />
        </>
    );
};

export default App;
