// Hand-drawn 24px line icons. One stroke weight everywhere.
const P = {
  workout: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  outdoor: '<path d="M2.8 19.2 9 10.5l3.8 5.3 2.4-3.1 6 6.5z"/><circle cx="16.5" cy="6.2" r="2.3"/>',
  diet: '<path d="M5.2 18.8C5 10.5 10.6 5 19.5 4.5c-.4 9-6 14.5-14.3 14.3z"/><path d="M5.2 18.8 13.5 10.5"/>',
  water: '<path d="M12 3.4c3.6 4.3 6.2 7.7 6.2 10.8a6.2 6.2 0 0 1-12.4 0c0-3.1 2.6-6.5 6.2-10.8z"/><path d="M9.2 14.6a2.9 2.9 0 0 0 2.4 2.6"/>',
  read: '<path d="M3 5.6c3.1-1 6-.7 9 1.3v12.6c-3-2-5.9-2.3-9-1.3zM21 5.6c-3.1-1-6-.7-9 1.3v12.6c3-2 5.9-2.3 9-1.3z"/>',
  photo: '<path d="M4.2 8.3h2.9l1.7-2.6h6.4l1.7 2.6h2.9c.6 0 1.2.5 1.2 1.2v8.3c0 .7-.6 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2V9.5c0-.7.5-1.2 1.2-1.2z"/><circle cx="12" cy="13.3" r="3.4"/>',
  check: '<path d="M7.2 12.4l3.1 3.1 6.6-6.8"/>',
  today: '<circle cx="12" cy="12" r="8.6"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8"/>',
  board: '<path d="M5 20v-8M9.7 20V5M14.3 20v-5.5M19 20V8"/>',
  photos: '<rect x="3.5" y="4.5" width="17" height="15" rx="3.2"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17.2l4.8-4.3 3.8 3.3 2.9-2.4 4.5 3.6"/>',
  settings: '<path d="M4 7.5h9.5M18.5 7.5H20M4 16.5h3M11.5 16.5H20"/><circle cx="16" cy="7.5" r="2.4"/><circle cx="9.3" cy="16.5" r="2.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.6"/><path d="M8.3 10.5V7.8a3.7 3.7 0 0 1 7.4 0v2.7"/>',
  chevR: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  chevL: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  share: '<path d="M12 3.8v11M8 7.6l4-3.8 4 3.8"/><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5"/>',
  plusSq: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
  trash: '<path d="M4.5 6.8h15M9.5 6.8V5.2c0-.6.5-1 1-1h3c.6 0 1 .4 1 1v1.6M6.5 6.8l.9 12a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12"/>',
  bell: '<path d="M6.2 16.8V11a5.8 5.8 0 0 1 11.6 0v5.8l1.4 1.6H4.8z"/><path d="M10 20.2a2.2 2.2 0 0 0 4 0"/>',
  phone: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.8"/><path d="M10.5 18h3"/>',
  album: '<rect x="4" y="7.5" width="16" height="12.5" rx="2.6"/><path d="M6.5 4.8h11"/><path d="M4.5 17l4.3-3.8 3.4 2.9 2.6-2.1 4.7 3.6"/>',
  cloud: '<path d="M7.2 18.5a4.2 4.2 0 0 1-.6-8.4 5.6 5.6 0 0 1 10.9 1.3 3.6 3.6 0 0 1-.4 7.1z"/><rect x="9.6" y="12.8" width="4.8" height="3.8" rx="1"/><path d="M10.6 12.8v-1a1.4 1.4 0 0 1 2.8 0v1"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="4.2"/><path d="M8.3 12.2l2.5 2.5 4.9-5"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.6 3-5.6 3.8-9.3 2 1.2 3.2 3 3.4 5 .9-.5 1.6-1.4 1.9-2.6 1.9 1.6 3.9 4 3.9 6.9 0 3.6-2.6 6.2-6.5 6.2z"/>',
  arrowR: '<path d="M4.5 12h14M13.5 6.5 19 12l-5.5 5.5"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9v.1"/>',
  bolt: '<path d="M13.2 3 5.5 13.5h6l-1 7.5 8-10.8h-6.1z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  calendar: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="3"/><path d="M3.8 9.8h16.4M8.2 3.2v3.6M15.8 3.2v3.6"/>',
  moon: '<path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>',
  rules: '<path d="M6 4.2h12v15.6H6z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
  wifiOff: '<path d="M3.5 3.5l17 17M8.6 13.4a5 5 0 0 1 5.3-.9M5.3 10.2a9.6 9.6 0 0 1 3.4-2M12 7.2a9.6 9.6 0 0 1 6.7 3M11.9 17.3h.1"/>',
};

export function icon(name, cls = "", sw = 1.75) {
  const body = P[name] ?? "";
  const w = name === "check" ? 2.4 : sw;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/** Bottle drawn for the water tracker (fills from the bottom). */
export function bottleSvg(i) {
  const shape = "M9 2.5h8v4.2c0 .9 3 2.4 3 5.4v32.4c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3V12.1c0-3 3-4.5 3-5.4z";
  return `<svg viewBox="0 0 26 50" aria-hidden="true">
    <defs><clipPath id="bc${i}"><path d="${shape}"/></clipPath></defs>
    <g clip-path="url(#bc${i})"><rect class="liquid" x="0" y="9" width="26" height="41"/>
    <rect class="shine" x="8.4" y="14" width="2.2" height="26" rx="1.1"/></g>
    <path class="glass" d="${shape}"/>
  </svg>`;
}
