import type { HTMLAttributes } from "react";
import "../common/controls.css";
import "./content.css";

export type ReviewQuoteProps = HTMLAttributes<HTMLQuoteElement> & {
  meta: string;
  quote: string;
};

export function ReviewQuote({ meta, quote, className, ...rest }: ReviewQuoteProps) {
  return <blockquote {...rest} className={["af-review-quote", className].filter(Boolean).join(" ")}>
    <span className="af-review-quote__meta">{meta}</span>
    <p className="af-review-quote__text">{quote}</p>
  </blockquote>;
}
