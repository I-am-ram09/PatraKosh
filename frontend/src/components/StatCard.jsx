import React from "react";

export default function StatCard({ label, value, highlight, tone = "navy" }) {
  return (
    <div className={`stat-card tone-${tone} ${highlight ? "stat-blue" : ""}`}>
      <div className="stat-bar" />
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
