import { useEffect, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY } from "d3-force";

const WIDTH = 640;
const HEIGHT = 420;
const MARGIN = 30;

const LABEL_COLORS = {
  Member: "#c96a5f",
  Provider: "#ab9038",
  Address: "#6f9b73",
  BankAccount: "#6f9b73",
  Phone: "#6f9b73",
  Policy: "#8f8a72",
  Claim: "#d4b24a",
};

const LABEL_RADIUS = {
  Member: 9,
  Provider: 11,
};

function colorFor(labels) {
  const label = labels?.[0];
  return LABEL_COLORS[label] || "#a99b74";
}

function radiusFor(labels, isCenter) {
  if (isCenter) return 13;
  const label = labels?.[0];
  return LABEL_RADIUS[label] || 6;
}

/**
 * Renders a NetworkGraph ({ nodes, edges }) as a static force-directed layout.
 * The simulation is ticked synchronously (no animation) so this stays a pure,
 * predictable render -- appropriate for a small bounded neighborhood (<=300 edges).
 */
export default function GraphView({ graph, centerId }) {
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      setLayout(null);
      return;
    }

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const simNodes = graph.nodes.map((n) => ({ ...n }));
    const simLinks = graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ ...e }));

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-160))
      .force(
        "link",
        forceLink(simLinks)
          .id((d) => d.id)
          .distance(68)
          .strength(0.55)
      )
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide((d) => radiusFor(d.labels, d.id === centerId) + 14))
      .force("x", forceX(WIDTH / 2).strength(0.03))
      .force("y", forceY(HEIGHT / 2).strength(0.03))
      .stop();

    for (let i = 0; i < 250; i += 1) simulation.tick();

    const clamp = (v, max) => Math.max(MARGIN, Math.min(max - MARGIN, v));
    simNodes.forEach((n) => {
      n.x = clamp(n.x ?? WIDTH / 2, WIDTH);
      n.y = clamp(n.y ?? HEIGHT / 2, HEIGHT);
    });

    setLayout({ nodes: simNodes, links: simLinks });
  }, [graph, centerId]);

  if (!graph || graph.nodes.length === 0) {
    return <div className="empty-state">No network data to show.</div>;
  }

  if (!layout) {
    return <div className="loading-state">Laying out the graph…</div>;
  }

  const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
  const presentLabels = [...new Set(layout.nodes.flatMap((n) => n.labels))];

  return (
    <div>
      <div className="graph-wrap">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label="Entity network graph">
          <g strokeOpacity="0.55">
            {layout.links.map((link) => {
              const a = byId[link.source?.id ?? link.source];
              const b = byId[link.target?.id ?? link.target];
              if (!a || !b) return null;
              return (
                <line
                  key={link.id}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#5c7a5f"
                  strokeWidth={1}
                />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((node) => {
              const isCenter = node.id === centerId;
              const r = radiusFor(node.labels, isCenter);
              return (
                <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                  <circle
                    r={r}
                    fill={colorFor(node.labels)}
                    stroke={isCenter ? "#ede6d3" : "#1c2a20"}
                    strokeWidth={isCenter ? 2.5 : 1}
                  />
                  <text
                    x={r + 5}
                    y={4}
                    fontSize="9"
                    fontFamily="IBM Plex Mono, monospace"
                    fill="#ede6d3"
                  >
                    {truncate(node.caption, 18)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="graph-legend">
        {presentLabels.map((label) => (
          <span key={label}>
            <span className="legend-dot" style={{ background: LABEL_COLORS[label] || "#a99b74" }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
