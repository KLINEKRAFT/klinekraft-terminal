import { Navigation, LocateFixed } from "lucide-react";
import { useGps, courseLabel } from "../hooks/useGps";
import { Info } from "./Info";
export function GpsStatus({
  openMap,
}: {
  openMap: (latitude: number, longitude: number) => void;
}) {
  const { fix, current, age } = useGps();
  const course = current ? fix?.courseDegrees : null;
  const hasCourse = typeof course === "number" && Number.isFinite(course);
  return (
    <div className="gps-home" aria-label="GPS status">
      <button
        className="gps-home-position"
        disabled={!current}
        onClick={() => current && openMap(fix!.latitude!, fix!.longitude!)}
      >
        <LocateFixed size={17} />
        <span>
          <small>
            GPS ·{" "}
            {current
              ? `${fix?.mode === 3 ? "3D" : "2D"} fix`
              : fix?.connected
                ? "searching"
                : fix
                  ? "disconnected"
                  : "checking"}
          </small>
        </span>
      </button>
      <div
        className="gps-course"
        aria-label={
          hasCourse
            ? `Travel direction ${courseLabel(course!)} ${Math.round(course!)} degrees true`
            : "Travel direction unavailable"
        }
      >
        <span className="gps-compass" aria-hidden="true">
          <small>N</small>
          {hasCourse ? (
            <Navigation
              size={18}
              style={{ transform: `rotate(${course! - 45}deg)` }}
            />
          ) : (
            <span>—</span>
          )}
        </span>
        <span>
          <small>TRAVEL</small>
          <strong>
            {hasCourse
              ? `${courseLabel(course!)} ${Math.round(course!)}°`
              : "—"}
          </strong>
        </span>
      </div>
      <Info label="GPS and compass information">
        <p className="gps-details">
          {" "}
          <strong>
            {current
              ? `${fix!.latitude!.toFixed(4)}, ${fix!.longitude!.toFixed(4)}`
              : "No current position"}
          </strong>
          <em>
            {fix?.satellitesUsed != null
              ? `${fix.satellitesUsed}/${fix.satellitesVisible ?? "—"} satellites`
              : "Satellites —"}
            {age !== null
              ? ` · ${current ? "Fix" : "Last fix"} ${age}s ago`
              : ""}
          </em>
        </p>
        <p>
          Direction of travel relative to true north, not the way the deck
          faces. Hidden when stationary, slow, uncertain or without a fresh fix.
          A stationary compass needs a separate heading sensor.
        </p>
        <p>
          {fix && !fix.connected && !current
            ? "GPS receiver temporarily disconnected. Reconnect it and position returns on its own."
            : fix?.message || "Checking receiver…"}
          {current && fix?.accuracyFeet != null
            ? ` · Estimated accuracy ${Math.round(fix.accuracyFeet)} ft.`
            : ""}{" "}
          Trip history is recorded only when you choose Record trip in Maps.
        </p>
      </Info>
    </div>
  );
}
