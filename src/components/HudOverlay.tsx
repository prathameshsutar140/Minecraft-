import React, { useEffect, useRef, useState } from 'react';
import { AdvancementToast, ChatMessage, GameOptions, HudSnapshot } from '../types/game';
import { ITEMS } from '../data/itemsAndBlocks';
import { ItemSlot } from './ItemSlot';

interface HudOverlayProps {
  hud: HudSnapshot;
  atlasCanvas: HTMLCanvasElement | null;
  pointerLocked: boolean;
  showDebug: boolean;
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  advancementToast: AdvancementToast | null;
  touchControlsMode: GameOptions['touchControls'];
  onCloseChat: () => void;
  onSendChat: (text: string) => void;
  onRequestLock: () => void;
  onSelectHotbar: (idx: number) => void;
  onToggleMute: () => void;
  muted: boolean;
  onOpenInventory: () => void;
  onPauseGame: () => void;
  onOpenChat: () => void;
  onToggleDebug: () => void;
  onToggleCamera: () => void;
  onTouchMove: (fwd: number, strafe: number) => void;
  onTouchAction: (action: 'jump' | 'sneak' | 'mine', pressed: boolean) => void;
  onTouchPlaceOrUse: () => void;
  onLookDelta: (dx: number, dy: number) => void;
  onToggleSprint: () => void;
  onToggleSneak: () => void;
}

const HeartIcon: React.FC<{ state: 'full' | 'half' | 'empty'; hardcore?: boolean }> = ({
  state,
  hardcore,
}) => (
  <svg viewBox="0 0 9 9" className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]">
    <path d="M2 1h2v1h1V1h2v1h1v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2h1V1z" fill="#111111" />
    {state !== 'empty' && (
      <path
        d={
          state === 'full'
            ? 'M2 2h2v1h1V2h2v3H6v1H5v1H4V6H3V5H2V2z'
            : 'M2 2h2v1h1v4H4V6H3V5H2V2z'
        }
        fill="#dc2626"
      />
    )}
    {state !== 'empty' && <rect x="2" y="2" width="1" height="1" fill="#fca5a5" />}
    {hardcore && state !== 'empty' && (
      <>
        <rect x="2" y="3" width="1" height="1" fill="#111111" />
        <rect x="3" y="4" width="1" height="1" fill="#450a0a" />
        {state === 'full' && (
          <>
            <rect x="6" y="3" width="1" height="1" fill="#111111" />
            <rect x="5" y="4" width="1" height="1" fill="#450a0a" />
          </>
        )}
      </>
    )}
  </svg>
);

const HungerIcon: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 9 9" className="w-[15px] h-[15px] sm:w-[18px] sm:h-[18px]">
    <path d="M4 1h3v1h1v3H7v1H5v1H4v1H2V7H1V5h1V4h1V2h1V1z" fill="#1b140d" />
    {state !== 'empty' && (
      <path
        d={state === 'full' ? 'M4 2h3v3H6v1H4v1H3V5h1V2z' : 'M5 2h2v3H6v1H5V2z'}
        fill="#b45309"
      />
    )}
    <rect x="2" y="6" width="1" height="1" fill="#e5e5e5" />
  </svg>
);

