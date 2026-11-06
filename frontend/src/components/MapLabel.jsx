import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef } from 'react';

/**
 * Komponen React kustom yang me-render label teks langsung di atas kanvas Google Map.
 * Komponen ini memanfaatkan kelas `OverlayView` dari Google Maps untuk membuat overlay HTML
 * kustom untuk setiap label. Komponen ini adalah komponen "headless" karena tidak me-render
 * DOM-nya sendiri, melainkan secara imperatif mengelola instance `OverlayView`.
 *
 * @param {object} props - Properti komponen.
 * @param {google.maps.LatLng | {lat: number, lng: number}} props.position - Posisi geografis untuk label.
 * @param {string} props.text - Konten teks dari label.
 * @param {string} [props.color='#1f2937'] - Warna teks label.
 * @returns {null} Komponen ini tidak me-render output apa pun.
 */
const MapLabel = ({ position, text, color = '#1f2937', isHovered = false }) => {
  const map = useMap();
  const maps = useMapsLibrary('maps');
  const overlayViewRef = useRef(null);

  // Effect to create and manage the overlay
  useEffect(() => {
    if (!map || !maps) return;

    class CustomOverlay extends maps.OverlayView {
      constructor(pos, content, clr) {
        super();
        this.div = null;
        this.pos = pos;
        this.content = content;
        this.clr = clr;
        this.hovered = false; // Initial state
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.style.whiteSpace = 'nowrap';
        this.div.style.transform = 'translate(-50%, -50%)';

        // Modern Styling
        this.div.style.color = '#374151';
        this.div.style.fontFamily = 'Inter, system-ui, sans-serif';
        this.div.style.fontSize = '14px';
        this.div.style.fontWeight = '600';
        this.div.style.pointerEvents = 'none';

        // Natural white halo (stacked blurs for solid contrast without hard edges)
        this.div.style.textShadow = '1px 1px 0px #FFF, -1px -1px 0px #FFF, 1px -1px 0px #FFF, -1px 1px 0px #FFF, 0px 0px 4px #FFF';

        // Transitions - ONLY animate specific properties
        this.div.style.transition = 'font-size 0.2s ease-in-out, font-weight 0.2s ease-in-out, z-index 0.2s ease-in-out';
        this.div.style.zIndex = 'auto';

        this.div.innerHTML = this.content;

        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(this.div);
      }

      draw() {
        const overlayProjection = this.getProjection();
        if (!overlayProjection || !this.div) return;

        const point = overlayProjection.fromLatLngToDivPixel(this.pos);
        if (point) {
          this.div.style.left = `${point.x}px`;
          this.div.style.top = `${point.y}px`;
        }
      }

      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }

      updateStyle(hovered) {
        this.hovered = hovered;
        if (this.div) {
          this.div.style.fontSize = hovered ? '16px' : '14px';
          this.div.style.fontWeight = hovered ? '800' : '600';
          this.div.style.zIndex = hovered ? '1000' : 'auto';
        }
      }
    }

    // Create overlay
    const overlay = new CustomOverlay(position, text, color);
    overlay.setMap(map);
    overlayViewRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayViewRef.current = null;
    };
  }, [map, maps, position, text, color]); // Re-create only if these change

  // Effect to update style on hover change
  useEffect(() => {
    if (overlayViewRef.current) {
      overlayViewRef.current.updateStyle(isHovered);
    }
  }, [isHovered]);

  return null;
};

export default MapLabel;