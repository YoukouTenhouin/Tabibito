import { useI18n, formatDate } from "./i18n";
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
import { errorCode, type ErrorCode } from "./errors";
import { flightStore } from "./storage";
import { routeAirports, airportCode, filteredFlights, type Flight } from "./shared";
import { FlightForm } from "./FlightForm";
import { BackupDialog } from "./BackupDialog";
import { Modal } from "./Modal";
import { Icon } from "./icons";
import { totalFlightDistance, formatDistance } from "./distance";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { airportName, airportCity, countryName } from "./places";
import { usePlaceNames } from "./usePlaceNames";
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
    return this.state.failed ? <MapFailure /> : this.props.children;
  }
}
function MapFailure() {
  const { t } = useI18n();
  return (
    <section className="map-panel map-placeholder">
      <div>
        <p>{t("map.failed")}</p>
        <p>{t("map.historyAvailable")}</p>
        <button className="text-button" onClick={() => location.reload()}>
          {t("map.reload")}
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const { t, locale } = useI18n();
  const placeVersion = usePlaceNames();
  const displayDate = (date: string | null) =>
    date ? formatDate(date, locale) : t("history.noDate");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorCode | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [form, setForm] = useState<Flight | "new" | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [deleting, setDeleting] = useState<Flight | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<ErrorCode | "">("");
  const refresh = useCallback(async () => {
    setError("");
    try {
      setFlights(await flightStore.list());
    } catch (error) {
      setError(errorCode(error));
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
    [flights, search, year, placeVersion],
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
    flights.flatMap(routeAirports).map(airport => airport.id),
  );
  const countries = new Set(
    flights.flatMap(routeAirports).map(airport => airport.country),
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
      setDeleteError(errorCode(error));
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand" aria-label={t("app.home")}>
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
        <span className="header-label">{t("app.tagline")}</span>
        <div className="header-actions">
          <LanguageSwitcher />
          <button className="button subtle" onClick={() => setBackupOpen(true)}>
            <Icon name="download" size={17} />
            <span>{t("backup.open")}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">{t("app.eyebrow")}</p>
            <h1>
              {t("app.heading")}
              <span>.</span>
            </h1>
            <p className="intro-copy">{t("app.intro")}</p>
          </div>
          <button
            className="button primary add-flight"
            onClick={() => setForm("new")}
          >
            <Icon name="plus" size={19} />
            {t("flight.add")}
          </button>
        </section>
        <p className="notice">{t("app.notice")}</p>
        <section className="stats" aria-label={t("stats.label")}>
          <div className="stat">
            <span className="stat-icon">
              <Icon name="plane" />
            </span>
            <div>
              <strong>
                {loading
                  ? "—"
                  : new Intl.NumberFormat(locale).format(flights.length)}
              </strong>
              <span>{t("stats.flights")}</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Icon name="pin" />
            </span>
            <div>
              <strong>
                {loading
                  ? "—"
                  : new Intl.NumberFormat(locale).format(airports.size)}
              </strong>
              <span>{t("stats.airports")}</span>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon">
              <Icon name="globe" />
            </span>
            <div>
              <strong>
                {loading
                  ? "—"
                  : new Intl.NumberFormat(locale).format(countries.size)}
              </strong>
              <span>{t("stats.countries")}</span>
            </div>
          </div>
          <div
            className="distance-stat"
            role="group"
            aria-label={t("stats.distanceLabel")}
          >
            <span>{t("stats.distance")}</span>
            <strong>
              {loading
                ? "—"
                : t("stats.km", { value: formatDistance(distance.km, locale) })}
            </strong>
            <strong>
              {loading
                ? "—"
                : t("stats.miles", {
                    value: formatDistance(distance.miles, locale),
                  })}
            </strong>
            <small>{t("stats.note")}</small>
          </div>
        </section>
        {error && (
          <div className="error load-error" role="alert">
            {t(error)}
            <button
              className="text-button"
              onClick={() => {
                setLoading(true);
                void refresh().catch(() => {});
              }}
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        <div className="journal-layout">
          <section className="history-panel" aria-labelledby="history-title">
            <div className="history-heading">
              <h2 id="history-title">{t("history.title")}</h2>
              <span className="count-badge">
                {new Intl.NumberFormat(locale).format(visible.length)}
              </span>
            </div>
            <div className="filters">
              <div className="input-with-icon search">
                <Icon name="search" size={17} />
                <input
                  aria-label={t("history.searchLabel")}
                  placeholder={t("history.searchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select
                aria-label={t("history.yearFilter")}
                value={year}
                onChange={(event) => setYear(event.target.value)}
              >
                <option value="">{t("history.allYears")}</option>
                {years.map((value) => (
                  <option key={value}>{value}</option>
                ))}
                <option value="undated">{t("history.undated")}</option>
              </select>
            </div>
            <div className="history-list" aria-busy={loading}>
              {loading ? (
                <p className="list-status" role="status">
                  {t("history.loading")}
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
                      ? t("history.unavailable")
                      : flights.length
                        ? t("history.noMatches")
                        : t("history.emptyTitle")}
                  </h3>
                  <p>
                    {error
                      ? t("history.retryHint")
                      : flights.length
                        ? t("history.searchHint")
                        : t("history.emptyHint")}
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
                        ? t("history.clearFilters")
                        : t("history.firstFlight")}
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
                      aria-label={flight.stops.length ? t("history.showFullRoute", { route: routeAirports(flight).map(airportCode).join(" → ") }) : t("history.showRoute", {
                        origin: airportCode(flight.origin),
                        destination: airportCode(flight.destination),
                      })}
                    >
                      <div className="flight-top">
                        <span>{displayDate(flight.date)}</span>
                        <span className="flight-number">
                          {flight.flightNumber || t("history.manual")}
                        </span>
                      </div>
                      <div className="flight-route">
                        <div>
                          <strong>{airportCode(flight.origin)}</strong>
                          <span>
                            {airportCity(flight.origin, locale) ||
                              airportName(flight.origin, locale)}
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
                            {airportCity(flight.destination, locale) ||
                              airportName(flight.destination, locale)}
                          </span>
                        </div>
                      </div>
                      {flight.stops.length > 0 && <p>{t("flight.via", { stops: flight.stops.map(airportCode).join(" → ") })}</p>}
                    </button>
                    <div className="flight-card-bottom">
                      <span>
                        {countryName(flight.origin.country, locale)}{" "}
                        <span className="light-dot">·</span>{" "}
                        {countryName(flight.destination.country, locale)}
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label={t("history.edit", {
                            flight:
                              flight.flightNumber || airportCode(flight.origin),
                          })}
                          onClick={() => setForm(flight)}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          className="icon-button delete"
                          aria-label={t("history.delete", {
                            flight:
                              flight.flightNumber || airportCode(flight.origin),
                          })}
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
              {t("history.saved")}
            </div>
          </section>
          <MapBoundary>
            <Suspense
              fallback={
                <section className="map-panel map-placeholder" role="status">
                  {t("map.loading")}
                </section>
              }
            >
              <FlightMap
                flights={visible}
                timelineScope={JSON.stringify([search, year])}
                selected={selected}
                onSelect={setSelected}
              />
            </Suspense>
          </MapBoundary>
        </div>
        <footer className="page-footer">
          <span>
            <Icon name="globe" size={15} />
            {t("app.routesNotice")}
          </span>
          <span>
            {t("app.footer")}
            <span lang="ja">旅</span>
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
          title={t("flight.deleteTitle")}
          subtitle={`${routeAirports(deleting).map(airportCode).join(" → ")} · ${displayDate(deleting.date)}`}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        >
          <p className="modal-copy">{t("flight.deleteHint")}</p>
          {deleteError && (
            <p className="error" role="alert">
              {t(deleteError)}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={deleteBusy}
              onClick={() => setDeleting(null)}
            >
              {t("flight.keep")}
            </button>
            <button
              className="button danger"
              disabled={deleteBusy}
              onClick={remove}
            >
              {deleteBusy ? t("flight.deleting") : t("flight.deleteButton")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
