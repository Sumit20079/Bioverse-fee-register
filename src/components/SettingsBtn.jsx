import { createContext, useContext } from 'react';
import { Icon } from './Icons';

export const SettingsContext = createContext(() => {});

export default function SettingsBtn() {
  const open = useContext(SettingsContext);
  return (
    <button className="iconbtn" aria-label="Settings" onClick={open}>
      <Icon.Gear />
    </button>
  );
}
