import { useEffect, useState } from "react";
import type { LatLngTuple } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Check, MapPinned, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { appConfig } from "../platform/config";
import type { ZonePoint } from "./mapGeometry";

export interface KasaMapItem {
  id: number | string;
  position: LatLngTuple;
  title: string;
  subtitle: string;
  price: string;
  image?: string;
}

interface KasaMapLabels {
  draw: string;
  finish: string;
  undo: string;
  clear: string;
  hint: string;
  points: string;
  results: string;
  view: string;
}

export interface KasaMapProps {
  items: KasaMapItem[];
  zone: ZonePoint[];
  onZoneChange: (zone: ZonePoint[]) => void;
  onOpen: (id: KasaMapItem["id"]) => void;
  labels: KasaMapLabels;
  className?: string;
}

function DrawingEvents({
  active,
  onAddPoint,
}: {
  active: boolean;
  onAddPoint: (point: ZonePoint) => void;
}) {
  const map = useMapEvents({
    click(event) {
      if (active) onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle("drawing-zone", active);
    return () => container.classList.remove("drawing-zone");
  }, [active, map]);

  return null;
}

function FitInitialResults({ items }: { items: KasaMapItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length > 1) {
      map.fitBounds(
        items.map((item) => item.position),
        {
          padding: [42, 42],
          maxZoom: 14,
        },
      );
    } else if (items.length === 1) {
      map.setView(items[0].position, 14);
    }
    // Fitting once keeps the map stable while a drawn area filters results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export function KasaMap({
  items,
  zone,
  onZoneChange,
  onOpen,
  labels,
  className = "",
}: KasaMapProps) {
  const [drawing, setDrawing] = useState(false);
  const [draftZone, setDraftZone] = useState<ZonePoint[]>([]);
  const visibleZone = drawing ? draftZone : zone;
  const startDrawing = () => {
    onZoneChange([]);
    setDraftZone([]);
    setDrawing(true);
  };
  const finishDrawing = () => {
    if (draftZone.length >= 3) {
      onZoneChange(draftZone);
      setDrawing(false);
    }
  };

  return (
    <div className={`kasa-map ${className}`}>
      <MapContainer
        center={[41.395, 2.175]}
        zoom={13}
        scrollWheelZoom
        zoomControl
        aria-label="Interactive Kasa map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url={appConfig.mapTileUrl}
        />
        <FitInitialResults items={items} />
        <DrawingEvents
          active={drawing}
          onAddPoint={(point) => setDraftZone((current) => [...current, point])}
        />
        {visibleZone.length === 2 && (
          <Polyline
            positions={visibleZone}
            pathOptions={{ color: "#173f37", weight: 3 }}
          />
        )}
        {visibleZone.length >= 3 && (
          <Polygon
            positions={visibleZone}
            pathOptions={{
              color: "#173f37",
              fillColor: "#e7b94f",
              fillOpacity: 0.22,
              weight: 3,
            }}
          />
        )}
        {visibleZone.map((point, index) => (
          <CircleMarker
            key={`${point[0]}-${point[1]}-${index}`}
            center={point}
            radius={5}
            pathOptions={{
              color: "#fff",
              fillColor: "#173f37",
              fillOpacity: 1,
              weight: 2,
            }}
            interactive={false}
          />
        ))}
        {items.map((item) => (
          <CircleMarker
            key={item.id}
            center={item.position}
            radius={11}
            bubblingMouseEvents={false}
            pathOptions={{
              color: "#fff",
              fillColor: "#173f37",
              fillOpacity: 1,
              weight: 3,
            }}
            eventHandlers={{ click: () => onOpen(item.id) }}
          >
            <Tooltip
              permanent
              direction="top"
              offset={[0, -9]}
              className="kasa-price-pin"
            >
              {item.price}
            </Tooltip>
            <Popup className="kasa-map-popup">
              <article>
                {item.image && <img src={item.image} alt="" />}
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                  <button onClick={() => onOpen(item.id)}>{labels.view}</button>
                </div>
              </article>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="map-draw-controls" aria-live="polite">
        {!drawing ? (
          <button className="map-draw-primary" onClick={startDrawing}>
            <MapPinned size={17} /> {labels.draw}
          </button>
        ) : (
          <button
            className="map-draw-primary active"
            onClick={finishDrawing}
            disabled={draftZone.length < 3}
          >
            <Check size={17} /> {labels.finish}
          </button>
        )}
        {(drawing || zone.length > 0) && (
          <>
            {drawing && (
              <button
                title={labels.undo}
                aria-label={labels.undo}
                onClick={() => setDraftZone((current) => current.slice(0, -1))}
                disabled={draftZone.length === 0}
              >
                <Undo2 size={16} />
              </button>
            )}
            <button
              title={labels.clear}
              aria-label={labels.clear}
              onClick={() => {
                onZoneChange([]);
                setDraftZone([]);
                setDrawing(false);
              }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      {drawing && (
        <div className="map-draw-hint">
          <RotateCcw size={15} />
          <span>{labels.hint}</span>
          <strong>
            {draftZone.length} {labels.points}
          </strong>
        </div>
      )}
      {zone.length >= 3 && !drawing && (
        <div className="map-zone-result">
          <Check size={14} /> {items.length} {labels.results}
        </div>
      )}
    </div>
  );
}
