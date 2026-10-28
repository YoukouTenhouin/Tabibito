import { useI18n } from "./i18n";
import { useState } from "react";
import { errorCode, type ErrorCode } from "./errors";
import { flightStore } from "./storage";
import { flightInputSchema, type Airport, type Flight } from "./shared";
import { AirportInput } from "./AirportInput";
import { Modal } from "./Modal";
import { Icon } from "./icons";
import { DateInput } from "./DateInput";

export function FlightForm({
  flight,
  onClose,
  onSaved,
}: {
  flight?: Flight;
  onClose: () => void;
  onSaved: (flight: Flight) => Promise<void>;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(flight?.date ?? "");
  const [number, setNumber] = useState(flight?.flightNumber ?? "");
  const [origin, setOrigin] = useState<Airport | null>(flight?.origin ?? null);
  const [destination, setDestination] = useState<Airport | null>(
    flight?.destination ?? null,
  );
  const [stops, setStops] = useState(() => (flight?.stops ?? []).map(airport => ({ key: crypto.randomUUID(), airport: airport as Airport | null })));
  const [error, setError] = useState<ErrorCode | "">("");
  const [busy, setBusy] = useState<"save" | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = flightInputSchema.safeParse({
      date: date || null,
      flightNumber: number.trim() || null,
      origin,
      destination,
      stops: stops.map(stop => stop.airport),
    });
    if (!parsed.success) {
      setError(
        !origin || !destination || stops.some(stop => !stop.airport)
          ? "errors.selectAirports"
          : errorCode(parsed.error),
      );
      return;
    }
    setBusy("save");
    try {
      const saved = flight
        ? await flightStore.update(flight.id, parsed.data)
        : await flightStore.create(parsed.data);
      await onSaved(saved);
      onClose();
    } catch (error) {
      setError(errorCode(error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Modal
      title={flight ? t("flight.editTitle") : t("flight.addTitle")}
      subtitle={t("flight.subtitle")}
      onClose={onClose}
      busy={Boolean(busy)}
    >
      <form onSubmit={save}>
        <fieldset disabled={Boolean(busy)}>
          <div className="form-row">
            <DateInput
              value={date}
              optional
              onChange={(value) => {
                setDate(value);
              }}
            />
            <label>
              {t("flight.number")}{" "}
              <span className="optional">{t("common.optional")}</span>
              <input
                placeholder={t("flight.numberPlaceholder")}
                maxLength={20}
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value);
                }}
              />
            </label>
          </div>
          <div className="airport-fields">
            <AirportInput
              date={date || null}
              label={t("flight.origin")}
              value={origin}
              onChange={setOrigin}
            />
            <div className="route-divider">
              <Icon name="arrow" size={18} />
            </div>
            {stops.map((stop, index) => <div key={stop.key} className="stop-row">
              <AirportInput date={date || null} label={t("flight.stop", { number: index + 1 })} value={stop.airport} onChange={airport => setStops(rows => rows.map(row => row.key === stop.key ? { ...row, airport } : row))} />
              <div className="stop-actions">
                <button type="button" disabled={index === 0} onClick={() => setStops(rows => { const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>{t("flight.moveUp")}</button>
                <button type="button" disabled={index === stops.length - 1} onClick={() => setStops(rows => { const next = [...rows]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>{t("flight.moveDown")}</button>
                <button type="button" onClick={() => setStops(rows => rows.filter(row => row.key !== stop.key))}>{t("flight.removeStop")}</button>
              </div>
            </div>)}
            <button type="button" className="button secondary" onClick={() => setStops(rows => [...rows, { key: crypto.randomUUID(), airport: null }])}>{t("flight.addStop")}</button>
            <AirportInput
              date={date || null}
              label={t("flight.destination")}
              value={destination}
              onChange={setDestination}
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              {t("common.cancel")}
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={!origin || !destination || stops.some(stop => !stop.airport)}
            >
              <Icon name="plus" size={17} />
              {busy === "save"
                ? t("flight.saving")
                : flight
                  ? t("flight.saveChanges")
                  : t("flight.save")}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
