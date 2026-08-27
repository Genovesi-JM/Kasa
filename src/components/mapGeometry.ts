import type { LatLngTuple } from "leaflet";

export type ZonePoint = LatLngTuple;

export function isPointInsideZone(point: ZonePoint, zone: ZonePoint[]) {
  if (zone.length < 3) return true;
  const [x, y] = point;
  let inside = false;
  for (
    let index = 0, previous = zone.length - 1;
    index < zone.length;
    previous = index++
  ) {
    const [xi, yi] = zone[index];
    const [xj, yj] = zone[previous];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
