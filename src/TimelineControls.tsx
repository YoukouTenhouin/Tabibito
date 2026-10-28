import { DateInput } from "./DateInput";
import { formatDate, useI18n } from "./i18n";
import { dateSchema } from "./shared";
import type { TimelineController } from "./useTimeline";

export function TimelineControls({
  timeline: tl,
  disabled,
  available,
}: {
  timeline: TimelineController;
  disabled: boolean;
  available: boolean;
}) {
  const { t, locale } = useI18n();
  const valid = dateSchema.safeParse(tl.start).success &&
    dateSchema.safeParse(tl.end).success && tl.start <= tl.end;
  const date = tl.position > 0
    ? tl.dates[Math.min(Math.ceil(tl.position) - 1, tl.dates.length - 1)]
    : null;
  const undated = tl.stableFlights.filter(f => !f.date).length;
  const message = !tl.stableFlights.some(f => f.date)
    ? "timeline.empty"
    : !valid ? "timeline.invalid" : !tl.dates.length ? "timeline.empty" : null;
  const playLabel = tl.playing ? "timeline.pause"
    : tl.position === tl.dates.length && tl.dates.length ? "timeline.replay" : "timeline.play";
  const dateLabel = date ? formatDate(date, locale) : t("timeline.beginning");

  return (
    <fieldset className="timeline-controls" disabled={disabled} aria-label={t("timeline.title")}>
      <div className="timeline-dates">
        <DateInput label={t("timeline.start")} value={tl.start} onChange={tl.setStart} optional={false} />
        <DateInput label={t("timeline.end")} value={tl.end} onChange={tl.setEnd} optional={false} />
      </div>
      <div className="timeline-playback">
        <button
          type="button"
          className="button secondary"
          disabled={!available || !tl.dates.length}
          onClick={tl.play}
        >
          {t(playLabel)}
        </button>
        <button type="button" className="button secondary" onClick={tl.reset}>
          {t("timeline.restart")}
        </button>
        <label>
          {t("timeline.speed")}
          <select value={tl.speed} onChange={e => tl.setSpeed(Number(e.target.value))}>
            {[0.5, 1, 2].map(speed => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
        </label>
        <output>{dateLabel}</output>
      </div>
      <input
        type="range"
        aria-label={t("timeline.seek")}
        aria-valuetext={dateLabel}
        min={0}
        max={tl.dates.length || 1}
        step={1}
        value={Math.floor(tl.position)}
        disabled={!tl.dates.length}
        onChange={e => tl.seek(Number(e.target.value))}
      />
      {message && <p role="status">{t(message)}</p>}
      <p>{t("timeline.undated", { count: undated })}</p>
    </fieldset>
  );
}
