import React, { useState } from 'react';
import { GameMode, GameOptions } from '../types/game';

interface PauseModalProps {
  gameMode: GameMode;
  options: GameOptions;
  onResume: () => void;
  onSaveAndQuit: () => void;
  onCommand: (cmd: string) => void;
  onUpdateOptions: (next: Partial<GameOptions>) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  gameMode,
  options,
  onResume,
  onSaveAndQuit,
  onCommand,
  onUpdateOptions,
}) => {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
      {!showOptions ? (
        <div className="w-full max-w-[380px] flex flex-col gap-3">
          <h2 className="text-center text-lg font-bold text-white mc-text-shadow mb-2">
            Game Menu
          </h2>
          <button onClick={onResume} className="mc-button h-11 text-sm cursor-pointer">
            Back to Game
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                onCommand(`/gamemode ${gameMode === 'survival' ? 'creative' : 'survival'}`)
              }
              className="mc-button h-10 text-xs cursor-pointer"
            >
              Mode: {gameMode === 'survival' ? 'Survival' : 'Creative'}
            </button>
            <button
              onClick={() => onCommand('/time set day')}
              className="mc-button h-10 text-xs cursor-pointer"
            >
              Set Day
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCommand('/time set night')}
              className="mc-button h-10 text-xs cursor-pointer"
            >
              Set Night
            </button>
            <button
              onClick={() => onCommand('/weather rain')}
              className="mc-button h-10 text-xs cursor-pointer"
            >
              Toggle Rain
            </button>
          </div>

          <button
            onClick={() => setShowOptions(true)}
            className="mc-button h-11 text-sm cursor-pointer"
          >
            Options...
          </button>

          <button
            onClick={onSaveAndQuit}
            className="mc-button h-11 text-sm cursor-pointer mt-2"
          >
            Save and Quit to Title
          </button>
        </div>
      ) : (
        <div className="mc-panel w-full max-w-[420px] p-5 text-[#1f1f1f] flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#7a7a7a] pb-2">
            <h2 className="text-sm font-bold">Options</h2>
            <button
              onClick={() => setShowOptions(false)}
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
              <span>Volume</span>
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
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => onUpdateOptions({ muted: !options.muted })}
              className="mc-button flex-1 min-w-[100px] h-9 text-xs cursor-pointer"
            >
              Audio: {options.muted ? 'OFF' : 'ON'}
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
              className="mc-button flex-1 min-w-[130px] h-9 text-xs cursor-pointer"
            >
              Touch: {options.touchControls.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
