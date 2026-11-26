import React from 'react';
import { ItemStack } from '../types/game';
import { ITEMS } from '../data/itemsAndBlocks';
import { getItemIconUrl } from '../engine/textures';

interface ItemSlotProps {
  stack: ItemStack | null;
  atlasCanvas: HTMLCanvasElement | null;
  selected?: boolean;
  size?: number;
  variant?: 'inventory' | 'hotbar';
  placeholder?: string;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const ItemSlot: React.FC<ItemSlotProps> = ({
  stack,
  atlasCanvas,
  selected = false,
  size = 44,
  variant = 'inventory',
  placeholder,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}) => {
  const def = stack ? ITEMS[stack.id] : null;
  const iconUrl = stack && atlasCanvas ? getItemIconUrl(stack.id, atlasCanvas) : null;
  const maxDur = def?.maxDurability;
  const durRatio =
    stack && maxDur && stack.durability !== undefined
      ? Math.max(0, Math.min(1, stack.durability / maxDur))
      : null;

  const titleText = def
    ? stack?.enchantment
      ? `${def.name} (${stack.enchantment.label} ${stack.enchantment.level})`
      : def.name
    : undefined;

  const slotClass = selected
    ? 'bg-[#6b6b6b]/85 border-[3px] border-[#f8fafc] shadow-[inset_0_0_0_2px_#525252,0_0_0_2px_#000000] scale-[1.06] z-10'
    : variant === 'hotbar'
      ? stack?.enchantment
        ? 'mc-hotbar-slot ring-1 ring-inset ring-[#c084fc]'
        : 'mc-hotbar-slot'
      : stack?.enchantment
        ? 'mc-slot ring-1 ring-inset ring-[#c084fc]'
        : 'mc-slot';

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center shrink-0 select-none ${slotClass}`}
      title={titleText}
    >
      {stack?.enchantment && (
        <div className="absolute inset-0 bg-[#a855f7]/18 pointer-events-none" />
      )}

      {!stack && placeholder && (
        <span className="text-[10px] text-[#555555] font-mc pointer-events-none">
          {placeholder}
        </span>
      )}

      {stack && iconUrl && (
        <img
          src={iconUrl}
          alt={def?.name ?? stack.id}
          draggable={false}
          className="w-[74%] h-[74%] pixelated pointer-events-none"
        />
      )}

      {stack && stack.enchantment && (
        <span className="absolute top-0.5 left-0.5 text-[9px] leading-none font-bold text-[#e9d5ff] mc-text-shadow pointer-events-none">
          ✦
        </span>
      )}

      {stack && stack.count > 1 && (
        <span className="absolute bottom-0.5 right-1 text-[12px] leading-none font-bold text-white mc-text-shadow tabular-nums pointer-events-none">
          {stack.count}
        </span>
      )}

      {durRatio !== null && durRatio < 1 && (
        <div className="absolute bottom-1 left-1 right-1 h-1 bg-[#1e1e1e] pointer-events-none">
          <div
            className="h-full"
            style={{
              width: `${Math.round(durRatio * 100)}%`,
              backgroundColor:
                durRatio > 0.5 ? '#22c55e' : durRatio > 0.25 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
      )}
    </div>
  );
};
