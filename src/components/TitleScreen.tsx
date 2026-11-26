import React, { useEffect, useState } from 'react';
import { GameMode, GameOptions } from '../types/game';
import { SaveSummary } from '../engine/gameEngine';

interface TitleScreenProps {
  savedWorld: SaveSummary | null;
  options: GameOptions;
  onStartNew: (seed: number, mode: GameMode, bonusChest: boolean) => void;
  onContinueSaved: () => void;
  onUpdateOptions: (next: Partial<GameOptions>) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  savedWorld,
  options,
  onStartNew,
  onContinueSaved,
  onUpdateOptions,
}) => {
  const [subView, setSubView] = useState<'main' | 'create' | 'options'>('main');
  const [seedInput, setSeedInput] = useState('133742');
  const [mode, setMode] = useState<GameMode>('survival');
  const [bonusChest, setBonusChest] = useState(true);

  const launchNew = () => {
    const parsed = Number(seedInput.trim());
    const finalSeed =
      !Number.isNaN(parsed) && seedInput.trim() !== ''
        ? Math.abs(Math.floor(parsed))
        : Math.abs(
            seedInput
              .split('')
              .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 1337)
          ) || 133742;
    onStartNew(finalSeed, mode, bonusChest);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (subView === 'main' && (e.key === 'Enter' || e.key === ' ')) {
        const active = document.activeElement?.tagName;
        if (active === 'INPUT' || active === 'BUTTON') return;
        e.preventDefault();
        if (savedWorld) onContinueSaved();
        else launchNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-between py-6 sm:py-10 px-4 sm:px-6 overflow-y-auto bg-gradient-to-b from-black/45 via-black/15 to-black/65 pointer-events-auto">
      {/* Bespoke Inline SVG Minecraft Java Edition Lockup */}
      <div className="relative flex flex-col items-center mt-4 select-none">
        <svg
          viewBox="0 0 680 144"
          className="w-[min(640px,92vw)] h-auto drop-shadow-[0_8px_0_rgba(0,0,0,0.85)]"
          aria-label="Minecraft Java Edition"
        >
          <defs>
            <linearGradient id="mcStoneFace" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#efefef" />
              <stop offset="38%" stopColor="#c5c5c5" />
              <stop offset="72%" stopColor="#949494" />
              <stop offset="100%" stopColor="#6c6c6c" />
            </linearGradient>
            <linearGradient id="mcStoneEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#525252" />
              <stop offset="100%" stopColor="#1e1e1e" />
            </linearGradient>
            <pattern id="mcStoneGrain" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="transparent" />
              <rect x="2" y="3" width="3" height="3" fill="#000000" opacity="0.09" />
              <rect x="9" y="1" width="4" height="2" fill="#ffffff" opacity="0.1" />
              <rect x="11" y="9" width="3" height="4" fill="#000000" opacity="0.11" />
              <rect x="3" y="11" width="4" height="2" fill="#ffffff" opacity="0.08" />
            </pattern>
          </defs>

          {/* 3D Extruded Stone Depth Layers */}
          {[7, 5, 3].map((offset) => (
            <text
              key={offset}
              x="340"
              y={74 + offset}
              textAnchor="middle"
              fill="url(#mcStoneEdge)"
              stroke="#141414"
              strokeWidth="4"
              fontFamily="Silkscreen, monospace"
              fontWeight="700"
              fontSize="66"
              letterSpacing="5"
            >
              MINECRAFT
            </text>
          ))}

          {/* Main Stone Block Lettering */}
          <text
            x="340"
            y="74"
            textAnchor="middle"
            fill="url(#mcStoneFace)"
            stroke="#1b1b1b"
            strokeWidth="3.5"
            fontFamily="Silkscreen, monospace"
            fontWeight="700"
            fontSize="66"
            letterSpacing="5"
          >
            MINECRAFT
          </text>

          {/* Subtle pixel-stone grain & weathering cracks across title */}
          <text
            x="340"
            y="74"
            textAnchor="middle"
            fill="url(#mcStoneGrain)"
            fontFamily="Silkscreen, monospace"
            fontWeight="700"
            fontSize="66"
            letterSpacing="5"
          >
            MINECRAFT
          </text>
          <g stroke="#292929" strokeWidth="2" fill="none" opacity="0.65">
            <path d="M126 36 l6 9 l-4 7" />
            <path d="M220 56 l-5 8 l3 6" />
            <path d="M352 33 l4 10 l-6 6" />
            <path d="M474 52 l7 7 l-3 9" />
            <path d="M562 38 l-5 8 l4 8" />
          </g>

          {/* JAVA EDITION Stone Banner */}
          <g transform="translate(206, 94)">
            <rect x="0" y="0" width="268" height="28" fill="#181818" />
            <rect x="2" y="2" width="264" height="24" fill="#3a3a3a" />
            <rect x="2" y="2" width="264" height="2" fill="#707070" />
            <rect x="2" y="24" width="264" height="2" fill="#1e1e1e" />
            <text
              x="134"
              y="19"
              textAnchor="middle"
              fill="#f8fafc"
              fontFamily="Silkscreen, monospace"
              fontWeight="700"
              fontSize="15"
              letterSpacing="5"
            >
              JAVA EDITION
            </text>
          </g>
        </svg>

        <div className="mc-splash text-[11px] sm:text-sm font-mc text-[#ffff55] mc-outline-shadow -mt-3 sm:-mt-4 self-end mr-2 sm:mr-8 pointer-events-none">
          100% Java Edition!
        </div>
      </div>

      {/* Central Menu Panel */}
      {subView === 'main' && (
        <div className="w-full max-w-[420px] flex flex-col gap-3">
          {savedWorld ? (
            <button
              onClick={onContinueSaved}
              className="mc-button h-12 px-5 text-sm font-mc tracking-wide cursor-pointer"
            >
              Continue Saved World (Day {savedWorld.dayCount} · {savedWorld.gameMode})
            </button>
          ) : (
            <button
              onClick={launchNew}
              className="mc-button h-12 px-5 text-sm font-mc tracking-wide cursor-pointer"
            >
              Play Survival World
            </button>
          )}

          <button
            onClick={() => setSubView('create')}
            className="mc-button h-11 px-5 text-sm font-mc tracking-wide cursor-pointer"
          >
            Create New World
          </button>

          <button
            onClick={() => setSubView('options')}
            className="mc-button h-11 px-5 text-sm font-mc tracking-wide cursor-pointer"
          >
            Options...
          </button>
        </div>
      )}

      {subView === 'create' && (
        <div className="mc-panel w-full max-w-[460px] p-5 text-[#1f1f1f] flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#7a7a7a] pb-2">
            <h2 className="text-base font-bold font-mc">Create New World</h2>
            <button
              onClick={() => setSubView('main')}
              className="mc-button px-3 py-1 text-xs cursor-pointer"
            >
              Back
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold">World Seed</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="Enter numeric or text seed"
                className="flex-1 bg-[#1e1e1e] text-white px-3 py-2 text-xs font-mc-mono border-2 border-[#3c3c3c] focus:outline-none focus:border-white"
              />
              <button
                onClick={() => setSeedInput(String(Math.floor(100000 + Math.random() * 899999)))}
                className="mc-button px-3 py-2 text-xs cursor-pointer"
              >
                Random
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">Game Mode</span>
            <div className="grid grid-cols-2 gap-2">
              {(['survival', 'creative'] as GameMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`mc-button h-10 text-xs capitalize cursor-pointer ${
                    mode === m ? 'ring-2 ring-[#ffffa0]' : 'opacity-80'
                  }`}
                >
                  {m === 'survival' ? 'Survival (Crafting & Mobs)' : 'Creative (Flight & All Blocks)'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'survival' && (
            <label className="flex items-center justify-between bg-[#b2b2b2] px-3 py-2 border border-[#707070] cursor-pointer">
              <span className="text-xs font-bold">Starter Bonus Kit</span>
              <input
                type="checkbox"
                checked={bonusChest}
                onChange={(e) => setBonusChest(e.target.checked)}
                className="w-4 h-4 accent-[#3b82f6]"
              />
            </label>
          )}

          <button
            onClick={launchNew}
            className="mc-button h-11 text-sm font-bold cursor-pointer mt-1"
          >
            Create New World
          </button>
        </div>
      )}

      {subView === 'options' && (
        <div className="mc-panel w-full max-w-[460px] p-5 text-[#1f1f1f] flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#7a7a7a] pb-2">
            <h2 className="text-base font-bold font-mc">Video & Audio Options</h2>
            <button
              onClick={() => setSubView('main')}
              className="mc-button px-3 py-1 text-xs cursor-pointer"
            >
              Done
            </button>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>FOV</span>
              <span className="font-mc-mono">{options.fov}°</span>
            </div>
            <input
              type="range"
              min={60}
              max={105}
              value={options.fov}
              onChange={(e) => onUpdateOptions({ fov: Number(e.target.value) })}
              className="accent-[#4c6b22]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>Render Distance</span>
              <span className="font-mc-mono">{options.renderDistance} Chunks</span>
            </div>
            <input
              type="range"
              min={3}
              max={6}
              value={options.renderDistance}
              onChange={(e) => onUpdateOptions({ renderDistance: Number(e.target.value) })}
              className="accent-[#4c6b22]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>Mouse Sensitivity</span>
              <span className="font-mc-mono">{Math.round(options.mouseSensitivity * 100)}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={200}
              value={Math.round(options.mouseSensitivity * 100)}
              onChange={(e) => onUpdateOptions({ mouseSensitivity: Number(e.target.value) / 100 })}
              className="accent-[#4c6b22]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <div className="flex justify-between font-bold">
              <span>Master Volume</span>
              <span className="font-mc-mono">{options.muted ? 'Muted' : `${Math.round(options.soundVolume * 100)}%`}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(options.soundVolume * 100)}
              onChange={(e) => onUpdateOptions({ soundVolume: Number(e.target.value) / 100, muted: false })}
              className="accent-[#4c6b22]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onUpdateOptions({ muted: !options.muted })}
              className="mc-button flex-1 min-w-[110px] h-9 text-xs cursor-pointer"
            >
              Audio: {options.muted ? 'OFF' : 'ON'}
            </button>
            <button
              onClick={() => onUpdateOptions({ showClouds: !options.showClouds })}
              className="mc-button flex-1 min-w-[110px] h-9 text-xs cursor-pointer"
            >
              Clouds: {options.showClouds ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() =>
                onUpdateOptions({
                  touchControls:
                    options.touchControls === 'auto'
                      ? 'on'
                      : options.touchControls === 'on'
                        ? 'off'
                        : 'auto',
                })
              }
              className="mc-button flex-1 min-w-[140px] h-9 text-xs cursor-pointer"
            >
              Touch Controls: {options.touchControls.toUpperCase()}
            </button>
          </div>
        </div>
      )}

      {/* Single flat control-hint line */}
      <p className="text-[10px] sm:text-xs text-white/85 mc-text-shadow text-center tracking-wide">
        Desktop: WASD Move · Space Jump/Fly · Left Mine · Right Place/Use · E Inv · F3 Debug · T Chat · Mobile: On-screen Touch Pad
      </p>
    </div>
  );
};
