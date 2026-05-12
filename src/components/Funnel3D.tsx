import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Float } from "@react-three/drei";
import { useMemo } from "react";

export type FunnelStage = { key: string; label: string; value: number };

const COLORS = ["#3b82f6", "#6366f1", "#10b981", "#f59e0b"];

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

function Segment({
  yTop, height, rTop, rBottom, color, label, value, conv,
}: {
  yTop: number; height: number; rTop: number; rBottom: number; color: string;
  label: string; value: number; conv?: number;
}) {
  const yCenter = yTop - height / 2;
  return (
    <group>
      <mesh position={[0, yCenter, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rBottom, height, 64, 1, false]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.35}
          roughness={0.25}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* edge ring highlight */}
      <mesh position={[0, yTop, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[rTop, 0.025, 16, 64]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      {/* Label inside */}
      <Html position={[0, yCenter, rTop + 0.02]} center distanceFactor={6} transform occlude={false}>
        <div className="pointer-events-none select-none text-center" style={{ width: 220 }}>
          <div className="text-white drop-shadow font-bold" style={{ fontSize: 28 }}>{fmtInt(value)}</div>
          <div className="text-white/95 drop-shadow" style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        </div>
      </Html>
      {/* Conversion chip floating to the right */}
      {conv !== undefined && (
        <Html position={[rTop + 0.6, yTop, 0]} distanceFactor={6}>
          <div className="pointer-events-none select-none rounded-full border bg-background/90 backdrop-blur px-3 py-1 text-xs font-semibold shadow whitespace-nowrap"
               style={{ borderColor: color, color }}>
            {fmtPct(conv)}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Funnel3D({ stages, overall }: { stages: FunnelStage[]; overall: number }) {
  const data = useMemo(() => {
    const max = Math.max(...stages.map(s => s.value), 1);
    const minR = 0.35, maxR = 2.2;
    const radii = stages.map(s => Math.max(minR, (s.value / max) * maxR));
    // tail radius (after last stage) for nice taper
    const tail = Math.max(0.15, radii[radii.length - 1] * 0.55);
    const segH = 1.1;
    const totalH = segH * stages.length;
    const yStart = totalH / 2; // top
    return stages.map((s, i) => ({
      stage: s,
      color: COLORS[i % COLORS.length],
      yTop: yStart - i * segH,
      height: segH,
      rTop: radii[i],
      rBottom: i + 1 < radii.length ? radii[i + 1] : tail,
      conv: i > 0 ? pct(s.value, stages[i - 1].value) : undefined,
    }));
  }, [stages]);

  return (
    <div className="relative w-full" style={{ height: 420 }}>
      <Canvas shadows camera={{ position: [4.5, 1.5, 6], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b1020"]} />
        <fog attach="fog" args={["#0b1020", 8, 18]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#8ab4ff" />
        <pointLight position={[0, -3, 3]} intensity={0.6} color="#a78bfa" />

        <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.25}>
          <group>
            {data.map(d => (
              <Segment
                key={d.stage.key}
                yTop={d.yTop}
                height={d.height}
                rTop={d.rTop}
                rBottom={d.rBottom}
                color={d.color}
                label={d.stage.label}
                value={d.stage.value}
                conv={d.conv}
              />
            ))}
          </group>
        </Float>

        {/* ground reflection plate */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]} receiveShadow>
          <circleGeometry args={[5, 64]} />
          <meshStandardMaterial color="#0b1020" metalness={0.6} roughness={0.4} />
        </mesh>

        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 backdrop-blur px-4 py-1.5 text-sm shadow">
        <span className="text-muted-foreground">Conversión global Visit → CPA</span>
        <span className="font-bold text-primary">{fmtPct(overall)}</span>
      </div>
    </div>
  );
}
