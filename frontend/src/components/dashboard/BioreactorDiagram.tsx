import { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BioreactorState, BioreactorConfig } from '../../types/simulation';
import { DATA_STATE_BADGES } from '../../types/ai';
import {
  Activity,
  Cpu,
  Filter,
  RefreshCw,
  Layers,
  Settings,
  AlertTriangle
} from 'lucide-react';
import { NOMINAL_FEED_GLUCOSE } from '../../config/constants';

interface BioreactorDiagramProps {
  state: BioreactorState;
  focus?: string;
  config?: BioreactorConfig | null;
  isRunning?: boolean;
}

export default function BioreactorDiagram({ state, focus = 'flow', config, isRunning = false }: BioreactorDiagramProps) {
  const isSimulationRunning = isRunning;
  // Support accessibility standard for reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const isHighDensity = state.viable_cell_density >= 1e7;
  const cellDensityFormatted = isHighDensity
    ? (state.viable_cell_density / 1e7).toFixed(2)
    : (state.viable_cell_density / 1e6).toFixed(2);
  const cellDensityExponent = isHighDensity ? '10⁷' : '10⁶';

  const flowRateLh = ((state.perfusion_rate / 24.0) * state.reactor_volume).toFixed(3);
  const permeabilityPercent = Math.max(0, 100 - state.fouling_index).toFixed(1);

  // Dynamic flow rate speed scaling based on perfusion (VVD)
  const speedFactor = state.perfusion_rate > 0 ? state.perfusion_rate : 1.0;
  // Flow animation duration: scales smoothly with perfusion rate when active
  const animDuration = `${Math.max(0.6, Math.min(2.5, 1.6 / speedFactor))}s`;

  // Play/pause state: strictly synchronized with simulation start/pause
  const playState = isSimulationRunning && !prefersReducedMotion ? 'running' : 'paused';

  // Dynamic status parameters
  const foulingStatus = state.fouling_state || (state.fouling_index >= 70 ? 'HIGH' : state.fouling_index >= 40 ? 'MODERATE' : 'LOW');

  // Identify active fault states for visual mapping
  const faultEffects = useMemo(() => {
    const active = state.active_fault || '';
    return {
      nutrient: active.toLowerCase().includes('feed') || active.toLowerCase().includes('nutrient'),
      cellDeath: active.toLowerCase().includes('death') || active.toLowerCase().includes('cell'),
      fouling: active.toLowerCase().includes('fouling') || active.toLowerCase().includes('filter'),
      perfusion: active.toLowerCase().includes('pump') || active.toLowerCase().includes('perfusion')
    };
  }, [state.active_fault]);

  const processHealth = useMemo(() => {
    if (state.active_fault) {
      return { label: 'FAULT', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    }
    if (state.fouling_index >= 70) {
      return { label: 'WARNING', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { label: 'NORMAL', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }, [state.active_fault, state.fouling_index]);

  const membraneColor = useMemo(() => {
    if (state.fouling_index >= 70) {
      return {
        stroke: '#ef4444',
        gradientStart: '#fee2e2',
        gradientMid: '#fca5a5',
        gradientEnd: '#ef4444',
        status: 'HIGH'
      };
    } else if (state.fouling_index >= 40) {
      return {
        stroke: '#f59e0b',
        gradientStart: '#fef3c7',
        gradientMid: '#fcd34d',
        gradientEnd: '#f59e0b',
        status: 'MODERATE'
      };
    } else {
      return {
        stroke: '#10b981',
        gradientStart: '#d1fae5',
        gradientMid: '#6ee7b7',
        gradientEnd: '#10b981',
        status: 'LOW'
      };
    }
  }, [state.fouling_index]);

  // VCC Target progress calculation
  const targetPercent = state.target_cell_density > 0
    ? Math.min(100, Math.round((state.viable_cell_density / state.target_cell_density) * 100))
    : 0;

  const formatDensity = (density: number) => {
    if (density >= 1e8) return `${(density / 1e8).toFixed(2)} × 10⁸`;
    if (density >= 1e7) return `${(density / 1e7).toFixed(2)} × 10⁷`;
    return `${(density / 1e6).toFixed(2)} × 10⁶`;
  };

  const mechBadge = DATA_STATE_BADGES['MECHANISTIC'];

  // Three.js Canvas mounting and life-cycle hook
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Track variables in refs to prevent rebuilding ThreeJS WebGL context on every React state render
  const isRunningRef = useRef(isSimulationRunning);
  const speedFactorRef = useRef(speedFactor);
  const faultEffectsRef = useRef(faultEffects);

  useEffect(() => {
    isRunningRef.current = isSimulationRunning;
  }, [isSimulationRunning]);

  useEffect(() => {
    speedFactorRef.current = speedFactor;
  }, [speedFactor]);

  useEffect(() => {
    faultEffectsRef.current = faultEffects;
  }, [faultEffects]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = container.clientWidth || 180;
    const height = container.clientHeight || 260;

    // Setup 3D Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    // Glass Cylinder Bioreactor Vessel (Clear clean glass matching website panel style)
    const glassGeo = new THREE.CylinderGeometry(2, 2, 6, 32, 1, true);
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      shininess: 120,
      specular: 0xffffff,
      side: THREE.DoubleSide
    });
    const vessel = new THREE.Mesh(glassGeo, glassMat);
    scene.add(vessel);

    // Liquid Level (Translucent soft blue liquid culture)
    const liquidGeo = new THREE.CylinderGeometry(1.95, 1.95, 4.5, 32);
    const liquidMat = new THREE.MeshPhongMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.45,
      shininess: 60,
      specular: 0x93c5fd
    });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = -0.75;
    scene.add(liquid);

    // Impeller Shaft (Stainless steel gray)
    const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 7, 8);
    const shaftMat = new THREE.MeshPhongMaterial({
      color: 0x94a3b8,
      shininess: 85,
      specular: 0xffffff
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    scene.add(shaft);

    // Impeller Blades (Stainless steel gray)
    const bladeGeo = new THREE.BoxGeometry(1.5, 0.1, 0.4);
    const bladeGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, shaftMat);
      blade.rotation.y = (i * Math.PI * 2) / 3;
      bladeGroup.add(blade);
    }
    bladeGroup.position.y = -2.5;
    scene.add(bladeGroup);

    // Swirling cell suspension particles in 3D Space (Green accents matching UI badges)
    const cellCount = 35;
    const cellGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const cellMatLive = new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      shininess: 30
    });
    const cellMatDead = new THREE.MeshPhongMaterial({
      color: 0x94a3b8,
      emissive: 0x475569,
      shininess: 10
    });

    const cells: { mesh: THREE.Mesh; angle: number; radius: number; height: number; speed: number }[] = [];

    for (let i = 0; i < cellCount; i++) {
      const radius = 0.3 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI * 2;
      const h = -2.4 + Math.random() * 3.4;
      const speed = 0.01 + Math.random() * 0.02;

      const isDead = i % 3 === 0;
      const mesh = new THREE.Mesh(cellGeo, isDead ? cellMatDead : cellMatLive);
      mesh.position.set(Math.cos(angle) * radius, h, Math.sin(angle) * radius);
      scene.add(mesh);
      cells.push({ mesh, angle, radius, height: h, speed });
    }

    // Lights (Crisp white lighting scheme matching clean layout)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1.8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 12;
    camera.position.y = 2;
    camera.lookAt(0, 0, 0);

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const isRunning = isRunningRef.current;
      const currentSpeedFactor = isRunning ? speedFactorRef.current : 0.0;
      const activeFaults = faultEffectsRef.current;

      // Agitation spins impeller & shaft only when simulation is running
      if (isRunning && currentSpeedFactor > 0) {
        bladeGroup.rotation.y += 0.05 * currentSpeedFactor;
        liquid.rotation.y += 0.01 * currentSpeedFactor;
        shaft.rotation.y += 0.05 * currentSpeedFactor;

        // Cells swirl in concentric loops
        cells.forEach((cell, idx) => {
          cell.angle += cell.speed * 0.5 * currentSpeedFactor;
          cell.mesh.position.x = Math.cos(cell.angle) * cell.radius;
          cell.mesh.position.z = Math.sin(cell.angle) * cell.radius;
          
          // Switch color based on real-time cell mortality fault status
          const isDead = activeFaults.cellDeath && idx % 3 === 0;
          cell.mesh.material = isDead ? cellMatDead : cellMatLive;
        });

        // Micro-liquid pulse
        liquid.scale.y = 1.0 + Math.sin(Date.now() * 0.002) * 0.025;
      } else {
        liquid.scale.y = 1.0;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const w = container.clientWidth || 180;
      const h = container.clientHeight || 260;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      glassGeo.dispose();
      glassMat.dispose();
      liquidGeo.dispose();
      liquidMat.dispose();
      shaftGeo.dispose();
      shaftMat.dispose();
      bladeGeo.dispose();
      cellGeo.dispose();
      cellMatLive.dispose();
      cellMatDead.dispose();
    };
  }, []);

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-200 space-y-6 bg-white shadow-xs">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Bioreactor Process Flow &amp; Filtration Schematic
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${mechBadge.bgColor} ${mechBadge.textColor} ${mechBadge.borderColor}`}
              title={mechBadge.description}
            >
              {mechBadge.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time process telemetry of the active virtual digital-twin culture suspension and perfusion-loop status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-660 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
            Working Volume: <strong className="text-slate-900">{state.reactor_volume} L</strong>
          </span>
          <span className="text-xs font-mono text-slate-660 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
            Volumetric Flow: <strong className="text-blue-600">{flowRateLh} L/h</strong>
          </span>
        </div>
      </div>

      {/* DESKTOP BIOREACTOR INTERACTIVE SCHEMATIC CANVAS */}
      <div className="hidden lg:block relative w-full aspect-[1000/450] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
        {/* SVG Drawing Layer: Pipes, Equipment boundaries, Flow animations */}
        <svg viewBox="0 0 1000 450" className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Definitions for gradients and components */}
          <defs>
            <linearGradient id="reactorLiquid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="feedLiquid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="wasteLiquid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="membraneGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={membraneColor.gradientStart} />
              <stop offset="50%" stopColor={membraneColor.gradientMid} />
              <stop offset="100%" stopColor={membraneColor.gradientEnd} />
            </linearGradient>
            <style>{`
              @keyframes svgFlowForward {
                0% { stroke-dashoffset: 36px; }
                100% { stroke-dashoffset: 0px; }
              }
              .animate-pipe-flow {
                animation: svgFlowForward ${animDuration} linear infinite !important;
                animation-play-state: ${playState} !important;
              }
            `}</style>
          </defs>

          {/* 1. PROCESS PIPELINES (Outer Structural Housing + Inner Channel) */}
          {/* Feed Inflow Pipe (Feed Tank -> Bioreactor) */}
          <path d="M 130,230 L 340,230" stroke={faultEffects.nutrient ? "#f59e0b" : "#cbd5e1"} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M 130,230 L 340,230" stroke="#f1f5f9" strokeWidth="4.5" strokeLinecap="round" fill="none" />

          {/* Perfusion Loop Line (Bioreactor -> Filter) */}
          <path d="M 540,130 L 695,130 L 695,80 L 750,80 L 750,100" stroke={faultEffects.perfusion ? "#ef4444" : "#cbd5e1"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 540,130 L 695,130 L 695,80 L 750,80 L 750,100" stroke="#f1f5f9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Cell Retention Recirculation Line (Filter -> Bioreactor) */}
          <path d="M 720,240 L 620,240 L 620,290 L 540,290" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 720,240 L 620,240 L 620,290 L 540,290" stroke="#f1f5f9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* Permeate Waste Line (Filter -> Waste Tank) */}
          <path d="M 750,280 L 750,415 L 920,415 L 920,300" stroke="#cbd5e1" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 750,280 L 750,415 L 920,415 L 920,300" stroke="#f1f5f9" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />

          {/* 2. CONTINUOUS ANIMATED FLUID STREAMS (High visibility dynamic flow core) */}
          {/* Feed Inflow Active Stream (Blue Glucose Media: Tank -> Bioreactor) */}
          <path
            d="M 130,230 L 340,230"
            stroke={faultEffects.nutrient ? "#f59e0b" : "#3b82f6"}
            strokeWidth="3.5"
            strokeDasharray="10, 8"
            strokeLinecap="round"
            className="animate-pipe-flow"
            style={{
              animationDuration: animDuration,
              animationPlayState: playState
            }}
            fill="none"
          />

          {/* Perfusion Loop Active Stream (Emerald Cell Broth: Bioreactor -> Filter) */}
          <path
            d="M 540,130 L 695,130 L 695,80 L 750,80 L 750,100"
            stroke={faultEffects.perfusion ? "#ef4444" : "#10b981"}
            strokeWidth="3.5"
            strokeDasharray="10, 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pipe-flow"
            style={{
              animationDuration: animDuration,
              animationPlayState: playState
            }}
            fill="none"
          />

          {/* Retentate Return Active Stream (Dark Emerald Concentrated Cells: Filter -> Bioreactor) */}
          <path
            d="M 720,240 L 620,240 L 620,290 L 540,290"
            stroke="#059669"
            strokeWidth="3.5"
            strokeDasharray="10, 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pipe-flow"
            style={{
              animationDuration: animDuration,
              animationPlayState: playState
            }}
            fill="none"
          />

          {/* Permeate Waste Active Stream (Sky Blue / Amber Filtrate: Filter -> Waste Tank) */}
          <path
            d="M 750,280 L 750,415 L 920,415 L 920,300"
            stroke="#0ea5e9"
            strokeWidth="3.5"
            strokeDasharray="10, 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pipe-flow"
            style={{
              animationDuration: animDuration,
              animationPlayState: playState
            }}
            fill="none"
          />

          {/* 3. FLUID PARTICLES & DROPLETS (CSS offset-path driven with glowing drop shadow) */}
          {/* Feed Pipe flow droplets (Blue, Tank -> Bioreactor) */}
          {[0, 0.25, 0.5, 0.75].map((fraction, i) => (
            <circle
              key={`feed-dot-${i}`}
              r="3.5"
              fill="#2563eb"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 130,230 L 340,230")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * fraction}s`,
                animationDuration: animDuration,
                filter: 'drop-shadow(0 0 3px rgba(37,99,235,0.7))'
              } as React.CSSProperties}
            />
          ))}

          {/* Perfusion Loop green droplets (Bioreactor -> Filter) */}
          {[0, 0.33, 0.66].map((fraction, i) => (
            <circle
              key={`perfusion-dot-${i}`}
              r="4"
              fill={faultEffects.perfusion ? "#ef4444" : "#047857"}
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 540,130 L 695,130 L 695,80 L 750,80 L 750,100")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * fraction}s`,
                animationDuration: animDuration,
                filter: 'drop-shadow(0 0 3px rgba(4,120,87,0.7))'
              } as React.CSSProperties}
            />
          ))}

          {/* Retentate Return emerald droplets (Filter -> Bioreactor) */}
          {[0, 0.33, 0.66].map((fraction, i) => (
            <circle
              key={`retentate-dot-${i}`}
              r="4"
              fill="#047857"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 720,240 L 620,240 L 620,290 L 540,290")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * fraction}s`,
                animationDuration: animDuration,
                filter: 'drop-shadow(0 0 3px rgba(4,120,87,0.7))'
              } as React.CSSProperties}
            />
          ))}

          {/* Permeate line amber/orange droplets (Filter -> Waste) */}
          {[0, 0.25, 0.5, 0.75].map((fraction, i) => (
            <circle
              key={`permeate-dot-${i}`}
              r="3.5"
              fill="#f97316"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 750,280 L 750,415 L 920,415 L 920,300")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * fraction}s`,
                animationDuration: animDuration,
                filter: 'drop-shadow(0 0 3px rgba(249,115,22,0.7))'
              } as React.CSSProperties}
            />
          ))}

          {/* 4. ACTIVE PORT NOZZLES & FLUID JETS */}
          {/* Feed Tank Outlet Fitting */}
          <circle cx="130" cy="230" r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
          
          {/* Bioreactor Inflow Jet (Fluid entering vessel) */}
          <circle cx="340" cy="230" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="1.5" />
          <circle
            cx="340"
            cy="230"
            r="8"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.5"
            className="animate-fluid-pulse"
          />

          {/* Bioreactor Harvest Outflow Port (Fluid leaving vessel to loop) */}
          <circle cx="540" cy="130" r="4.5" fill="#047857" stroke="#ffffff" strokeWidth="1.5" />
          <circle
            cx="540"
            cy="130"
            r="7.5"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.5"
            className="animate-fluid-pulse"
          />

          {/* Membrane Top Inflow Nozzle */}
          <circle cx="750" cy="100" r="4.5" fill="#047857" stroke="#ffffff" strokeWidth="1.5" />

          {/* Membrane Retentate Outlet Fitting */}
          <circle cx="720" cy="240" r="4" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />

          {/* Bioreactor Retentate Return Jet (Cells re-entering vessel) */}
          <circle cx="540" cy="290" r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
          <circle
            cx="540"
            cy="290"
            r="7.5"
            fill="none"
            stroke="#34d399"
            strokeWidth="1.5"
            className="animate-fluid-pulse"
          />

          {/* Membrane Bottom Permeate Outlet Fitting */}
          <circle cx="750" cy="280" r="4.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />

          {/* Waste Tank Permeate Inflow Jet */}
          <circle cx="920" cy="300" r="4.5" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.5" />
          <circle
            cx="920"
            cy="300"
            r="7.5"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            className="animate-fluid-pulse"
          />

          {/* 3. EQUIPMENT OUTLINES */}
          {/* Feed Tank */}
          <rect x="35" y="140" width="90" height="130" rx="6" fill="#f8fafc" stroke={faultEffects.nutrient ? "#f59e0b" : "#94a3b8"} strokeWidth={faultEffects.nutrient ? "3.5" : "2"} />
          <rect
            x="37"
            y="170"
            width="86"
            height="98"
            rx="4"
            fill="url(#feedLiquid)"
            className={isSimulationRunning ? "animate-feed-wave" : ""}
            style={{
              animationPlayState: playState
            }}
          />
          <line
            x1="37"
            y1="170"
            x2="123"
            y2="170"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeDasharray="3,1"
            className={isSimulationRunning ? "animate-feed-wave" : ""}
            style={{
              animationPlayState: playState
            }}
          />

          {/* Animated Feed Pump Stream (bubbles moving toward outlet at bottom-right) */}
          <g>
            <circle
              cx="0"
              cy="0"
              r="2.5"
              fill="#60a5fa"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 55,190 L 120,230")',
                animationPlayState: playState,
                animationDelay: '0s',
                animationDuration: animDuration
              } as React.CSSProperties}
            />
            <circle
              cx="0"
              cy="0"
              r="2"
              fill="#93c5fd"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 75,200 L 120,230")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * 0.33}s`,
                animationDuration: animDuration
              } as React.CSSProperties}
            />
            <circle
              cx="0"
              cy="0"
              r="3"
              fill="#3b82f6"
              className="animate-flow-dot"
              style={{
                offsetPath: 'path("M 45,210 L 120,230")',
                animationPlayState: playState,
                animationDelay: `${parseFloat(animDuration) * 0.66}s`,
                animationDuration: animDuration
              } as React.CSSProperties}
            />
          </g>

          {/* Waste Permeate Tank */}
          <rect x="875" y="200" width="90" height="100" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
          <rect
            x="877"
            y="240"
            width="86"
            height="58"
            rx="4"
            fill="url(#wasteLiquid)"
            className="animate-feed-wave"
            style={{
              animationPlayState: playState
            }}
          />
          <line
            x1="877"
            y1="240"
            x2="963"
            y2="240"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3,1"
            className="animate-feed-wave"
            style={{
              animationPlayState: playState
            }}
          />

          {/* Controller Valve Symbol on Perfusion Pipe - moved to x = 695 to avoid overlaps */}
          <g transform="translate(695, 130) scale(0.9)">
            <circle cx="0" cy="0" r="16" fill={faultEffects.perfusion ? "#fee2e2" : (state.controller_enabled ? "#eff6ff" : "#f1f5f9")} stroke={faultEffects.perfusion ? "#ef4444" : (state.controller_enabled ? "#2563eb" : "#94a3b8")} strokeWidth="2" />
            <polygon points="-8,-6 -8,6 8,-6 8,6" fill={faultEffects.perfusion ? "#ef4444" : (state.controller_enabled ? "#2563eb" : "#64748b")} />
            <circle cx="0" cy="0" r="3" fill="#ffffff" />
          </g>

          {/* Membrane Housing Outer shell */}
          <rect x="730" y="100" width="40" height="180" rx="6" fill="url(#membraneGrad)" stroke={faultEffects.fouling ? "#ef4444" : membraneColor.stroke} strokeWidth="3" />
          
          {/* Hollow Fiber bundles - animated vertical flows */}
          <line x1="736" y1="108" x2="736" y2="272" stroke="#94a3b8" strokeWidth="1" />
          <line
            x1="742" y1="108" x2="742" y2="272"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            strokeLinecap="round"
            className="animate-pipe-flow"
            style={{
              animationPlayState: playState,
              animationDuration: animDuration
            } as React.CSSProperties}
          />
          <line
            x1="750" y1="108" x2="750" y2="272"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            strokeLinecap="round"
            className="animate-pipe-flow"
            style={{
              animationPlayState: playState,
              animationDuration: animDuration
            } as React.CSSProperties}
          />
          <line
            x1="758" y1="108" x2="758" y2="272"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="5,5"
            strokeLinecap="round"
            className="animate-pipe-flow"
            style={{
              animationPlayState: playState,
              animationDuration: animDuration
            } as React.CSSProperties}
          />
          <line x1="764" y1="108" x2="764" y2="272" stroke="#94a3b8" strokeWidth="1" />

          {/* Fouling accumulation material overlay */}
          <rect
            x="731"
            y="101"
            width="38"
            height="178"
            rx="5"
            fill="#78350f"
            opacity={state.fouling_index / 220}
            className="transition-opacity duration-500 pointer-events-none"
          />
        </svg>

        {/* 4. BIOREACTOR GLASS VESSEL HTML CONTAINER (Centered centerpiece with live Three.js 3D Rendering) */}
        <div className="absolute left-[34%] top-[12%] w-[20%] h-[68%] flex flex-col justify-end">
          {/* Top Plate/Lid */}
          <div className="w-full h-4 bg-gradient-to-r from-slate-200 via-slate-355 to-slate-400 border border-slate-400 rounded-t-md shadow-xs flex justify-center items-center pointer-events-none">
            <div className="w-8 h-2 bg-slate-400 rounded-sm"></div>
          </div>

          {/* Transparent Glass Vessel */}
          <div className="relative w-full flex-1 border-2 border-slate-400/80 rounded-b-3xl bg-slate-900/10 overflow-hidden shadow-md">
            {/* 3D WebGL Canvas mounted and updated in useEffect */}
            <div ref={canvasContainerRef} className="w-full h-full bg-transparent absolute inset-0"></div>
          </div>
        </div>

        {/* 5. INTERACTIVE AND TELEMETRY HTML CARDS (Absolutely positioned overlays with corrected non-overlapping spacing) */}
        
        {/* Live Process Status Header overlay */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs shadow-xs border border-slate-200 rounded-lg p-2.5 flex items-center gap-4 text-xs">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span className={`w-2 h-2 rounded-full ${isSimulationRunning ? 'bg-blue-600 animate-ping' : 'bg-slate-400'}`}></span>
              <span className="uppercase">
                {state.active_fault ? '● FAULT' : isSimulationRunning ? '● RUNNING' : '● PAUSED'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Simulation: {state.simulation_time.toFixed(1)} h</div>
          </div>
          <div className="border-l border-slate-200 pl-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Process Health</div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold mt-1 inline-block border ${processHealth.color}`}>
              {processHealth.label}
            </span>
          </div>
        </div>

        {/* Media Feed Tank Card overlay - Centered under Feed Reservoir */}
        <div className={`absolute left-[2.5%] top-[65%] w-[13.5%] bg-white/95 backdrop-blur-xs border rounded-lg p-2 shadow-xs group transition hover:border-blue-400 ${
          faultEffects.nutrient ? 'border-amber-300 ring-2 ring-amber-300/20' : 'border-slate-200'
        }`}>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            {faultEffects.nutrient && <AlertTriangle className="w-3 h-3 text-amber-600 animate-bounce" />}
            Fresh Media Feed
          </div>
          <div className="font-bold text-slate-800 text-[11px] mt-0.5">Media Tank</div>
          
          <div className="mt-1.5 space-y-1 text-[10px] font-mono text-slate-650 border-t border-slate-100 pt-1.5">
            <div className="flex justify-between">
              <span>Glucose Feed:</span>
              <span className="text-emerald-705 font-bold">{(config?.feed_nutrient_concentration ?? NOMINAL_FEED_GLUCOSE).toFixed(1)} g/L</span>
            </div>
            <div className="flex justify-between">
              <span>Feed Rate:</span>
              <span className="text-blue-600 font-bold">{flowRateLh} L/h</span>
            </div>
          </div>

          {/* Feed Hover Info tooltip */}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700 transition">
            <div className="font-bold text-emerald-400 pb-1 border-b border-slate-700 mb-1">Media Feed Inlet</div>
            <p className="text-[10px] leading-relaxed text-slate-300">
              Continuously replenishes glucose substrates ({(config?.feed_nutrient_concentration ?? NOMINAL_FEED_GLUCOSE).toFixed(1)} g/L) to prevent cellular starving.
            </p>
            {faultEffects.nutrient && (
              <div className="text-[10px] text-amber-400 font-bold mt-2">
                ⚠ ACTIVE FAULT: Feeding reduction restriction in progress.
              </div>
            )}
          </div>
        </div>

        {/* Bioreactor Left Overlay: Culture Metrics - perfectly fits left of the vessel */}
        <div className={`absolute left-[17%] top-[15%] w-[15%] bg-white/95 backdrop-blur-xs border rounded-lg p-2.5 shadow-xs group transition hover:border-blue-400 ${
          faultEffects.cellDeath ? 'border-amber-300 ring-2 ring-amber-300/20' : 'border-slate-200'
        }`}>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            {faultEffects.cellDeath && <AlertTriangle className="w-3 h-3 text-amber-600 animate-bounce" />}
            Viable Cells
          </div>
          <div className="flex items-baseline justify-between mt-1 border-b border-slate-100 pb-1">
            <span className="text-[10px] text-slate-655">VCC Density:</span>
            <span className="font-mono text-blue-700 font-bold text-xs">{cellDensityFormatted} ×{cellDensityExponent}</span>
          </div>
          <div className="flex items-baseline justify-between mt-1 text-[10px]">
            <span className="text-slate-655">Viability:</span>
            <span className="font-mono text-emerald-700 font-bold">{state.cell_viability.toFixed(1)}%</span>
          </div>

          {/* Cell culture Hover info */}
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700">
            <div className="font-bold text-emerald-400 pb-1 border-b border-slate-700 mb-1">Stirred Bioreactor State</div>
            <p className="text-[10px] leading-relaxed text-slate-300">
              Monod-Contois cell growth modeling. Impeller rotation ensures mass distribution, preventing local nutrient starvation.
            </p>
            {faultEffects.cellDeath && (
              <div className="text-[10px] text-amber-400 font-bold mt-2">
                ⚠ ACTIVE FAULT: Elevated cell mortality rates injected.
              </div>
            )}
          </div>
        </div>

        {/* Bioreactor Right Overlay: Metabolites & Nutrients - repositioned and resized to avoid valve overlap */}
        <div className="absolute left-[55.5%] top-[12%] w-[12.5%] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-2 shadow-xs group transition hover:border-blue-400">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kinetics Telemetry</div>
          <div className="flex items-baseline justify-between mt-1 border-b border-slate-100 pb-1">
            <span className="text-[10px] text-slate-655">Glucose (S):</span>
            <span className="font-mono text-slate-800 font-bold text-[11px]">{state.nutrient_concentration.toFixed(2)} g/L</span>
          </div>
          <div className="flex items-baseline justify-between mt-1 text-[10px]">
            <span className="text-slate-655">Lactate (P):</span>
            <span className="font-mono text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
          </div>

          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700">
            <div className="font-bold text-amber-400 pb-1 border-b border-slate-700 mb-1">Metabolic Byproducts</div>
            <p className="text-[10px] leading-relaxed text-slate-300">
              Glucose is consumed by CHO cells, releasing lactate byproduct. Perfusion prevents byproduct accumulation above inhibitory limits.
            </p>
          </div>
        </div>

        {/* Adaptive Control Valve Pulse Indicator - shifted slightly right (67.5%) to avoid overlay overlap */}
        <div className="absolute left-[67.5%] top-[20%] group">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition ${
            faultEffects.perfusion ? 'bg-rose-500 text-white animate-bounce' : (state.controller_enabled ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 text-slate-500')
          }`}>
            <Settings className="w-3.5 h-3.5" />
          </div>

          {/* Valve Controller Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700">
            <div className="font-bold text-blue-400 pb-1 border-b border-slate-700 mb-1">Adaptive Control Valve</div>
            <div className="space-y-1 text-[10px] text-slate-300 mt-1 font-mono">
              <div>Mode: <span className="text-emerald-400 font-bold">{state.controller_enabled ? 'ADAPTIVE' : 'MANUAL'}</span></div>
              <div>Perfusion Rate: <span className="text-blue-400 font-bold">{state.perfusion_rate.toFixed(2)} VVD</span></div>
              {state.latest_controller_action && (
                <>
                  <div>Action: <span className="text-amber-400 font-bold">{state.latest_controller_action.action_type}</span></div>
                  <div className="text-[9px] text-slate-400 leading-snug">Reason: {state.latest_controller_action.reason}</div>
                </>
              )}
              {faultEffects.perfusion && (
                <div className="text-[9px] text-rose-400 font-bold mt-2">
                  ⚠ FAULT ACTIVE: Perfusion Pump Disruption.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Membrane Filter Metrics Overlay - Adjusted coordinates to 67.5% and 16.5% width to prevent outflow overlap */}
        <div className={`absolute left-[67.5%] top-[65%] w-[16.5%] bg-white/95 backdrop-blur-xs border rounded-lg p-2 shadow-xs group transition hover:border-blue-400 ${
          faultEffects.fouling ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-slate-200'
        }`}>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Filter className={`w-3 h-3 ${faultEffects.fouling ? 'text-rose-600 animate-bounce' : 'text-blue-600'}`} />
            Membrane Filter
          </div>
          
          <div className="mt-1.5 space-y-1.5 text-[10px] font-mono text-slate-650">
            <div className="flex justify-between">
              <span>Fouling Index:</span>
              <span className={`font-bold ${state.fouling_index >= 70 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {state.fouling_index.toFixed(1)}/100
              </span>
            </div>
            
            {/* Visual Mini Fouling Meter */}
            <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  state.fouling_index >= 70
                    ? 'bg-rose-500'
                    : state.fouling_index >= 40
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, state.fouling_index)}%` }}
              ></div>
            </div>

            <div className="flex justify-between border-t border-slate-100 pt-1">
              <span>Permeability:</span>
              <span className="text-blue-600 font-bold">{permeabilityPercent}%</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1">
              <span>Retention:</span>
              <span className="text-emerald-700 font-bold">100% retained</span>
            </div>
          </div>

          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700">
            <div className="font-bold text-emerald-400 pb-1 border-b border-slate-700 mb-1">Filtration Membrane</div>
            <p className="text-[10px] leading-relaxed text-slate-300">
              Cell retention filter loops out cell-free permeate. Pore residue clogging increases the fouling index. Autonomic perfusion throttling starts if index &gt; 70.
            </p>
            {faultEffects.fouling && (
              <div className="text-[10px] text-rose-455 font-bold mt-2">
                ⚠ ACTIVE FAULT: Membrane fouling surge.
              </div>
            )}
          </div>
        </div>

        {/* Permeate Outlet / Waste Tank Overlay - shifted slightly right (85.5%) and width (11.5%) to clear filter card */}
        <div className="absolute left-[85.5%] top-[65%] w-[11.5%] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-2 shadow-xs group transition hover:border-blue-400">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Outflow</div>
          <div className="font-bold text-slate-800 text-[11px] mt-0.5">Permeate Waste</div>
          
          <div className="mt-1.5 space-y-1 text-[10px] font-mono text-slate-650 border-t border-slate-100 pt-1.5">
            <div className="flex justify-between">
              <span>Lactate:</span>
              <span className="text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
            </div>
            <div className="flex justify-between">
              <span>Outflow:</span>
              <span className="text-blue-600 font-bold">{flowRateLh} L/h</span>
            </div>
          </div>

          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-lg text-xs w-60 z-30 shadow-md border border-slate-700">
            <div className="font-bold text-amber-400 pb-1 border-b border-slate-700 mb-1">Permeate Outlet</div>
            <p className="text-[10px] leading-relaxed text-slate-300">
              Continuous wash out of growth-inhibiting metabolites (Lactate). Green cell suspension stays 100% retained.
            </p>
          </div>
        </div>

        {/* Dynamic VCC Target Progress Overlay (Below Bioreactor) */}
        <div className="absolute left-[34%] top-[82%] w-[20%] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg p-2.5 shadow-xs">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span className="font-bold">Target VCC Progress:</span>
            <span className="font-bold font-mono text-blue-700">{targetPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                targetPercent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${targetPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
            <span>Goal: {formatDensity(state.target_cell_density)}</span>
            {targetPercent >= 100 && <span className="text-emerald-600 font-bold">Target Achieved</span>}
          </div>
        </div>
      </div>

      {/* MOBILE/TABLET RESPONSIVE FALLBACK SCHEMATIC (Stacked Layout) */}
      <div className="lg:hidden bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col items-center justify-between gap-6 min-h-[360px]">
        {/* 1. Fresh Media Feed Tank */}
        <div className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[200px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
            FEED
          </div>
          <h4 className="text-xs font-bold text-slate-900">Fresh Media Feed Tank</h4>
          <div className="text-[11px] text-slate-650 font-mono">
            Glucose Feed: <span className="text-emerald-700 font-bold">{(config?.feed_nutrient_concentration ?? NOMINAL_FEED_GLUCOSE).toFixed(1)} g/L</span>
          </div>
          <div className="text-[11px] text-slate-655 font-mono">
            Perfusion Rate: <span className="text-blue-600 font-bold">{state.perfusion_rate.toFixed(2)} VVD</span>
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-1">
            Inflow Rate: {flowRateLh} L/h
          </div>
        </div>

        {/* 2. Main Bioreactor Vessel Card */}
        <div className="relative flex flex-col items-center justify-between p-5 bg-white border-2 border-slate-200 rounded-xl w-full max-w-[280px] min-h-[220px] shadow-xs">
          <div className="absolute top-2 left-3 text-[9px] font-mono font-bold text-slate-400 uppercase">CHO BIOREACTOR VESSEL</div>

          {/* Motor top */}
          <div className="w-8 h-2 bg-slate-200 border border-slate-300 rounded-t flex justify-center items-center mt-3">
            <div className="w-1.5 h-3 bg-slate-400"></div>
          </div>

          <div className="w-full flex-1 my-3 bg-blue-50/60 border border-blue-100 rounded-lg p-3 flex flex-col justify-end relative overflow-hidden">
            <div className="space-y-1.5 bg-white/90 p-3 rounded border border-slate-200 text-xs shadow-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">VCC Density:</span>
                <span className="text-blue-700 font-bold">{cellDensityFormatted} ×{cellDensityExponent}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Cell Viability:</span>
                <span className="text-emerald-700 font-bold">{state.cell_viability.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Glucose (S):</span>
                <span className="text-slate-800 font-bold">{state.nutrient_concentration.toFixed(2)} g/L</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-600">Lactate (P):</span>
                <span className="text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
              </div>
            </div>
          </div>

          <div className="text-[11px] font-medium text-slate-605 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Stirred Suspension (37°C, pH 7.2)</span>
          </div>
        </div>

        {/* 3. Cell Retention Filter Unit */}
        <div className="relative flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[220px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold">
            <Filter className={`w-5 h-5 ${state.fouling_index >= 70 ? 'text-red-655' : 'text-blue-600'}`} />
          </div>
          <h4 className="text-xs font-bold text-slate-900">Membrane Filter Unit</h4>

          {/* Membrane Fouling Risk Meter */}
          <div className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 my-1 space-y-2 text-left">
            <div className="flex justify-between text-[10px] font-mono text-slate-650">
              <span>Fouling Risk:</span>
              <span className={`font-bold ${state.fouling_index >= 70 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {state.fouling_index.toFixed(1)}/100 ({foulingStatus})
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  state.fouling_index >= 70
                    ? 'bg-rose-500'
                    : state.fouling_index >= 40
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, state.fouling_index)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-655 pt-1 border-t border-slate-200">
              <span>Permeability:</span>
              <span className="text-blue-700 font-bold">{permeabilityPercent}%</span>
            </div>
          </div>
        </div>

        {/* 4. Waste Permeate Tank */}
        <div className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl max-w-[180px] w-full text-center shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
            OUT
          </div>
          <h4 className="text-xs font-bold text-slate-900">Waste Permeate Tank</h4>
          <div className="text-[11px] text-slate-655 font-mono">
            Lactate Washout: <span className="text-amber-700 font-bold">{state.metabolite_concentration.toFixed(2)} g/L</span>
          </div>
          <div className="text-[11px] text-slate-655 font-mono">
            Outflow Rate: <span className="text-blue-600 font-bold">{flowRateLh} L/h</span>
          </div>
        </div>
      </div>

      {/* Dynamic Sub-focus Detail Panels (Keep existing detail panels) */}
      {focus === 'balance' && (
        <div className="glass-panel p-5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" style={{ animationDuration: '6s' }} />
            Real-Time Mass Balance Analysis (Nutrients &amp; Metabolites)
          </h3>
          <p className="text-xs text-slate-655">
            Volumetric flow rates and cellular metabolic rates computed across the active working volume ({state.reactor_volume} L).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Glucose Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex justify-between">
                <span>Glucose Substrate Balance</span>
                <span className="font-mono text-[10px] text-slate-400 font-normal">q_s = {config?.cell_nutrient_consumption_rate ?? 0.005}</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Glucose Feed Inflow Rate:</span>
                  <span className="text-emerald-750 font-bold">
                    +{((state.perfusion_rate / 24.0) * (config?.feed_nutrient_concentration ?? NOMINAL_FEED_GLUCOSE) * state.reactor_volume).toFixed(3)} g/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Glucose Washout Outflow Rate:</span>
                  <span className="text-rose-600 font-bold">
                    -{((state.perfusion_rate / 24.0) * state.nutrient_concentration * state.reactor_volume).toFixed(3)} g/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cellular Glucose Consumption:</span>
                  <span className="text-rose-600 font-bold">
                    -{((config?.cell_nutrient_consumption_rate ?? 0.005) * (state.viable_cell_density / 1e6) * state.reactor_volume).toFixed(3)} g/h
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-sans font-bold text-slate-800 text-xs">
                  <span>Net Accumulation Rate:</span>
                  {(() => {
                    const inflow = (state.perfusion_rate / 24.0) * (config?.feed_nutrient_concentration ?? NOMINAL_FEED_GLUCOSE) * state.reactor_volume;
                    const outflow = (state.perfusion_rate / 24.0) * state.nutrient_concentration * state.reactor_volume;
                    const consumption = (config?.cell_nutrient_consumption_rate ?? 0.005) * (state.viable_cell_density / 1e6) * state.reactor_volume;
                    const net = inflow - outflow - consumption;
                    return (
                      <span className={net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {net >= 0 ? '+' : ''}{net.toFixed(3)} g/h
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Lactate Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex justify-between">
                <span>Lactate Byproduct Balance</span>
                <span className="font-mono text-[10px] text-slate-400 font-normal">Y_p = {config?.cell_metabolite_yield ?? 0.08}</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-650">
                <div className="flex justify-between">
                  <span>Cellular Lactate Production:</span>
                  <span className="text-emerald-700 font-bold">
                    +{((config?.cell_metabolite_yield ?? 0.08) * (state.viable_cell_density / 1e6) * state.reactor_volume).toFixed(3)} g/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Lactate Washout Outflow Rate:</span>
                  <span className="text-rose-600 font-bold">
                    -{((state.perfusion_rate / 24.0) * state.metabolite_concentration * state.reactor_volume).toFixed(3)} g/h
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-sans font-bold text-slate-800 text-xs">
                  <span>Net Accumulation Rate:</span>
                  {(() => {
                    const production = (config?.cell_metabolite_yield ?? 0.08) * (state.viable_cell_density / 1e6) * state.reactor_volume;
                    const outflow = (state.perfusion_rate / 24.0) * state.metabolite_concentration * state.reactor_volume;
                    const net = production - outflow;
                    return (
                      <span className={net >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {net >= 0 ? '+' : ''}{net.toFixed(3)} g/h
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {focus === 'filter' && (
        <div className="glass-panel p-5 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            Filter Performance &amp; Membrane Permeability Audit
          </h3>
          <p className="text-xs text-slate-655">
            Real-time diagnostics on membrane fouling index, filter resistance, and automated feedback loop actions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-500 uppercase text-[10px]">Middle Fiber Fouling Index</div>
              <div className="text-base font-extrabold font-mono text-slate-800">
                {state.fouling_index.toFixed(1)} / 100
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                Normalized proxy representing cell residue accumulation and clogging level.
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-500 uppercase text-[10px]">Membrane Permeability</div>
              <div className="text-base font-extrabold font-mono text-blue-600">
                {permeabilityPercent}%
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                The remaining fraction of available pores allowing nutrient passage.
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-500 uppercase text-[10px]">Retention Controller Action</div>
              <div className="text-sm font-bold text-amber-700 uppercase truncate">
                {state.latest_controller_action?.action_type || 'SYSTEM NOMINAL'}
              </div>
              <p className="text-[10px] text-slate-500 leading-snug font-mono truncate" title={state.latest_controller_action?.reason || 'No throttling required'}>
                {state.latest_controller_action?.reason || 'Operating within safe fouling bands.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {focus === 'flow' && (
        <div className="glass-panel p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 animate-fade-in text-xs text-slate-655">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            Bioprocess Perfusion Flow Analysis Guide
          </h3>
          <p className="leading-relaxed">
            In perfusion mode, fresh media is fed continuously into the vessel while cell-free permeate containing spent media, lactate byproducts, and proteins is removed via a membrane filter. The cell retention unit ensures 100% cell recovery, maintaining high cell density cultures.
          </p>
          <div className="flex gap-4 text-[11px] font-mono text-slate-500 pt-1.5 border-t border-slate-200/50">
            <span>• Continuous perfusion dynamically regulates feed replenishment, cell retention, and permeate filtration.</span>
          </div>
        </div>
      )}
    </div>
  );
}
