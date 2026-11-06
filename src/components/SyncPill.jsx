// A small pill under the status bar while the app is offline or still sending changes. Gone when everything is synced.
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
    <div className={'syncpill' + (text ? ' show' : '') + (tone ? ` ${tone}` : '')} role="status" aria-live="polite">
      {text || ' '}
    </div>
  );
}
