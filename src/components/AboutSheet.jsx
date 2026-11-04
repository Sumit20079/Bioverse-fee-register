import Sheet from './Sheet';

const TIPS = [
  ['Put it on your home screen', 'Open the app in Chrome, tap the ⋮ menu, then "Add to Home screen" (or "Install app"). It opens like a normal app after that.'],
  ['Marking fees', 'Tap Mark paid next to a student. For part payments, enter the amount that was given and the balance stays on the Due list until it is settled.'],
  ['Deleted something by mistake?', 'Deleted students and batches wait in Recently deleted (Settings) until you empty it, and you can bring them back from there.'],
  ['Backups', 'Download a backup now and then. Restoring from a backup only adds back what is missing, it never overwrites anything you have today.'],
  ['Looks are per device', 'Colours and dark mode are saved on each device separately, so every phone or laptop can look different.'],
  ['Not seeing the latest update?', 'Close the app and open it once or twice. The version number above tells you which copy you are on.'],
];

export default function AboutSheet({ onClose }) {
  return (
    <Sheet title="About" onClose={onClose}>
      <div className="aboutcard">
        <img src="/icon.svg" alt="" width="56" height="56" />
        <div>
          <b>Fee Register</b>
          <small>Version {__APP_VERSION__} · updated {__BUILD_DATE__}</small>
        </div>
      </div>

      <div className="setgroup">
        <h3>Help &amp; tips</h3>
        <div className="tips">
          {TIPS.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>

      <p className="credit">Made by @spidermanbonaparte and Claude</p>
    </Sheet>
  );
}
