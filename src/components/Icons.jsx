const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const make = (d) => (props) => (
  <svg {...base} {...props}>
    {d}
  </svg>
);

export const Icon = {
  Left: make(<path d="M15 6l-6 6 6 6" />),
  Right: make(<path d="M9 6l6 6-6 6" />),
  Home: make(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),
  List: make(<path d="M4 6h16M4 12h16M4 18h10" />),
  Clock: make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  Plus: make(<path d="M12 5v14M5 12h14" />),
  Check: make(<path d="M5 12l5 5 9-10" pathLength="1" />),
  Phone: make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />),
  Chat: make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />),
  Download: make(<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 20h14" />),
  Trash: make(<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />),
  Rupee: make(<path d="M7 5h10M7 9h10M9 5c5 0 6 5 0 5l5 8" />),
  Printer: make(<path d="M7 9V4h10v5M7 18H5v-7h14v7h-2M7 14h10v6H7z" />),
  Upload: make(<path d="M12 16V6m0 0l-4 4m4-4l4 4M5 20h14" />),
  Pencil: make(<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />),
  Search: make(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  Palette: make(<><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" /></>),
  Phone: make(<><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>),
  Sun: make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>),
  Moon: make(<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />),
  Sparkle: make(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />),
  Contrast: make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" /></>),
  Pipette: make(<path d="M14 6l4 4M4 20l1-4 9-9 3 3-9 9-4 1zM15 5l1.5-1.5a2 2 0 0 1 3 3L18 8" />),
  Out: make(<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />),
};
