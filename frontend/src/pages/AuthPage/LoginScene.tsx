import { useId } from "react";
import mountains from "../../assets/images/login/mountains.svg?no-inline";
import summitGlow from "../../assets/images/login/summit-glow.svg?no-inline";
import summitPin from "../../assets/images/login/summit-pin.svg?no-inline";
import backLeg from "../../assets/images/login/hiker-back-leg.svg?no-inline";
import frontLeg from "../../assets/images/login/hiker-front-leg.svg?no-inline";
import body from "../../assets/images/login/hiker-body.svg?no-inline";
import arm from "../../assets/images/login/hiker-arm.svg?no-inline";
import "./LoginScene.css";

export function LoginScene() {
  const glowFilterId = useId();

  return (
    <div className="auth-login__scene">
      <p className="auth-login__wordmark">정상<span>회담</span></p>
      <div className="auth-login__art" aria-hidden="true">
        <img className="auth-login__mountains" src={mountains} alt="" width={390} height={844} />
        {/* The SVG includes the final frame's 22% opacity. Restore its alpha for the Figma opacity track. */}
        <svg className="auth-login__filters" width="0" height="0">
          <defs>
            <filter id={glowFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncA type="linear" slope={1 / 0.22} />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
        <div className="auth-login__glow">
          <img src={summitGlow} alt="" width={56} height={56} style={{ filter: `url("#${glowFilterId}")` }} />
        </div>
        <img className="auth-login__pin" src={summitPin} alt="" width={32} height={40} />
        <div className="auth-login__hiker">
          <img className="auth-login__back-leg" src={backLeg} alt="" width={32} height={32} />
          <img className="auth-login__front-leg" src={frontLeg} alt="" width={32} height={32} />
          <img className="auth-login__hiker-body" src={body} alt="" width={35} height={39} />
          <img className="auth-login__hiker-arm" src={arm} alt="" width={34} height={46} />
        </div>
      </div>
    </div>
  );
}
