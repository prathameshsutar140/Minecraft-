import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancementToast,
  ChatMessage,
  ChestState,
  EnchantmentData,
  FurnaceState,
  GameMode,
  GameOptions,
  GamePhase,
  HudSnapshot,
  ItemId,
  ItemStack,
} from './types/game';
import { getSavedWorldSummary, MinecraftEngine, SaveSummary } from './engine/gameEngine';
import { TitleScreen } from './components/TitleScreen';
import { HudOverlay } from './components/HudOverlay';
import { InventoryModal } from './components/InventoryModal';
import { PauseModal } from './components/PauseModal';
import { DeathModal } from './components/DeathModal';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MinecraftEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [advancementToast, setAdvancementToast] = useState<AdvancementToast | null>(null);
  const [savedWorld, setSavedWorld] = useState<SaveSummary | null>(() => getSavedWorldSummary());
  const [options, setOptions] = useState<GameOptions>({
    fov: 75,
    renderDistance: 4,
    mouseSensitivity: 1.0,
    soundVolume: 0.65,
    muted: false,
    showClouds: true,
    graphicsQuality: 'vibrant',
    cloudStyle: 'fancy',
    leafQuality: 'fancy',
    touchControls: 'auto',
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let toastTimer: number | undefined;
    const engine = new MinecraftEngine(el, {
      onHudUpdate: (snap) => setHud(snap),
      onPhaseChange: (nextPhase) => {
        setPhase(nextPhase);
        if (nextPhase === 'title') {
          setSavedWorld(getSavedWorldSummary());
          setChatOpen(false);
        }
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-24), msg]);
      },
      onPointerLockChange: (locked) => setPointerLocked(locked),
      onAdvancement: (toast) => {
        setAdvancementToast(toast);
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => setAdvancementToast(null), 4500);
      },
    });

    engineRef.current = engine;
    engine.updateOptions(options);
    return () => {
      window.clearTimeout(toastTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Global hotkeys for Escape (Pause / Close Container / Close Chat), F3 (Debug), T & / (Chat)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      if (e.code === 'F3' && phase === 'playing') {
        e.preventDefault();
        setShowDebug((v) => !v);
        return;
      }

      if ((e.code === 'KeyT' || e.key === '/') && phase === 'playing' && hud?.activeContainer === 'none') {
        e.preventDefault();
        engine.exitPointerLock();
        setChatOpen(true);
        return;
      }

      if (e.code === 'Escape') {
        if (chatOpen) {
          setChatOpen(false);
          engine.requestPointerLock();
          return;
        }
        if (phase === 'playing') {
          if (hud && hud.activeContainer !== 'none') {
            engine.closeContainer();
          } else {
            engine.exitPointerLock();
            engine.phase = 'paused';
            setPhase('paused');
          }
        } else if (phase === 'paused') {
          engine.resumeGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, hud, chatOpen]);

  const handleStartNew = useCallback((seed: number, mode: GameMode, bonusChest: boolean) => {
    setChatMessages([]);
    setAdvancementToast(null);
    engineRef.current?.startNewGame(seed, mode, bonusChest);
  }, []);

  const handleContinueSaved = useCallback(() => {
    setChatMessages([]);
    setAdvancementToast(null);
    engineRef.current?.loadSavedGame();
  }, []);

  const handleUpdateOptions = useCallback((next: Partial<GameOptions>) => {
    setOptions((prev) => {
      const merged = { ...prev, ...next };
      engineRef.current?.updateOptions(merged);
      return merged;
    });
  }, []);

  const handleSetSlot = useCallback(
    (zone: 'hotbar' | 'inventory' | 'armor', index: number, stack: ItemStack | null) => {
      engineRef.current?.setInventorySlot(zone, index, stack);
    },
    []
  );

  const handleUpdateFurnace = useCallback((posKey: string, state: FurnaceState) => {
    engineRef.current?.updateFurnaceState(posKey, state);
  }, []);

  const handleUpdateChest = useCallback((posKey: string, state: ChestState) => {
    engineRef.current?.updateChestState(posKey, state);
  }, []);

  const handleGiveCreativeItem = useCallback((id: ItemId, count: number) => {
    engineRef.current?.giveItem(id, count);
  }, []);

  const handleEnchantItem = useCallback(
    (zone: 'hotbar' | 'inventory', index: number, enchantment: EnchantmentData, xpCost: number) => {
      return engineRef.current?.enchantSlotItem(zone, index, enchantment, xpCost) ?? false;
    },
    []
  );

  const handleCommand = useCallback((raw: string) => {
    engineRef.current?.executeCommand(raw);
  }, []);

  const atlasCanvas = engineRef.current?.getAtlasCanvas() ?? null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#111318]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full touch-none" />

      {phase === 'title' && (
        <TitleScreen
          savedWorld={savedWorld}
          options={options}
          onStartNew={handleStartNew}
          onContinueSaved={handleContinueSaved}
          onUpdateOptions={handleUpdateOptions}
        />
      )}

      {phase === 'playing' && hud && (
        <>
          <HudOverlay
            hud={hud}
            atlasCanvas={atlasCanvas}
            pointerLocked={pointerLocked}
            showDebug={showDebug}
            chatMessages={chatMessages}
            chatOpen={chatOpen}
            advancementToast={advancementToast}
            touchControlsMode={options.touchControls}
            onCloseChat={() => {
              setChatOpen(false);
              engineRef.current?.requestPointerLock();
            }}
            onSendChat={handleCommand}
            onRequestLock={() => engineRef.current?.requestPointerLock()}
            onSelectHotbar={(idx) => engineRef.current?.selectHotbarSlot(idx)}
            onToggleMute={() => handleUpdateOptions({ muted: !options.muted })}
            muted={options.muted}
            onOpenInventory={() => {
              const engine = engineRef.current;
              if (!engine) return;
              engine.openContainer(hud.gameMode === 'creative' ? 'creative' : 'inventory');
            }}
            onPauseGame={() => {
              const engine = engineRef.current;
              if (!engine) return;
              engine.exitPointerLock();
              engine.phase = 'paused';
              setPhase('paused');
            }}
            onOpenChat={() => {
              engineRef.current?.exitPointerLock();
              setChatOpen(true);
            }}
            onToggleDebug={() => setShowDebug((v) => !v)}
            onToggleCamera={() => engineRef.current?.toggleCameraMode()}
            onTouchMove={(fwd, strafe) => engineRef.current?.setTouchMove(fwd, strafe)}
            onTouchAction={(action, pressed) => engineRef.current?.setTouchAction(action, pressed)}
            onTouchPlaceOrUse={() => engineRef.current?.triggerTouchPlaceOrUse()}
            onLookDelta={(dx, dy) => engineRef.current?.addLookDelta(dx, dy)}
            onToggleSprint={() => engineRef.current?.toggleSprint()}
            onToggleSneak={() => engineRef.current?.toggleSneak()}
          />

          {hud.activeContainer !== 'none' && (
            <InventoryModal
              hud={hud}
              atlasCanvas={atlasCanvas}
              onClose={() => engineRef.current?.closeContainer()}
              onSetSlot={handleSetSlot}
              onUpdateFurnace={handleUpdateFurnace}
              onUpdateChest={handleUpdateChest}
              onGiveCreativeItem={handleGiveCreativeItem}
              onEnchantItem={handleEnchantItem}
            />
          )}
        </>
      )}

      {phase === 'paused' && (
        <PauseModal
          gameMode={hud?.gameMode ?? 'survival'}
          options={options}
          onResume={() => engineRef.current?.resumeGame()}
          onSaveAndQuit={() => engineRef.current?.saveAndQuitToTitle()}
          onCommand={(cmd) => {
            engineRef.current?.executeCommand(cmd);
          }}
          onUpdateOptions={handleUpdateOptions}
        />
      )}

      {phase === 'dead' && (
        <DeathModal
          score={hud?.score ?? 0}
          hardcore={hud?.gameMode === 'hardcore'}
          onRespawn={() => engineRef.current?.respawnPlayer()}
          onTitleScreen={() => engineRef.current?.saveAndQuitToTitle()}
          onSpectate={() => engineRef.current?.spectateHardcoreWorld()}
          onDeleteAndTitle={() => engineRef.current?.clearSavedWorld()}
        />
      )}
    </main>
  );
}
