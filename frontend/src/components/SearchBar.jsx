
import { useRef, useEffect, useState, useMemo } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useGeoSearch } from '../hooks/useGeoSearch';
import { Search, SearchX, LoaderCircle } from 'lucide-react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
  size
} from '@floating-ui/react';



const SearchBar = ({ onPlaceSelect }) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [googlePredictions, setGooglePredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const itemRefs = useRef([]);
  const isSelectingRef = useRef(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(8),
      flip(),
      shift(),
      size({
        apply({ rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${rects.reference.width}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // Sync refs
  useEffect(() => {
    if (inputRef.current) {
      refs.setReference(inputRef.current);
    }
  }, [inputRef, refs]);

  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);

  const {
    data: localPredictions = [],
    isLoading: isLocalLoading
  } = useGeoSearch(debouncedValue);

  useEffect(() => {
    if (placesLib && !autocompleteService) {
      setAutocompleteService(new placesLib.AutocompleteService());
    }
    if (placesLib && map && !placesService) {
      setPlacesService(new placesLib.PlacesService(map));
    }
  }, [placesLib, map, autocompleteService, placesService]);

  // Debounce implementation
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
      if (inputValue.length <= 2) {
        setGooglePredictions([]);
        setIsOpen(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch Google Predictions
  useEffect(() => {
    if (debouncedValue.length > 2 && autocompleteService) {
      autocompleteService.getPlacePredictions({
        input: debouncedValue,
        componentRestrictions: { country: 'id' },
        types: ['geocode', 'establishment']
      }, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setGooglePredictions(predictions);
        } else {
          setGooglePredictions([]);
        }
      });
      setIsOpen(true);
    }
  }, [debouncedValue, autocompleteService]);

  const isLoading = isLocalLoading;
  const predictions = useMemo(() => ({
    local: localPredictions,
    google: googlePredictions
  }), [localPredictions, googlePredictions]);

  const allPredictions = useMemo(() => [
    ...predictions.local,
    ...predictions.google
  ], [predictions]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, allPredictions.length);
  }, [allPredictions]);

  const handleLocalSelect = (feature) => {
    isSelectingRef.current = true;
    setInputValue(feature.properties.nama);
    setIsOpen(false);
    onPlaceSelect(feature);
  };

  const handleGoogleSelect = (placePrediction) => {
    isSelectingRef.current = true;
    setInputValue(placePrediction.description);
    setIsOpen(false);

    if (!placesService) return;

    placesService.getDetails({
      placeId: placePrediction.place_id,
      fields: ['geometry', 'name', 'formatted_address', 'types', 'address_components']
    }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry && place.geometry.location) {
        onPlaceSelect(place);
      }
    });
  };

  const handleClear = () => {
    setInputValue('');
    setGooglePredictions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Reset highlighted index when predictions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [predictions, isOpen]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      requestAnimationFrame(() => {
        itemRefs.current[highlightedIndex]?.scrollIntoView({
          inline: 'nearest',
          block: 'nearest',
        });
      });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen || allPredictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % allPredictions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + allPredictions.length) % allPredictions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightedIndex >= 0 && highlightedIndex < allPredictions.length) {
        e.preventDefault();
        const selectedItem = allPredictions[highlightedIndex];
        if (highlightedIndex < predictions.local.length) {
          handleLocalSelect(selectedItem);
        } else {
          handleGoogleSelect(selectedItem);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
          <Search size={16} />
        </span>

        <input
          ref={inputRef}
          {...getReferenceProps()}
          type="text"
          placeholder="Cari wilayah, kota, atau POI..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => inputValue.length > 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="relative w-full pl-9 pr-9 py-2 bg-white border-transparent rounded-full text-sm shadow-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 z-0"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center">
          {isLoading ? (
            <LoaderCircle size={16} className="animate-spin text-gray-500" />
          ) : inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Hapus pencarian"
            >
              <SearchX size={16} />
            </button>
          )}
        </div>
      </div>

      <FloatingPortal>
        {isOpen && (predictions.local.length > 0 || predictions.google.length > 0) && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="bg-white rounded-lg shadow-xl max-h-[60vh] overflow-y-auto custom-scrollbar z-[100] border border-gray-100 py-1 scroll-p-1"
          >
            {predictions.local.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                  Wilayah
                </div>
                {predictions.local.map((item, index) => {
                  const isHighlighted = index === highlightedIndex;

                  // Helper to determine dynamic type name
                  const getTypeName = (level, tipeAdm) => {
                    if (level === 'desa') {
                      return tipeAdm === '2' ? 'kelurahan' : 'desa';
                    }
                    if (level === 'kab_kota' || level === 'kabkota') {
                      return tipeAdm === '5' ? 'Kota' : 'Kab.';
                    }
                    return level; // Fallback
                  };

                  const regionType = getTypeName(item.properties.level, item.properties.tipe_adm);

                  // Construct hierarchical string
                  const parts = [];

                  // Always add the type of the current region first
                  parts.push(regionType);

                  if (item.properties.level === 'desa' || item.properties.level === 'kelurahan') {
                    if (item.properties.nama_kec) {
                      parts.push(`Kec. ${item.properties.nama_kec}`);
                    }
                  }

                  if (item.properties.level !== 'kab_kota' && item.properties.level !== 'kabkota' && item.properties.level !== 'provinsi') {
                    if (item.properties.nama_kab) {
                      const kabType = item.properties.tipe_adm_kab === '5' ? 'Kota' : 'Kab.';
                      parts.push(`${kabType} ${item.properties.nama_kab}`);
                    }
                  }

                  if (item.properties.level !== 'provinsi') {
                    if (item.properties.nama_prov) {
                      parts.push(`Prov. ${item.properties.nama_prov}`);
                    }
                  }

                  return (
                    <button
                      key={`local-${index}`}
                      ref={(el) => (itemRefs.current[index] = el)}
                      onClick={() => handleLocalSelect(item)}
                      className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                    >
                      <div className="font-medium text-gray-800 text-sm">{item.properties.nama}</div>
                      <div className="text-xs text-gray-500 mt-0.5 capitalize">
                        {parts.join(' • ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {predictions.google.length > 0 && (
              <div className="py-2 border-t border-gray-100">
                <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                  Google Maps
                </div>
                {predictions.google.map((item, index) => {
                  const globalIndex = predictions.local.length + index;
                  const isHighlighted = globalIndex === highlightedIndex;
                  return (
                    <button
                      key={item.place_id}
                      ref={(el) => (itemRefs.current[globalIndex] = el)}
                      onClick={() => handleGoogleSelect(item)}
                      className={`w-full text-left px-4 py-2.5 border-b border-gray-50 last:border-0 ${isHighlighted ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                    >
                      <div className="font-medium text-gray-800 text-sm">{item.structured_formatting.main_text}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.structured_formatting.secondary_text}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </FloatingPortal>
    </div>
  );
};

export default SearchBar;
