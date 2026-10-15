import type { CSSProperties } from "react";

export const typographyTokens = {
  headingPage: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  headingSection: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  headingScreen: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  headingCard: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  bodyLarge: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "16px",
    lineHeight: "24px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
  },
  bodyMedium: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "14px",
    lineHeight: "22px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
  },
  bodySmall: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "12px",
    lineHeight: "18px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
  },
  descriptionSmall: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "11px",
    lineHeight: "16px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
  },
  buttonLabel: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  controlLabel: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "12px",
    lineHeight: "18px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
  },
  navigationLabel: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "12px",
    lineHeight: "16px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
  },
  badgeLabel: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "10px",
    lineHeight: "14px",
    fontWeight: 700,
    letterSpacing: "0",
  },
  metric: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "18px",
    lineHeight: "26px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  dataAuxiliary: {
    fontFamily: '"Noto Sans KR", sans-serif',
    fontSize: "10px",
    lineHeight: "14px",
    fontWeight: 400,
    letterSpacing: "0",
  },
} as const satisfies Record<string, CSSProperties>;

export type TypographyVariant = keyof typeof typographyTokens;
