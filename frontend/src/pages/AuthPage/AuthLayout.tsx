import type { ReactNode } from "react";
import trailmapLogo from "../../assets/images/trailmap-logo.png";

export type AuthMode = "login" | "signup";

export function AuthLayout({ children, mode }: { children: ReactNode; mode: AuthMode }) {
  return (
    <main className={`auth-page auth-page--${mode}`}>
      <section className="auth-hero" aria-label="트레일맵 브랜드">
        <div className="auth-hero__content">
          <img className="auth-hero__logo" src={trailmapLogo} alt="트레일맵" />
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel__content">{children}</div>
      </section>
    </main>
  );
}
