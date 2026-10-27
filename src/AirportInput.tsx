import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "./backup";
import { searchAirports } from "./airports";
import { airportCode, type Airport } from "./shared";
import { Icon } from "./icons";

export function AirportInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(
    value ? `${airportCode(value)} · ${value.name}` : "",
  );
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value) setQuery(`${airportCode(value)} · ${value.name}`);
  }, [value]);
  useEffect(() => {
    if (value || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResults([]);
    const timer = setTimeout(() => {
      searchAirports(query)
        .then((rows) => {
          if (controller.signal.aborted) return;
          setResults(rows);
          setActive(0);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(errorMessage(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);
  function select(airport: Airport) {
    onChange(airport);
    setOpen(false);
    input.current?.focus();
  }
  return (
    <div
      className="airport-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="input-with-icon">
        <Icon name="pin" size={18} />
        <input
          id={id}
          ref={input}
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !value && query.length >= 2}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && results[active] ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          placeholder="City, airport or code"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            }
            if (event.key === "Enter" && open && results[active]) {
              event.preventDefault();
              select(results[active]);
            }
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      {open && !value && query.trim().length >= 2 && (
        <div
          className="airport-options"
          id={`${id}-list`}
          role="listbox"
          aria-label={`${label} results`}
        >
          {loading ? (
            <p role="status">Searching airports…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : results.length === 0 ? (
            <p>No airports found. Try an IATA or ICAO code.</p>
          ) : (
            results.map((airport, index) => (
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                id={`${id}-${index}`}
                key={airport.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(airport)}
                className={active === index ? "active" : ""}
              >
                <strong>{airportCode(airport)}</strong>
                <span>
                  {airport.name}
                  <small>
                    {airport.city || airport.country} · {airport.country}
                    {airport.closed ? " · Closed airport" : ""}
                  </small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
      {value && (
        <small className="field-hint">
          {value.city || value.name}, {value.country}
          {value.closed ? " · Closed airport" : ""}
        </small>
      )}
    </div>
  );
}
