import type { CSSProperties, HTMLAttributes } from "react";
import "./icons.css";

type LayerStyle = Pick<
  CSSProperties,
  "inset" | "top" | "right" | "bottom" | "left"
>;

type IconDefinition = {
  asset: string;
  defaultColor: string;
  layers: readonly LayerStyle[];
};

const green = "#19765B";

const iconDefinitions = {
  BellOff: {
    asset: new URL("../../../assets/icons/bell-off.svg", import.meta.url).href,
    defaultColor: "#ABC4A9",
    layers: [],
  },
  Bell: {
    asset: new URL("../../../assets/icons/bell.svg", import.meta.url).href,
    defaultColor: green,
    layers: [],
  },
  CalendarPlus: {
    asset: new URL("../../../assets/icons/calendar-plus.svg", import.meta.url).href,
    defaultColor: green,
    layers: [{ inset: "12.5%" }, { inset: "-4.86%" }],
  },
  Sun: {
    asset: new URL("../../../assets/icons/sun.svg", import.meta.url).href,
    defaultColor: "#D9A026",
    layers: [
      { inset: "6.25% 0 -6.25% 0" },
      { top: "12.5%", right: "12.5%", bottom: "25%", left: "12.5%" },
      { inset: "-5.83% -4.86%" },
    ],
  },
  Clock: {
    asset: new URL("../../../assets/icons/clock.svg", import.meta.url).href,
    defaultColor: green,
    layers: [{ inset: "12.5%" }, { inset: "-4.86%" }],
  },
  Calendar: {
    asset: new URL("../../../assets/icons/calendar.svg", import.meta.url).href,
    defaultColor: green,
    layers: [{ inset: "12.5%" }, { inset: "-4.86%" }],
  },
  Restroom: {
    asset: new URL("../../../assets/icons/restroom.svg", import.meta.url).href,
    defaultColor: "#7755AD",
    layers: [],
  },
  Water: {
    asset: new URL("../../../assets/icons/water.svg", import.meta.url).href,
    defaultColor: "#1876AB",
    layers: [
      { inset: "5% 5.02% 5% 4.98%" },
      { inset: "8.33% 20.81% 8.33% 20.86%" },
      { inset: "-4.86% -6.96% -4.86% -6.93%" },
    ],
  },
  Shelter: {
    asset: new URL("../../../assets/icons/shelter.svg", import.meta.url).href,
    defaultColor: "#B06428",
    layers: [
      { inset: "5% 5.02% 5% 4.98%" },
      { inset: "16.67% 8.31% 16.67% 8.36%" },
      { inset: "-6.08% -4.87% -6.08% -4.86%" },
    ],
  },
  Photo: {
    asset: new URL("../../../assets/icons/photo.svg", import.meta.url).href,
    defaultColor: "#B34D6A",
    layers: [
      { inset: "16.67% 12.5%" },
      { inset: "-5.47% -4.86%" },
    ],
  },
  "3D": {
    asset: new URL("../../../assets/icons/3d.svg", import.meta.url).href,
    defaultColor: green,
    layers: [],
  },
  Mountain: {
    asset: new URL("../../../assets/icons/mountain.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "1.25% 5% 8.75% 5%" },
      { top: "25%", right: "8.33%", bottom: "16.67%", left: "8.34%" },
      { inset: "-6.94% -4.86% -6.95% -4.86%" },
    ],
  },
  Peak: {
    asset: new URL("../../../assets/icons/peak.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "5%" },
      { top: "25%", right: "8.33%", bottom: "25%", left: "8.34%" },
      { inset: "-8.1% -4.87% -8.1% -4.86%" },
    ],
  },
  Pin: {
    asset: new URL("../../../assets/icons/pin.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "0.96% 0.55% 0.14% 0.55%" },
      { inset: "11.67% 20.83% 12.5% 20.84%" },
      { inset: "-4.86% -6.33% -4.86% -6.31%" },
    ],
  },
  Locate: {
    asset: new URL("../../../assets/icons/locate.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "9.09% 9.08% 9.09% 9.1%" },
      { inset: "4.17% 4.17% 4.17% 4.16%" },
      { inset: "-4.86%" },
    ],
  },
  Check: {
    asset: new URL("../../../assets/icons/check.svg", import.meta.url).href,
    defaultColor: green,
    layers: [{ inset: "-8.33% -9.09% -6.8% -6.04%" }],
  },
  Bag: {
    asset: new URL("../../../assets/icons/bag.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "4.6% 2.63% 0.66% 2.63%" },
      { inset: "8.33% 16.67% 12.5% 16.66%" },
      { inset: "-4.86% -5.77% -4.86% -5.78%" },
    ],
  },
  Filter: {
    asset: new URL("../../../assets/icons/filter.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "0 -0.03% 0 0.03%" },
      { inset: "29.17% 16.69% 29.17% 16.64%" },
      { inset: "-8.75% -5.48% -8.75% -5.46%" },
    ],
  },
  More: {
    asset: new URL("../../../assets/icons/more.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-7.1% -7.08% -7.1% -7.13%" },
      { top: "50%", right: "20.79%", bottom: "50%", left: "20.84%" },
      { inset: "-1.71px -10.71% -1.71px -10.7%" },
    ],
  },
  Close: {
    asset: new URL("../../../assets/icons/close.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-4.17%" },
      { inset: "25%" },
      { inset: "-6.73%" },
    ],
  },
  Plus: {
    asset: new URL("../../../assets/icons/plus.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-3.57% -3.56% -3.57% -3.58%" },
      { inset: "20.83% 20.83% 20.83% 20.84%" },
      { inset: "-5.83% -5.83% -5.83% -5.84%" },
    ],
  },
  Search: {
    asset: new URL("../../../assets/icons/search.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-3.54% -0.52% -0.5% -3.52%" },
      { inset: "15.42% 12.53% 12.5% 15.41%" },
      { inset: "-4.86%" },
    ],
  },
  ArrowRight: {
    asset: new URL("../../../assets/icons/arrow-right.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { top: "25%", right: "16.67%", bottom: "25%", left: "16.66%" },
      { inset: "-7.29% -5.46% -7.29% -5.48%" },
    ],
  },
  ChevronDown: {
    asset: new URL("../../../assets/icons/chevron-down.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-8.33%" },
      { top: "37.5%", right: "25%", bottom: "37.5%", left: "25%" },
      { inset: "-12.5% -6.25%" },
    ],
  },
  ChevronRight: {
    asset: new URL("../../../assets/icons/chevron-right.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "6.25%" },
      { inset: "16.67% 33.33% 16.67% 33.34%" },
      { inset: "-6.25% -12.52% -6.25% -12.48%" },
    ],
  },
  Back: {
    asset: new URL("../../../assets/icons/back.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "11.11% 6.26% 11.11% 15.97%" },
      { top: "12.5%", right: "37.5%", bottom: "12.5%", left: "25%" },
      { inset: "-6.25% -12.48% -6.25% -12.52%" },
    ],
  },
  Community: {
    asset: new URL("../../../assets/icons/community.svg", import.meta.url).href,
    defaultColor: green,
    layers: [
      { inset: "-2.08% 0 2.08% 0" },
      { inset: "16.67% 12.5% 12.5% 12.5%" },
      { inset: "-5.15% -4.86%" },
    ],
  },
  Home: {
    asset: new URL("../../../assets/icons/home.svg", import.meta.url).href,
    defaultColor: green,
    layers: [{ inset: "12.5%" }, { inset: "-4.86%" }],
  },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof iconDefinitions;

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: IconName;
  size?: number | string;
  color?: string;
  title?: string;
};

