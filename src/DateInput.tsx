import { useI18n, calendarNames, formatDate } from "./i18n";
import { useEffect, useId, useRef, useState } from "react";
import { dateSchema } from "./shared";

// Accept year-first dates without requiring zero padding or a particular separator.
export function normalizeDate(value: string) {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value.trim());
  if (!match) return value;
  const normalized = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return dateSchema.safeParse(normalized).success ? normalized : value;
}

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIso = (value: string) => new Date(`${value}T12:00:00`);

export function DateInput({
  value,
  onChange,
  optional,
  label,
  showHint = true,
}: {
  value: string;
  onChange: (value: string) => void;
  optional: boolean;
  label?: string;
  showHint?: boolean;
}) {
  const { t, locale } = useI18n();
  const { months, weekdays } = calendarNames(locale);
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    dateSchema.safeParse(value).success ? fromIso(value) : new Date(),
  );
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (normalizeDate(draft) !== value) setDraft(value);
  }, [value, draft]);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  function choose(next: string) {
    setDraft(next);
    onChange(next);
    setOpen(false);
    toggle.current?.focus();
  }
  function moveMonth(delta: number) {
    setMonth(new Date(year, monthIndex + delta, 1));
  }
  return (
    <div
      className="date-field"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <label htmlFor={id}>
        {label ?? t("date.label")}{" "}
        {optional && <span className="optional">{t("common.optional")}</span>}
      </label>
      <div className="date-entry">
        <input
          id={id}
          type="text"
          placeholder="YYYY-MM-DD"
          autoComplete="off"
          aria-describedby={showHint ? `${id}-hint` : undefined}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(normalizeDate(event.target.value));
          }}
          onBlur={() => setDraft(normalizeDate(draft))}
        />
        <button
          ref={toggle}
          type="button"
          className="button secondary"
          aria-label={t("date.open")}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={() => {
            if (!open)
              setMonth(
                dateSchema.safeParse(value).success
                  ? fromIso(value)
                  : new Date(),
              );
            setOpen(!open);
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4M17 3v4M3 11h18M7 15h3M14 15h3" />
          </svg>
        </button>
      </div>
      {showHint && <p id={`${id}-hint`} className="field-hint">
        {t("date.hint")}
      </p>}
      {open && (
        <div
          id={`${id}-calendar`}
          className="date-calendar"
          role="group"
          aria-label={t("date.calendar")}
          lang={locale}
        >
          <div className="date-navigation">
            <button
              type="button"
              aria-label={t("date.previous")}
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <select
              aria-label={t("date.month")}
              value={monthIndex}
              onChange={(event) =>
                setMonth(new Date(year, Number(event.target.value), 1))
              }
            >
              {months.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label={t("date.year")}
              value={year}
              onChange={(event) =>
                setMonth(new Date(Number(event.target.value), monthIndex, 1))
              }
            >
              {Array.from(
                {
                  length:
                    Math.max(new Date().getFullYear() + 5, year) -
                    Math.min(1900, year) +
                    1,
                },
                (_, index) => Math.min(1900, year) + index,
              ).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label={t("date.next")}
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="date-days">
            {weekdays.map((day) => (
              <span key={day} aria-hidden="true">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date = new Date(year, monthIndex, index + 1);
              const key = iso(date);
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={formatDate(key, locale, "long")}
                  aria-pressed={value === key}
                  aria-current={key === iso(new Date()) ? "date" : undefined}
                  onClick={() => choose(key)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="date-shortcuts">
            <button
              type="button"
              className="text-button"
              onClick={() => choose(iso(new Date()))}
            >
              {t("date.today")}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => choose("")}
            >
              {t("date.clear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
