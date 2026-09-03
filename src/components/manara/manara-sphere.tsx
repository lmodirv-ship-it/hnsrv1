import { useMemo } from "react";

type Node = { id: string; name: string; status?: string | null };

// كرة منارة المضيئة + مدارات المواقع حول المركز.
export function ManaraSphere({ nodes = [] }: { nodes?: Node[] }) {
  const rings = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);
  const rays = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const sparks = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);
  const orbit = nodes.slice(0, 10);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px] select-none">
      <style>{`
        @keyframes manara-spin { to { transform: rotate(360deg) } }
        @keyframes manara-pulse { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:1; transform:scale(1.12) } }
        @keyframes manara-hue { to { filter: hue-rotate(360deg) saturate(1.4) } }
        @keyframes manara-spark { 0% { opacity:0; transform:translate(0,0) scale(.4) } 40% { opacity:1 } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(1) } }
        @media (prefers-reduced-motion: reduce) {
          .manara-anim { animation: none !important }
        }
      `}</style>

      {/* هالة */}
      <div
        className="manara-anim absolute inset-0 rounded-full bg-primary/20 blur-3xl"
        style={{ animation: "manara-pulse 5s ease-in-out infinite" }}
      />

      <div
        className="manara-anim absolute inset-0"
        style={{ animation: "manara-hue 18s linear infinite" }}
      >
        {/* أشعة */}
        {rays.map((i) => (
          <div
            key={i}
            className="manara-anim absolute left-1/2 top-1/2 h-[46%] w-[3px] origin-bottom rounded-full bg-primary/50 blur-[2px]"
            style={{
              transform: `translate(-50%,-100%) rotate(${(360 / rays.length) * i}deg)`,
              transformOrigin: "50% 100%",
              animation: "manara-pulse 4s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}

        {/* الكرة */}
        <div className="absolute inset-[22%] rounded-full border border-primary/60 shadow-[0_0_80px_hsl(var(--primary)/0.6),0_0_180px_hsl(var(--primary)/0.35)]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,hsl(var(--primary)/0.9),transparent_65%)]" />
          <div
            className="manara-anim absolute inset-[38%] rounded-full bg-foreground/90 blur-md"
            style={{ animation: "manara-pulse 3.4s ease-in-out infinite" }}
          />
          <div
            className="manara-anim absolute inset-0"
            style={{ animation: "manara-spin 22s linear infinite" }}
          >
            {rings.map((i) => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
                style={{ transform: `rotateY(${(180 / rings.length) * i}deg) scaleX(${Math.abs(Math.cos((Math.PI / rings.length) * i))})` }}
              />
            ))}
          </div>
        </div>

        {/* شرارات */}
        {sparks.map((i) => {
          const a = (Math.PI * 2 * i) / sparks.length;
          return (
            <div
              key={i}
              className="manara-anim absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
              style={
                {
                  "--dx": `${Math.cos(a) * 210}px`,
                  "--dy": `${Math.sin(a) * 210}px`,
                  animation: `manara-spark ${4 + (i % 5)}s ease-out infinite`,
                  animationDelay: `${i * 0.22}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* عقد المواقع في مدار */}
      <div
        className="manara-anim absolute inset-0"
        style={{ animation: "manara-spin 40s linear infinite" }}
      >
        {orbit.map((n, i) => {
          const a = (Math.PI * 2 * i) / Math.max(orbit.length, 1);
          const ok = (n.status ?? "active") === "active";
          return (
            <div
              key={n.id}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${Math.cos(a) * 46}%), calc(-50% + ${Math.sin(a) * 46}%))` }}
              title={n.name}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_14px_theme(colors.emerald.400)]" : "bg-amber-400 shadow-[0_0_14px_theme(colors.amber.400)]"}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
