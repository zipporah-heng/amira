import { NavLink } from "react-router-dom";
import amiraLogo from "../assets/amira-logo.png";

/** Approved header: enlarged AMIRA logo lockup on the left, truthful status
 *  badges in the centre, Share on the right. Thin lower border, white
 *  background, no left sidebar. Matches the approved mockup. */
export function Header() {
  const share = () => navigator.clipboard?.writeText(window.location.href);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/amira/check-evidence" className="hdr-brand" aria-label="AMIRA — Evidence Intelligence Platform">
          <img src={amiraLogo} className="hdr-logo" alt="AMIRA" />
          <span className="hdr-tag">Evidence Intelligence Platform</span>
        </NavLink>

        <div className="hdr-badges" role="note">
          <span className="hdr-badge amber"><span className="dot" /> Source-linked evidence</span>
          <span className="hdr-badge lav"><span className="dot" /> Recorded AI extraction demo</span>
        </div>

        <button className="share-btn hdr-share" onClick={share}>⌁ Share</button>
      </div>
    </header>
  );
}
