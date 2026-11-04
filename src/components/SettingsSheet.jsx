import { Icon } from './Icons';
import { useState } from 'react';
import Sheet from './Sheet';

export default function SettingsSheet({ onClose, onAppearance, onBackup, onRestore, onTrash, trashCount, isDemo, isGuest, onExitDemo, onSignOut }) {
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
      </div>
      <div className="setgroup">
        <h3>Your data</h3>
        <Row icon={Icon.Download} title="Download backup" sub="Saves everything to a file" onClick={onBackup} />
        <Row icon={Icon.Upload} title="Restore from backup" sub="Adds back anything missing" onClick={onRestore} />
        <Row icon={Icon.Trash} title="Recently deleted" sub={trashCount > 0 ? `${trashCount} item${trashCount === 1 ? '' : 's'} you can bring back` : 'Nothing here'} onClick={onTrash} />
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
