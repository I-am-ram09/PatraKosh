import React from "react";

// A retro desktop "window": coloured title bar + bevelled body.
// tone: "navy" (default) | "plum" | "tomato" | "mustard" | "mint"
export default function Win({ title, tone = "navy", className = "", style, children, bodyClass = "" }) {
  return (
    <section className={`win tone-${tone} ${className}`} style={style}>
      <div className="win-title">
        <span className="win-title-text">{title}</span>
        <span className="win-btns" aria-hidden="true">
          <i>_</i>
          <i>▢</i>
          <i>✕</i>
        </span>
      </div>
      <div className={`win-body ${bodyClass}`}>{children}</div>
    </section>
  );
}
