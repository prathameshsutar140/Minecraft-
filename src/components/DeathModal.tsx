import React from 'react';

interface DeathModalProps {
  score: number;
  onRespawn: () => void;
  onTitleScreen: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  score,
  onRespawn,
  onTitleScreen,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center bg-[#7f1d1d]/75 p-4 gap-5">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mc-text-shadow">
        You Died!
      </h1>
      <p className="text-sm text-[#fde047] mc-text-shadow tabular-nums">
        Score: {score}
      </p>
      <div className="w-full max-w-[300px] flex flex-col gap-3 mt-2">
        <button onClick={onRespawn} className="mc-button h-11 text-sm cursor-pointer">
          Respawn
        </button>
        <button onClick={onTitleScreen} className="mc-button h-11 text-sm cursor-pointer">
          Title Screen
        </button>
      </div>
    </div>
  );
};