const ArmorIcon: React.FC<{ state: 'full' | 'half' | 'empty' }> = ({ state }) => (
  <svg viewBox="0 0 9 9" className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]">
    <path d="M1 1h2v1h3V1h2v3H7v4H2V4H1V1z" fill="#18181b" />
    {state !== 'empty' && (
      <path
        d={state === 'full' ? 'M2 2h1v1h3V2h1v5H2V2z' : 'M2 2h1v1h2v4H2V2z'}
        fill="#d4d4d8"
      />
    )}
  </svg>
);

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  atlasCanvas,
  pointerLocked,
  showDebug,
  chatMessages,
  chatOpen,
  advancementToast,
  touchControlsMode,
  onCloseChat,
  onSendChat,
  onRequestLock,
  onSelectHotbar,
  onToggleMute,
  muted,
  onOpenInventory,
  onPauseGame,
  onOpenChat,
  onToggleDebug,
  onToggleCamera,
  onTouchMove,
  onTouchAction,
  onTouchPlaceOrUse,
  onLookDelta,
  onToggleSprint,
  onToggleSneak,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [heldToast, setHeldToast] = useState<string | null>(null);
  const [isCoarseDevice, setIsCoarseDevice] = useState(false);
  const [activeDpad, setActiveDpad] = useState<'fwd' | 'back' | 'left' | 'right' | null>(null);
  const [hotbarSlotSize, setHotbarSlotSize] = useState(44);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSlotRef = useRef<number>(hud.selectedHotbar);
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const dpadPointerRef = useRef<number | null>(null);
  const minePointerRef = useRef<number | null>(null);
  const jumpPointerRef = useRef<number | null>(null);

  useEffect(() => {
    const updateDevice = () => {
      const coarse =
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(any-pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;
      setIsCoarseDevice(coarse);
      setHotbarSlotSize(window.innerWidth < 460 ? 33 : window.innerWidth < 640 ? 38 : 44);
    };
    const onFirstTouch = () => {
      setIsCoarseDevice(true);
    };
    updateDevice();
    window.addEventListener('resize', updateDevice);
    window.addEventListener('touchstart', onFirstTouch, { passive: true });
    return () => {
      window.removeEventListener('resize', updateDevice);
      window.removeEventListener('touchstart', onFirstTouch);
    };
  }, []);

  const showTouchControls =
    touchControlsMode === 'on' || (touchControlsMode === 'auto' && isCoarseDevice);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setChatInput('');
    }
  }, [chatOpen]);

  useEffect(() => {
    if (lastSlotRef.current !== hud.selectedHotbar) {
      lastSlotRef.current = hud.selectedHotbar;
      const item = hud.hotbar[hud.selectedHotbar];
      if (item) {
        setHeldToast(ITEMS[item.id]?.name ?? item.id);
        const t = setTimeout(() => setHeldToast(null), 1600);
        return () => clearTimeout(t);
      } else {
        setHeldToast(null);
      }
    }
  }, [hud.selectedHotbar, hud.hotbar]);

  const startDpad = (
    e: React.PointerEvent<HTMLButtonElement>,
    dir: 'fwd' | 'back' | 'left' | 'right',
    fwd: number,
    strafe: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dpadPointerRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if synthetic event
    }
    setActiveDpad(dir);
    onTouchMove(fwd, strafe);
  };

  const stopDpad = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dpadPointerRef.current !== null && e.pointerId !== dpadPointerRef.current) return;
    dpadPointerRef.current = null;
    setActiveDpad(null);
    onTouchMove(0, 0);
  };

  const now = Date.now();
  const visibleMessages = chatOpen
    ? chatMessages.slice(-8)
    : chatMessages.filter((m) => now - m.timestamp < 7000).slice(-6);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Underwater / Lava / Portal / Damage screen tint */}
      {hud.isUnderwater && (
        <div className="absolute inset-0 bg-[#1e40af]/35 pointer-events-none" />
      )}
      {hud.isInLava && (
        <div className="absolute inset-0 bg-[#ea580c]/45 pointer-events-none" />
      )}
      {hud.portalCharge > 0 && (
        <div
          className="absolute inset-0 bg-[#7e22ce] pointer-events-none"
          style={{ opacity: Math.min(0.65, hud.portalCharge * 0.65) }}
        />
      )}
      {hud.damageFlash > 0 && (
        <div
          className="absolute inset-0 bg-[#dc2626] pointer-events-none"
          style={{ opacity: Math.min(0.42, hud.damageFlash) }}
        />
      )}

      {/* Spyglass Optical Scope Overlay (Java 1.17+ square/circular aperture, zero backdrop-filter) */}
      {hud.isSpyglassZoom && hud.activeContainer === 'none' && !chatOpen && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid slice"
            className="w-full h-full"
          >
            <defs>
              <mask id="spyglass-aperture">
                <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                <rect x="26" y="26" width="48" height="48" rx="4" fill="#000000" />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="#050508"
              mask="url(#spyglass-aperture)"
            />
            <rect
              x="25.5"
              y="25.5"
              width="49"
              height="49"
              rx="4"
              fill="none"
              stroke="#1f2937"
              strokeWidth="1.4"
            />
            <rect
              x="26.3"
              y="26.3"
              width="47.4"
              height="47.4"
              rx="3.4"
              fill="none"
              stroke="#93c5fd"
              strokeOpacity="0.28"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      )}

      {/* Center Crosshair (Bedrock Edition crisp crosshair) */}
      {hud.activeContainer === 'none' && !chatOpen && (
        <div className="absolute inset-0 flex items-center justify-center mix-blend-difference pointer-events-none">
          <svg viewBox="0 0 16 16" className="w-[18px] h-[18px]">
            <rect x="7" y="1" width="2" height="14" fill="#ffffff" />
            <rect x="1" y="7" width="14" height="2" fill="#ffffff" />
          </svg>
        </div>
      )}

      {/* Top-Left Lock Pointer Hint & Bedrock Coordinates Bar */}
      {hud.activeContainer === 'none' && !chatOpen && (
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {!showTouchControls && !pointerLocked && (
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                onRequestLock();
              }}
              className="mc-button px-3 py-1 text-[11px] cursor-pointer pointer-events-auto"
            >
              Lock Mouse (or Drag / Arrows)
            </button>
          )}
          {!showDebug && (
            <div className="bg-black/55 px-2.5 py-1 text-[11px] font-mc-mono text-white mc-text-shadow pointer-events-none">
              Position: {Math.floor(hud.debug.x)}, {Math.floor(hud.debug.y)}, {Math.floor(hud.debug.z)}
            </div>
          )}
        </div>
      )}

      {/* Top-Right Quick Bar (Touch + Audio) */}
      <div className="absolute top-2.5 right-2.5 pointer-events-auto flex items-center gap-1.5">
        {hud.activeContainer === 'none' && !chatOpen && (
          <>
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                onPauseGame();
              }}
              className="mc-button px-2.5 py-1.5 text-[11px] cursor-pointer"
              title="Game Menu (Esc)"
            >
              Menu
            </button>
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenChat();
              }}
              className="mc-button px-2.5 py-1.5 text-[11px] cursor-pointer"
              title="Chat / Commands (T)"
            >
              Chat
            </button>
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleDebug();
              }}
              className="mc-button px-2 py-1.5 text-[11px] cursor-pointer"
              title="Debug Info (F3)"
            >
              F3
            </button>
            <button
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCamera();
              }}
              className="mc-button px-2 py-1.5 text-[11px] cursor-pointer"
              title="Camera Perspective (F5)"
            >
              Cam
            </button>
          </>
        )}
        <button
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="mc-button px-2.5 py-1.5 text-[11px] cursor-pointer"
          title="Toggle Sound"
        >
          {muted ? 'Mute' : 'Sound'}
        </button>
      </div>

      {/* Advancement Made Toast */}
      {advancementToast && (
        <div className="absolute top-12 right-3 z-20 bg-[#212121] border-2 border-[#555555] px-3 py-2 flex items-center gap-2.5 shadow-lg max-w-[270px]">
          <div className="w-7 h-7 bg-[#4c6b22] border border-[#80ff20] flex items-center justify-center text-sm shrink-0">
            ★
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold text-[#fde047] uppercase tracking-wider">
              Advancement Made!
            </span>
            <span className="text-xs text-white font-bold">{advancementToast.title}</span>
            <span className="text-[10px] text-[#d4d4d8]">{advancementToast.description}</span>
          </div>
        </div>
      )}

      {/* Target Block Info */}
      {hud.targetBlock && hud.activeContainer === 'none' && (
        <div className="absolute top-12 sm:top-3 left-1/2 -translate-x-1/2 bg-black/60 px-2.5 py-1 text-[11px] text-white/90 mc-text-shadow whitespace-nowrap">
          {hud.targetBlock.name}
          {hud.targetBlock.breakProgress > 0 && (
            <span className="ml-2 text-[#fde047] font-mc-mono">
              {Math.round(hud.targetBlock.breakProgress * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Bedrock Edition Info / Debug Overlay */}
      {showDebug && (
        <div className="absolute top-14 left-2 right-2 flex justify-between text-[11px] sm:text-[12px] leading-[1.35] font-mc-mono text-white pointer-events-none">
          <div className="flex flex-col items-start gap-0.5">
            <span className="bg-black/50 px-1.5">Minecraft: Bedrock Edition (1.21+ WebGL)</span>
            <span className="bg-black/50 px-1.5">
              {hud.debug.fps} fps · Chunks: {hud.debug.loadedChunks} · Entities: {hud.debug.mobCount}
            </span>
            <span className="bg-black/50 px-1.5">
              XYZ: {hud.debug.x.toFixed(2)} / {hud.debug.y.toFixed(2)} / {hud.debug.z.toFixed(2)}
            </span>
            <span className="bg-black/50 px-1.5">
              Facing: {hud.debug.facing} · Biome: {hud.debug.biome}
            </span>
            <span className="bg-black/50 px-1.5">
              Day {hud.debug.dayCount} · Tick {hud.debug.dayTime} · Weather: {hud.debug.weather}
            </span>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-0.5 mt-6">
            <span className="bg-black/50 px-1.5">Seed: {hud.debug.seed}</span>
            <span className="bg-black/50 px-1.5">
              Dimension: {hud.dimension === 'nether' ? 'The Nether' : 'Overworld'}
            </span>
            <span className="bg-black/50 px-1.5">GameMode: {hud.gameMode}</span>
          </div>
        </div>
      )}

      {/* Chat / Command Feed & Input */}
      {(visibleMessages.length > 0 || chatOpen) && (
        <div className="absolute left-3 bottom-36 sm:bottom-32 w-[min(460px,90vw)] flex flex-col gap-1 z-20">
          <div className="flex flex-col gap-0.5 bg-black/55 px-2.5 py-1.5">
            {visibleMessages.map((m) => (
              <div
                key={m.id}
                className="text-[11px] sm:text-[12px] font-mc-mono leading-snug mc-text-shadow"
                style={{ color: m.color ?? '#ffffff' }}
              >
                {m.text}
              </div>
            ))}
          </div>

          {chatOpen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (chatInput.trim()) onSendChat(chatInput);
                onCloseChat();
              }}
              className="pointer-events-auto flex gap-1"
            >
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onCloseChat();
                  }
                }}
                placeholder="Type chat or /command (/help, /gamemode, /time set, /give)..."
                className="flex-1 bg-black/85 text-white px-2.5 py-1.5 text-xs font-mc-mono border border-white/40 focus:outline-none"
              />
              <button type="submit" className="mc-button px-3 py-1 text-xs cursor-pointer">
                Send
              </button>
            </form>
          )}
        </div>
      )}

      {/* Mobile / Touch Controls Overlay */}
      {showTouchControls && hud.activeContainer === 'none' && !chatOpen && (
        <>
          {/* Transparent Right-Side Camera Look Touch Pad */}
          <div
            className="absolute top-14 right-0 bottom-44 left-[42%] pointer-events-auto touch-none"
            onPointerDown={(e) => {
              if (lookTouchRef.current === null) {
                lookTouchRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
                e.currentTarget.setPointerCapture(e.pointerId);
              }
            }}
            onPointerMove={(e) => {
              if (lookTouchRef.current && lookTouchRef.current.id === e.pointerId) {
                const dx = e.clientX - lookTouchRef.current.x;
                const dy = e.clientY - lookTouchRef.current.y;
                lookTouchRef.current.x = e.clientX;
                lookTouchRef.current.y = e.clientY;
                onLookDelta(dx, dy);
              }
            }}
            onPointerUp={(e) => {
              if (lookTouchRef.current?.id === e.pointerId) {
                lookTouchRef.current = null;
              }
            }}
            onPointerCancel={() => {
              lookTouchRef.current = null;
            }}
          />

          {/* Bottom-Left Touch D-Pad (Bedrock Stone-Beveled Style) */}
          <div className="absolute left-3 bottom-24 sm:bottom-20 grid grid-cols-3 gap-1.5 pointer-events-auto touch-none z-20">
            <div />
            <button
              type="button"
              onPointerDown={(e) => startDpad(e, 'fwd', 1, 0)}
              onPointerUp={stopDpad}
              onPointerCancel={stopDpad}
              onLostPointerCapture={stopDpad}
              className={`w-12 h-12 text-sm font-bold flex items-center justify-center touch-none ${
                activeDpad === 'fwd' ? 'mc-touch-btn-active' : 'mc-touch-btn'
              }`}
              aria-label="Move Forward"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              onPointerDown={(e) => startDpad(e, 'left', 0, -1)}
              onPointerUp={stopDpad}
              onPointerCancel={stopDpad}
              onLostPointerCapture={stopDpad}
              className={`w-12 h-12 text-sm font-bold flex items-center justify-center touch-none ${
                activeDpad === 'left' ? 'mc-touch-btn-active' : 'mc-touch-btn'
              }`}
              aria-label="Strafe Left"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleSprint();
              }}
              className={`w-12 h-12 text-[10px] font-bold flex items-center justify-center touch-none ${
                hud.isSprinting ? 'mc-touch-btn-active' : 'mc-touch-btn'
              }`}
              title="Toggle Sprint"
            >
              RUN
            </button>
            <button
              type="button"
              onPointerDown={(e) => startDpad(e, 'right', 0, 1)}
              onPointerUp={stopDpad}
              onPointerCancel={stopDpad}
              onLostPointerCapture={stopDpad}
              className={`w-12 h-12 text-sm font-bold flex items-center justify-center touch-none ${
                activeDpad === 'right' ? 'mc-touch-btn-active' : 'mc-touch-btn'
              }`}
              aria-label="Strafe Right"
            >
              ▶
            </button>
            <div />
            <button
              type="button"
              onPointerDown={(e) => startDpad(e, 'back', -1, 0)}
              onPointerUp={stopDpad}
              onPointerCancel={stopDpad}
              onLostPointerCapture={stopDpad}
              className={`w-12 h-12 text-sm font-bold flex items-center justify-center touch-none ${
                activeDpad === 'back' ? 'mc-touch-btn-active' : 'mc-touch-btn'
              }`}
              aria-label="Move Backward"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Bottom-Right Touch Action Buttons (Bedrock Stone-Beveled Style) */}
          <div className="absolute right-3 bottom-24 sm:bottom-20 flex flex-col items-end gap-1.5 pointer-events-auto touch-none z-20">
            <div className="flex gap-1.5">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  minePointerRef.current = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore
                  }
                  onTouchAction('mine', true);
                }}
                onPointerUp={(e) => {
                  if (minePointerRef.current === e.pointerId || minePointerRef.current === null) {
                    minePointerRef.current = null;
                    onTouchAction('mine', false);
                  }
                }}
                onPointerCancel={() => {
                  minePointerRef.current = null;
                  onTouchAction('mine', false);
                }}
                onLostPointerCapture={() => {
                  minePointerRef.current = null;
                  onTouchAction('mine', false);
                }}
                className="mc-touch-btn active:bg-[#b91c1c]/80 w-14 h-12 text-[10px] font-bold flex items-center justify-center touch-none"
              >
                ATK
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  onTouchPlaceOrUse();
                }}
                className={`active:bg-[#2563eb]/80 w-14 h-12 text-[10px] font-bold flex items-center justify-center touch-none ${
                  hud.isBlocking || hud.isSpyglassZoom ? 'mc-touch-btn-active' : 'mc-touch-btn'
                }`}
              >
                USE
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleSneak();
                }}
                className={`w-14 h-12 text-[10px] font-bold flex items-center justify-center touch-none ${
                  hud.isSneaking ? 'mc-touch-btn-active' : 'mc-touch-btn'
                }`}
              >
                SNEAK
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  jumpPointerRef.current = e.pointerId;
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore
                  }
                  onTouchAction('jump', true);
                }}
                onPointerUp={(e) => {
                  if (jumpPointerRef.current === e.pointerId || jumpPointerRef.current === null) {
                    jumpPointerRef.current = null;
                    onTouchAction('jump', false);
                  }
                }}
                onPointerCancel={() => {
                  jumpPointerRef.current = null;
                  onTouchAction('jump', false);
                }}
                onLostPointerCapture={() => {
                  jumpPointerRef.current = null;
                  onTouchAction('jump', false);
                }}
                className="mc-touch-btn active:bg-white/35 w-14 h-12 text-[10px] font-bold flex items-center justify-center touch-none"
              >
                JUMP
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom Center Bedrock Edition Survival Vitals + Hotbar */}
      <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 max-w-[98vw]">
        {(hud.isBlocking || hud.isSwimming) && hud.activeContainer === 'none' && (
          <div className="flex items-center gap-1.5 mb-0.5">
            {hud.isBlocking && (
              <span className="bg-black/70 px-2 py-0.5 text-[10px] font-bold text-[#93c5fd] mc-text-shadow">
                Blocking
              </span>
            )}
            {hud.isSwimming && (
              <span className="bg-black/70 px-2 py-0.5 text-[10px] font-bold text-[#67e8f9] mc-text-shadow">
                Swimming
              </span>
            )}
          </div>
        )}

        {heldToast && (
          <div className="bg-black/65 px-2.5 py-0.5 text-[11px] sm:text-xs text-white mc-text-shadow mb-0.5">
            {heldToast}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <div className="flex flex-col items-center gap-1">
            {(hud.gameMode === 'survival' || hud.gameMode === 'hardcore') && (
              <div className="w-full flex flex-col gap-1 px-0.5">
                {/* Top row: Armor (left) & Air Bubbles (right) */}
                {(hud.armor > 0 || hud.isUnderwater) && (
                  <div className="flex justify-between items-center">
                    <div className="flex gap-0.5">
                      {hud.armor > 0 &&
                        Array.from({ length: 10 }).map((_, i) => {
                          const val = hud.armor - i * 2;
                          return (
                            <ArmorIcon
                              key={i}
                              state={val >= 2 ? 'full' : val === 1 ? 'half' : 'empty'}
                            />
                          );
                        })}
                    </div>
                    <div className="flex gap-0.5">
                      {hud.isUnderwater &&
                        Array.from({ length: 10 }).map((_, i) => {
                          const filled = hud.air >= (i + 1) * 2;
                          return (
                            <span
                              key={i}
                              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border border-[#1d4ed8] ${
                                filled ? 'bg-[#60a5fa]' : 'bg-transparent opacity-30'
                              }`}
                            />
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Hearts (left) & Hunger (right) */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const val = hud.health - i * 2;
                      return (
                        <HeartIcon
                          key={i}
                          hardcore={hud.gameMode === 'hardcore'}
                          state={val >= 2 ? 'full' : val === 1 ? 'half' : 'empty'}
                        />
                      );
                    })}
                  </div>
                  <div className="flex gap-0.5 flex-row-reverse">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const val = hud.hunger - i * 2;
                      return (
                        <HungerIcon
                          key={i}
                          state={val >= 2 ? 'full' : val === 1 ? 'half' : 'empty'}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Classic 18-Segment XP Progress Bar */}
                <div className="relative h-[7px] bg-[#161b12] border border-black shadow-[inset_0_1px_0_#0a0d08]">
                  <div
                    className="h-full bg-[#80ff20] border-b border-[#3a7a0c]"
                    style={{ width: `${Math.round(hud.xpProgress * 100)}%` }}
                  />
                  <div
                    className="absolute inset-0 grid pointer-events-none"
                    style={{ gridTemplateColumns: 'repeat(18, 1fr)' }}
                  >
                    {Array.from({ length: 18 }).map((_, i) => (
                      <div key={i} className="border-r border-black/45 last:border-r-0" />
                    ))}
                  </div>
                  {hud.xpLevel > 0 && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-[#80ff20] mc-outline-shadow tabular-nums">
                      {hud.xpLevel}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 9-Slot Bedrock Hotbar */}
            <div className="pointer-events-auto flex items-center gap-[2px] mc-hotbar p-[3px]">
              {hud.hotbar.map((stack, i) => (
                <ItemSlot
                  key={i}
                  stack={stack}
                  atlasCanvas={atlasCanvas}
                  selected={hud.selectedHotbar === i}
                  variant="hotbar"
                  size={hotbarSlotSize}
                  onMouseDown={() => onSelectHotbar(i)}
                />
              ))}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenInventory();
            }}
            className="pointer-events-auto mc-button h-[40px] sm:h-[50px] px-2.5 text-[11px] font-bold cursor-pointer mb-[1px]"
            title="Open Inventory (E)"
          >
            •••
          </button>
        </div>
      </div>
    </div>
  );
};
