export interface GeoFix { lat: number; lng: number; accuracy: number; speed: number | null; heading: number | null; t: number }

export function watchPosition(onFix: (f: GeoFix) => void, onError?: (e: GeolocationPositionError) => void): () => void {
  if (!("geolocation" in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed, heading: p.coords.heading, t: Date.now() }),
    onError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
  return () => navigator.geolocation.clearWatch(id);
}

export function requestLocationOnce(): Promise<boolean> {
  return new Promise((res) => {
    if (!("geolocation" in navigator)) return res(false);
    navigator.geolocation.getCurrentPosition(() => res(true), () => res(false), { timeout: 10000 });
  });
}
