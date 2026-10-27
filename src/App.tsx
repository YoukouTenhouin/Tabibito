import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { errorMessage } from "./backup";
import { flightStore } from "./storage";
import { airportCode, filteredFlights, type Flight } from "./shared";
import { FlightForm } from "./FlightForm";
import { BackupDialog } from "./BackupDialog";
import { Modal } from "./Modal";
import { Icon } from "./icons";
import { totalFlightDistance, formatDistance } from "./distance";
const FlightMap = lazy(() => import("./FlightMap"));
class MapBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="map-panel map-placeholder">
        <div>
          <p>The map could not load.</p>
          <p>Your history and backups are still available.</p>
          <button className="text-button" onClick={() => location.reload()}>
            Reload map
          </button>
        </div>
      </section>
    ) : (
      this.props.children
    );
  }
}
const formatDate = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${date}T00:00:00Z`))
    : "Date not recorded";

export default function App() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [form, setForm] = useState<Flight | "new" | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [deleting, setDeleting] = useState<Flight | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      setFlights(await flightStore.list());
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  const visible = useMemo(
    () => filteredFlights(flights, search, year),
    [flights, search, year],
  );
  const distance = useMemo(() => totalFlightDistance(flights), [flights]);
  const years = [
    ...new Set(
      flights.flatMap((flight) =>
        flight.date ? [flight.date.slice(0, 4)] : [],
      ),
    ),
  ]
    .sort()
    .reverse();
  const airports = new Set(
    flights.flatMap((flight) => [flight.origin.id, flight.destination.id]),
  );
  const countries = new Set(
    flights.flatMap((flight) => [
      flight.origin.country,
      flight.destination.country,
    ]),
  );
  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await flightStore.delete(deleting.id);
      await refresh();
      if (selected === deleting.id) setSelected(null);
      setDeleting(null);
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Tabibito home">
          <span className="brand-mark">
            <Icon name="plane" size={22} />
          </span>
          <span>
            tabibito
            <span className="brand-jp" lang="ja">
              旅人
            </span>
          </span>
        </a>
        <span className="header-label">A PERSONAL FLIGHT JOURNAL</span>
        <button className="button subtle" onClick={() => setBackupOpen(true)}>
          <Icon name="download" size={17} />
          <span>Backup & restore</span>
        </button>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">PLACES YOU’VE BEEN. STORIES YOU KEEP.</p>
            <h1>
              Your travels, traced<span>.</span>
            </h1>
            <p className="intro-copy">
              Every flight is part of your story. See how far you’ve come.
            </p>
          </div>
          <button
            className="button primary add-flight"
            onClick={() => setForm("new")}
          >
            <Icon name="plus" size={19} />
            Add flight
          </button>
        </section>
        <p className="notice">
          History is saved only in this browser for this site address. Clearing
          site data removes it. Export a backup to keep it safe or transfer it
          to another device.
        </p>
        <section className="stats" aria-label="Your travel statistics">
          <div className="stat">
            <span className="stat-icon">
              <Icon name="plane" />
            </span>
            <div>
              <strong>{loading ? "—" : flights.length}</strong>
              <span>Flights taken</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Icon name="pin" />
            </span>
            <div>
              <strong>{loading ? "—" : airports.size}</strong>
              <span>Airports visited</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Icon name="globe" />
            </span>
            <div>
              <strong>{loading ? "—" : countries.size}</strong>
              <span>Countries connected</span>
            </div>
          </div>
          <div
            className="distance-stat"
            role="group"
            aria-label="Estimated total flight distance"
          >
            <span>Estimated total distance</span>
            <strong>
              {loading ? "—" : `${formatDistance(distance.km)} km`}
            </strong>
            <strong>
              {loading ? "—" : `${formatDistance(distance.miles)} miles`}
            </strong>
            <small>All flights · great-circle estimate</small>
          </div>
        </section>
        {error && (
          <div className="error load-error" role="alert">
            {error}
            <button
              className="text-button"
              onClick={() => {
                setLoading(true);
                void refresh().catch(() => {});
              }}
            >
              Try again
            </button>
          </div>
        )}
        <div className="journal-layout">
          <section className="history-panel" aria-labelledby="history-title">
            <div className="history-heading">
              <h2 id="history-title">Flight history</h2>
              <span className="count-badge">{visible.length}</span>
            </div>
            <div className="filters">
              <div className="input-with-icon search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search flight history"
                  placeholder="Search flights or places"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                aria-label="Filter by year"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">All years</option>
                {years.map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option value="undated">Undated</option>
              </select>
            </div>
            <div className="history-list" aria-busy={loading}>
              {loading ? (
                <p className="list-status" role="status">
                  Loading your journeys…
                </p>
              ) : !visible.length ? (
                <div className="empty-history">
                  <span className="empty-icon">
                    <Icon
                      name={flights.length ? "search" : "plane"}
                      size={30}
                    />
                  </span>
                  <h3>
                    {error
                      ? "History unavailable"
                      : flights.length
                        ? "No matching journeys"
                        : "Your story starts here"}
                  </h3>
                  <p>
                    {error
                      ? "Try loading your history again."
                      : flights.length
                        ? "Try another search or choose a different year."
                        : "Add your first flight and put a new line on the map."}
                  </p>
                  {!error && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (flights.length) {
                          setSearch("");
                          setYear("");
                        } else setForm("new");
                      }}
                    >
                      {flights.length
                        ? "Clear filters"
                        : "Add your first flight"}
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
                </div>
              ) : (
                visible.map((flight) => (
                  <article
                    className={`flight-card ${selected === flight.id ? "selected" : ""}`}
                    key={flight.id}
                  >
                    <button
                      className="flight-select"
                      onClick={() => setSelected(flight.id)}
                      aria-pressed={selected === flight.id}
                      aria-label={`Show ${airportCode(flight.origin)} to ${airportCode(flight.destination)} on map`}
                    >
                      <div className="flight-top">
                        <span>{formatDate(flight.date)}</span>
                        <span className="flight-number">
                          {flight.flightNumber || "MANUAL ENTRY"}
                        </span>
                      </div>
                      <div className="flight-route">
                        <div>
                          <strong>{airportCode(flight.origin)}</strong>
                          <span>
                            {flight.origin.city || flight.origin.name}
                          </span>
                        </div>
                        <div className="route-line">
                          <span />
                          <Icon name="plane" size={18} />
                          <span />
                        </div>
                        <div>
                          <strong>{airportCode(flight.destination)}</strong>
                          <span>
                            {flight.destination.city || flight.destination.name}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flight-card-bottom">
                      <span>
                        {flight.origin.country}{" "}
                        <span className="light-dot">·</span>{" "}
                        {flight.destination.country}
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label={`Edit flight ${flight.flightNumber || airportCode(flight.origin)}`}
                          onClick={() => setForm(flight)}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          className="icon-button delete"
                          aria-label={`Delete flight ${flight.flightNumber || airportCode(flight.origin)}`}
                          onClick={() => {
                            setDeleting(flight);
                            setDeleteError("");
                          }}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            <div className="history-footer">
              <span className="live-dot" />
              Saved in this browser
            </div>
          </section>
          <MapBoundary>
            <Suspense
              fallback={
                <section className="map-panel map-placeholder" role="status">
                  Loading the map…
                </section>
              }
            >
              <FlightMap
                flights={visible}
                selected={selected}
                onSelect={setSelected}
              />
            </Suspense>
          </MapBoundary>
        </div>
        <footer className="page-footer">
          <span>
            <Icon name="globe" size={15} />
            Routes connect airports, not actual flight tracks.
          </span>
          <span>
            Made for the journey <span lang="ja">旅</span>
          </span>
        </footer>
      </main>
      {form && (
        <FlightForm
          flight={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSaved={async (saved) => {
            await refresh();
            setSearch("");
            setYear("");
            setSelected(saved.id);
          }}
        />
      )}
      {backupOpen && (
        <BackupDialog
          onClose={() => setBackupOpen(false)}
          onRestored={async () => {
            await refresh();
            setSelected(null);
            setSearch("");
            setYear("");
          }}
        />
      )}
      {deleting && (
        <Modal
          title="Delete this flight?"
          subtitle={`${airportCode(deleting.origin)} → ${airportCode(deleting.destination)} · ${formatDate(deleting.date)}`}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        >
          <p className="modal-copy">
            This removes the flight from your history and map. Other flights on
            this route will stay.
          </p>
          {deleteError && (
            <p className="error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              Keep flight
            </button>
            <button
              className="button danger"
              disabled={deleteBusy}
              onClick={remove}
            >
              {deleteBusy ? "Deleting…" : "Delete flight"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
