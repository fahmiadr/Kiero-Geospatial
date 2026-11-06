import { AdvancedMarker } from '@vis.gl/react-google-maps';
import PropTypes from 'prop-types';

/**
 * Komponen penanda peta yang merepresentasikan sebuah kluster dari beberapa titik data.
 * Komponen ini menampilkan lingkaran berwarna dengan jumlah titik di dalam kluster. Ukuran dan warna
 * lingkaran ditentukan secara dinamis berdasarkan jumlah titik, memberikan indikasi visual yang jelas
 * tentang kepadatan data.
 *
 * @param {object} props - Properti komponen.
 * @param {number} props.count - Jumlah item di dalam kluster.
 * @param {number} props.lat - Latitude dari sentroid kluster.
 * @param {number} props.lng - Longitude dari sentroid kluster.
 * @returns {JSX.Element} Sebuah `<AdvancedMarker>` yang berisi pin kluster yang telah ditata.
 */
const ClusterPin = ({ count, lat, lng }) => {
  // Menentukan ukuran pin berdasarkan jumlah count untuk visualisasi
  const size = count < 100 ? 30 : count < 1000 ? 40 : 50;
  // Menentukan skema warna berdasarkan ukuran
  const backgroundColor =
    count < 100
      ? 'rgba(5, 150, 105, 0.8)' // Emerald
      : count < 1000
        ? 'rgba(245, 158, 11, 0.8)' // Amber
        : 'rgba(220, 38, 38, 0.8)'; // Red

  return (
    <AdvancedMarker position={{ lat, lng }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          backgroundColor: backgroundColor,
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 'bold',
          fontSize: '1rem',
          border: '2px solid white',
          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.1s ease-in-out',
        }}
        className="hover:scale-110"
      >
        {count}
      </div>
    </AdvancedMarker>
  );
};

ClusterPin.propTypes = {
  count: PropTypes.number.isRequired,
  lat: PropTypes.number.isRequired,
  lng: PropTypes.number.isRequired,
};

export default ClusterPin;
