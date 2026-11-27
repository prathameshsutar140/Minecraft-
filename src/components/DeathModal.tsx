import React from 'react';

interface DeathModalProps {
  score: number;
  hardcore?: boolean;
  onRespawn: () => void;
  onTitleScreen: () => void;
  onSpectate?: () => void;
  onDeleteAndTitle?: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  score,
  hardcore = false,
  onRespawn,
  onTitleScreen,
  onSpectate,
  onDeleteAndTitle,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#7f1d1d]/75 p-4 gap-4">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mc-text-shadow">
        {hardcore ? 'Game Over!' : 'You Died!'}
      </h1>
      {hardcore && (
        <p className="text-xs sm:text-sm text-[#fca5a5] mc-text-shadow">
          You cannot respawn in Hardcore Mode
        </p>
      )}
      <p className="text-sm text-[#fde047] mc-text-shadow tabular-nums">
        Score: {score}
      </p>
      <div className="w-full max-w-[300px] flex flex-col gap-3 mt-2">
        {hardcore ? (
          <>
            <button
              onClick={onSpectate ?? onRespawn}
              className="mc-button h-11 text-sm cursor-pointer"
            >
              Spectate World
            </button>
            <button
              onClick={onDeleteAndTitle ?? onTitleScreen}
              className="mc-button h-11 text-sm cursor-pointer"
            >
              Delete World &amp; Title
            </button>
          </>
        ) : (
          <>
            <button onClick={onRespawn} className="mc-button h-11 text-sm cursor-pointer">
              Respawn
            </button>
            <button onClick={onTitleScreen} className="mc-button h-11 text-sm cursor-pointer">
              Title Screen
            </button>
          </>
        )}
      </div>
    </div>
  );
};
