import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { searchApi } from '../../api/search.api';

export default function StationAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    searchApi
      .autocomplete(debouncedQuery)
      .then((res) => {
        if (!cancelled) {
          setSuggestions(res.data || []);
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value]);

  const handleSelect = (station) => {
    setQuery(`${station.name} (${station.code})`);
    onChange(station.code, station.name);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const newValue = e.target.value;

            setQuery(newValue);

            if (newValue.length < 2) {
              onChange('', '');
              setSuggestions([]);
              setOpen(false);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          className="input-field pr-10"
        />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary-700" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          className="
            absolute
            z-50
            left-0
            right-0
            mt-2
            bg-white
            border
            border-gray-200
            rounded-xl
            shadow-xl
            overflow-hidden
            max-h-64
            overflow-y-auto
          "
        >
          {suggestions.map((station) => (
            <li
              key={station.stationId || station.code}
              onClick={() => handleSelect(station)}
              className="
                group
                flex
                items-center
                justify-between
                gap-4
                px-4
                py-3.5
                cursor-pointer
                bg-white
                border-b
                border-gray-100
                last:border-b-0
                hover:bg-primary-50
                transition-all
                duration-150
              "
            >
              {/* Station Information */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Station Icon */}
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-gray-100
                    text-gray-600
                    group-hover:bg-primary-100
                    group-hover:text-primary-800
                    transition-colors
                  "
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10h18M5 10V8a7 7 0 0114 0v2M6 10v8m12-8v8M4 18h16"
                    />
                  </svg>
                </div>

                {/* Name + Subtitle */}
                <div className="min-w-0">
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-gray-800
                      group-hover:text-primary-900
                      truncate
                    "
                  >
                    {station.name}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Railway Station
                  </p>
                </div>
              </div>

              {/* Station Code */}
              <span
                className="
                  shrink-0
                  rounded-md
                  bg-gray-100
                  px-2.5
                  py-1.5
                  text-xs
                  font-bold
                  tracking-wide
                  text-gray-700
                  group-hover:bg-primary-100
                  group-hover:text-primary-900
                  transition-colors
                "
              >
                {station.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}