import { useState } from "react";
import { errorMessage } from "./backup";
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
  const [date, setDate] = useState(flight?.date ?? "");
  const [number, setNumber] = useState(flight?.flightNumber ?? "");
  const [origin, setOrigin] = useState<Airport | null>(flight?.origin ?? null);
  const [destination, setDestination] = useState<Airport | null>(
    flight?.destination ?? null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = flightInputSchema.safeParse({
      date: date || null,
      flightNumber: number.trim() || null,
      origin,
      destination,
    });
    if (!parsed.success) {
      setError(
        !origin || !destination
          ? "Select both airports before saving."
          : parsed.error.issues[0].message,
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
      setError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Modal
      title={flight ? "Edit your flight" : "Add a journey"}
      subtitle="A new line on your personal map."
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
              Flight number <span className="optional">optional</span>
              <input
                placeholder="e.g. BA249"
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
              label="Departure airport"
              value={origin}
              onChange={setOrigin}
            />
            <div className="route-divider">
              <Icon name="arrow" size={18} />
            </div>
            <AirportInput
              label="Arrival airport"
              value={destination}
              onChange={setDestination}
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={!origin || !destination}
            >
              <Icon name="plus" size={17} />
              {busy === "save"
                ? "Saving…"
                : flight
                  ? "Save changes"
                  : "Save flight"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
