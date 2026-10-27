import { useEffect, useId, useRef, useState } from "react";
import { dateSchema } from "./shared";

// Accept year-first dates without requiring zero padding or a particular separator.
export function normalizeDate(value: string) {
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value.trim());
  if (!match) return value;
  const normalized = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return dateSchema.safeParse(normalized).success ? normalized : value;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIso = (value: string) => new Date(`${value}T12:00:00`);

export function DateInput({
  value,
  onChange,
  optional,
}: {
  value: string;
  onChange: (value: string) => void;
  optional: boolean;
}) {
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
        Departure date {optional && <span className="optional">optional</span>}
      </label>
      <div className="date-entry">
        <input
          id={id}
          type="text"
          placeholder="YYYY-MM-DD"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
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
          aria-label="Choose from calendar"
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
      <p id={`${id}-hint`} className="field-hint">
        Choose a date or type year-month-day, e.g. 2026-7-9.
      </p>
      {open && (
        <div
          id={`${id}-calendar`}
          className="date-calendar"
          role="group"
          aria-label="Departure calendar"
          lang="en"
        >
          <div className="date-navigation">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
            >
              ‹
            </button>
            <select
              aria-label="Month"
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
              aria-label="Year"
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
              aria-label="Next month"
              onClick={() => moveMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="date-days">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
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
                  aria-label={`${months[monthIndex]} ${index + 1}, ${year}`}
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
              Today
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => choose("")}
            >
              Clear date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
