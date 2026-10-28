import { airportName, airportCity, countryName } from "./places";
import { usePlaceNames } from "./usePlaceNames";
import { useI18n } from "./i18n";
import { useEffect, useId, useRef, useState } from "react";
import { errorCode, type ErrorCode } from "./errors";
import { searchAirports, type AirportSearchResult } from "./airports";
import { airportCode, type Airport } from "./shared";
import { Icon } from "./icons";

export function AirportInput({
  label,
  date,
  value,
  onChange,
}: {
  label: string;
  date?: string | null;
  value: Airport | null;
  onChange: (airport: Airport | null) => void;
}) {
  const { t, locale } = useI18n();
  const placeVersion = usePlaceNames();
  const id = useId();
  const [query, setQuery] = useState(
    value ? `${airportCode(value)} · ${airportName(value, locale)}` : "",
  );
  const [results, setResults] = useState<AirportSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorCode | "">("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value)
      setQuery(`${airportCode(value)} · ${airportName(value, locale)}`);
  }, [value, locale, placeVersion]);
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
      searchAirports(query, date)
        .then((rows) => {
          if (controller.signal.aborted) return;
          setResults(rows);
          setActive(0);
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(errorCode(error));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value, placeVersion, date]);
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
          placeholder={t("airport.placeholder")}
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
              select(results[active].airport);
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
          aria-label={t("airport.results", { label })}
        >
          {loading ? (
            <p role="status">{t("airport.searching")}</p>
          ) : error ? (
            <p role="alert">{t(error)}</p>
          ) : results.length === 0 ? (
            <p>{t("airport.empty")}</p>
          ) : (
            results.map(({ airport, period }, index) => (
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                id={`${id}-${index}`}
                key={`${airport.id}-${period?.fromDate ?? "current"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(airport)}
                className={active === index ? "active" : ""}
              >
                <strong>{airportCode(airport)}</strong>
                <span>
                  {airportName(airport, locale)}
                  <small>
                    {airportCity(airport, locale)} ·{" "}
                    {countryName(airport.country, locale)}
                    {airport.closed ? t("airport.closed") : ""}
                    {period && <span> · {period.fromDate === "1990-01-01" ? "…" : period.fromDate} – {period.untilDate ? `< ${period.untilDate}` : "…"}</span>}
                  </small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
      {value && (
        <small className="field-hint">
          {airportCity(value, locale) || airportName(value, locale)},{" "}
          {countryName(value.country, locale)}
          {value.closed ? t("airport.closed") : ""}
        </small>
      )}
    </div>
  );
}
