import { Icon } from './Icons';
import { useState } from 'react';
import Sheet from './Sheet';

export default function SettingsSheet({ onClose, onAppearance, onLock, lockCfg, onAbout, onBackup, onRestore, onTrash, trashCount, isDemo, isGuest, onExitDemo, onSignOut, net, onSyncNow, onReminders }) {
  const [armed, setArmed] = useState(false);
  const Row = ({ icon: Ico, title, sub, onClick, danger }) => (
    <button className={'setrow' + (danger ? ' danger' : '')} onClick={onClick}>
      <Ico />
      <span>
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      <Icon.Right />
    </button>
  );
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="setgroup">
        <h3>General</h3>
        <Row icon={Icon.Palette} title="Appearance" sub="Colours, dark mode, outlines" onClick={onAppearance} />
        {!isDemo && <Row icon={Icon.Chat} title="Telegram reminders" sub="Automatic fee reminders for parents" onClick={onReminders} />}
        <Row icon={Icon.Lock} title="App lock" sub={lockCfg ? 'On · asks for a PIN' : 'Off · ask for a PIN when the app opens'} onClick={onLock} />
      </div>
      <div className="setgroup">
        <h3>Your data</h3>
        {net && (
          <Row
            icon={Icon.Sync}
            title="Sync now"
            sub={
              !net.online
                ? `Offline${net.pending ? ` · ${net.pending} change${net.pending === 1 ? '' : 's'} saved on this device` : ''}`
                : net.pending
                  ? `${net.pending} change${net.pending === 1 ? '' : 's'} waiting to send`
                  : net.syncedAt
                    ? `Up to date · synced ${new Date(net.syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Up to date'
            }
            onClick={onSyncNow}
          />
        )}
        <Row icon={Icon.Download} title="Download backup" sub="Saves everything to a file" onClick={onBackup} />
        <Row icon={Icon.Upload} title="Restore from backup" sub="Adds back anything missing" onClick={onRestore} />
        <Row icon={Icon.Trash} title="Recently deleted" sub={trashCount > 0 ? `${trashCount} item${trashCount === 1 ? '' : 's'} you can bring back` : 'Nothing here'} onClick={onTrash} />
      </div>
      <div className="setgroup">
        <h3>About</h3>
        <Row icon={Icon.Info} title="About Fee Register" sub={`Version ${__APP_VERSION__} · help and tips`} onClick={onAbout} />
      </div>
      {isGuest && (
        <div className="setgroup">
          <h3>Demo</h3>
          <Row
            icon={Icon.Out}
            title={armed ? 'Tap again to erase and exit' : 'Exit demo'}
            sub={armed ? 'Removes everything you added in the demo' : 'Go back to the sign-in page'}
            onClick={() => (armed ? onExitDemo() : setArmed(true))}
            danger
          />
        </div>
      )}
      {!isDemo && (
        <div className="setgroup">
          <h3>Account</h3>
          <Row icon={Icon.Out} title="Sign out" onClick={onSignOut} danger />
        </div>
      )}
    </Sheet>
  );
}
