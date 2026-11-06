/**
 * Komponen Tooltip wrapper sederhana yang menghubungkan elemen trigger
 * ke instance Global Tooltip yang ada di App.jsx.
 *
 * Menggunakan pendekatan Singleton Pattern dari react-tooltip v5:
 * - 1 Global <Tooltip id="main-tooltip" /> di root (App.jsx)
 * - N Trigger elements dengan data-tooltip-id="main-tooltip"
 *
 * Pendekatan ini menyelesaikan masalah:
 * 1. Positioning issue (top-left rendering) karena race condition mounting
 * 2. Z-index obstruction (karena global instance punya z-index tinggi)
 * 3. Performance (hanya 1 event listener global)
 *
 * @param {object} props - Properti komponen.
 * @param {React.ReactNode} props.children - Elemen trigger.
 * @param {string} props.content - Konten tooltip.
 * @param {string} [props.placement='top'] - Posisi: 'top', 'bottom', 'left', 'right'.
 * @param {boolean} [props.enabled=true] - Apakah tooltip aktif.
 * @param {number} [props.delay=200] - Delay dalam ms.
 * @returns {JSX.Element} Wrapper element dengan data attributes.
 */
const Tooltip = ({
  children,
  content,
  placement = 'top',
  enabled = true,
  delay = 200,
  className = 'inline-flex'
}) => {
  // Jika tidak ada content atau disabled, render children saja
  if (!content || !enabled) {
    return children;
  }

  return (
    <span
      data-tooltip-id="main-tooltip"
      data-tooltip-content={content}
      data-tooltip-place={placement}
      data-tooltip-delay-show={delay}
      className={className}
    >
      {children}
    </span>
  );
};

export default Tooltip;