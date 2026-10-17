export function fmtPoint([lon, lat]) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}
