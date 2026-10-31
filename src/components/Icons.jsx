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
  Check: make(<path d="M5 12l5 5 9-10" />),
  Phone: make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />),
  Chat: make(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />),
  Download: make(<path d="M12 4v10m0 0l-4-4m4 4l4-4M5 20h14" />),
  Printer: make(<path d="M7 9V4h10v5M7 18H5v-7h14v7h-2M7 14h10v6H7z" />),
  Upload: make(<path d="M12 16V6m0 0l-4 4m4-4l4 4M5 20h14" />),
  Pencil: make(<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" />),
  Out: make(<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />),
};