function toCssSize(size: number | string) {
  return typeof size === "number" ? `${size}px` : size;
}

export function Icon({
  "aria-label": ariaLabel,
  className,
  color,
  name,
  size = 24,
  style,
  title,
  ...rest
}: IconProps) {
  const definition = iconDefinitions[name];
  const layers = definition.layers;
  const deepestLayer = layers.length > 0 ? layers[layers.length - 1] : { inset: 0 };
  const maskUrl = `url("${definition.asset}")`;

  let content = (
    <span
      className="af-icon__glyph"
      style={{
        ...deepestLayer,
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
      }}
    />
  );

  for (let index = layers.length - 2; index >= 0; index -= 1) {
    content = (
      <span className="af-icon__layer" style={layers[index]}>
        {content}
      </span>
    );
  }

  const accessibleName = ariaLabel ?? title;
  const cssSize = toCssSize(size);

  return (
    <span
      {...rest}
      aria-hidden={accessibleName ? undefined : true}
      aria-label={accessibleName}
      className={["af-icon", className].filter(Boolean).join(" ")}
      data-icon-name={name}
      role={accessibleName ? "img" : undefined}
      style={{
        color: color ?? definition.defaultColor,
        height: cssSize,
        width: cssSize,
        ...style,
      }}
    >
      {content}
    </span>
  );
}

export type NamedIconProps = Omit<IconProps, "name">;
