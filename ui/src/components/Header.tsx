import { NavLink } from "react-router-dom";
import amiraLogo from "../assets/amira-logo.png";

/** Header: the prominent AMIRA logo lockup on the left and Share on the right.
 *  No technical status badges compete with the clinical question — source and
 *  extraction status live inside "How AMIRA's AI found this evidence" and the
 *  evidence trace. White background, thin lower border, no left sidebar. */
export function Header() {
  const share = () => navigator.clipboard?.writeText(window.location.href);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/amira/check-evidence" className="hdr-brand" aria-label="AMIRA — Evidence Intelligence Platform">
          <img src={amiraLogo} className="hdr-logo" alt="AMIRA" />
          <span className="hdr-tag">Evidence Intelligence Platform</span>
        </NavLink>

        <button className="share-btn hdr-share" onClick={share}>⌁ Share</button>
      </div>
    </header>
  );
}
