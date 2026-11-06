// A small pill above the header while the app is offline or still sending changes. It slides in and pushes the page
// down (so it never covers the buttons) and is gone when everything is synced.
export default function SyncPill({ net }) {
  if (!net) return null;
  let text = '';
  let tone = '';
  if (!net.online) {
    text = net.pending ? `Offline · ${net.pending} waiting to sync` : 'Offline';
    tone = 'off';
  } else if (net.pending || net.syncing) {
    text = net.pending ? `Syncing ${net.pending}…` : 'Syncing…';
  }
  return (
    <div className={'syncwrap' + (text ? ' show' : '')} role="status" aria-live="polite">
      <div>
        <span className={'syncpill' + (tone ? ` ${tone}` : '')}>{text || ' '}</span>
      </div>
    </div>
  );
}
