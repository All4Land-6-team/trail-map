import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  ReactNode,
} from "react";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/500.css";
import "@fontsource/noto-sans-kr/700.css";
import { typographyTokens, type TypographyVariant } from "./tokens";
import "./typography.css";

type TypographyOwnProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  variant: TypographyVariant;
  className?: string;
  style?: CSSProperties;
};

export type TypographyProps<T extends ElementType = "span"> =
  TypographyOwnProps<T> &
    Omit<ComponentPropsWithoutRef<T>, keyof TypographyOwnProps<T>>;

export function Typography<T extends ElementType = "span">({
  as,
  children,
  className,
  style,
  variant,
  ...rest
}: TypographyProps<T>) {
  const Component = as ?? "span";

  return (
    <Component
      {...rest}
      className={["af-typography", className].filter(Boolean).join(" ")}
      data-typography-variant={variant}
      style={{ ...typographyTokens[variant], ...style }}
    >
      {children}
    </Component>
  );
}
