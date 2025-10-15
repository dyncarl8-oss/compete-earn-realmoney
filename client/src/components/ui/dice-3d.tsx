import React from 'react';
import { cn } from '@/lib/utils';

interface Dice3DProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  held?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isRolling?: boolean;
}

const Dice3D: React.FC<Dice3DProps> = ({
  value,
  held = false,
  disabled = false,
  onClick,
  className,
  size = 'md',
  isRolling = false,
  ...rest
}) => {
  // Size configurations
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const dotSizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5'
  };

  // Dice face patterns for each number
  const renderDots = (num: number) => {
    const dotClass = cn(
      'absolute rounded-full',
      dotSizeClasses[size],
      held ? 'bg-yellow-900' : 'bg-slate-800'
    );

    const patterns = {
      1: (
        <div className={cn(dotClass, 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2')} />
      ),
      2: (
        <>
          <div className={cn(dotClass, 'top-1/4 left-1/4')} />
          <div className={cn(dotClass, 'bottom-1/4 right-1/4')} />
        </>
      ),
      3: (
        <>
          <div className={cn(dotClass, 'top-1/4 left-1/4')} />
          <div className={cn(dotClass, 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2')} />
          <div className={cn(dotClass, 'bottom-1/4 right-1/4')} />
        </>
      ),
      4: (
        <>
          <div className={cn(dotClass, 'top-1/4 left-1/4')} />
          <div className={cn(dotClass, 'top-1/4 right-1/4')} />
          <div className={cn(dotClass, 'bottom-1/4 left-1/4')} />
          <div className={cn(dotClass, 'bottom-1/4 right-1/4')} />
        </>
      ),
      5: (
        <>
          <div className={cn(dotClass, 'top-1/4 left-1/4')} />
          <div className={cn(dotClass, 'top-1/4 right-1/4')} />
          <div className={cn(dotClass, 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2')} />
          <div className={cn(dotClass, 'bottom-1/4 left-1/4')} />
          <div className={cn(dotClass, 'bottom-1/4 right-1/4')} />
        </>
      ),
      6: (
        <>
          <div className={cn(dotClass, 'top-1/4 left-1/4')} />
          <div className={cn(dotClass, 'top-1/4 right-1/4')} />
          <div className={cn(dotClass, 'top-1/2 left-1/4 transform -translate-y-1/2')} />
          <div className={cn(dotClass, 'top-1/2 right-1/4 transform -translate-y-1/2')} />
          <div className={cn(dotClass, 'bottom-1/4 left-1/4')} />
          <div className={cn(dotClass, 'bottom-1/4 right-1/4')} />
        </>
      )
    };

    return patterns[num as keyof typeof patterns];
  };

  return (
    <button
      {...rest}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative rounded-lg border-2 transition-all duration-300 transform-gpu',
        sizeClasses[size],
        // 3D effect with shadows and gradients
        'shadow-lg hover:shadow-xl',
        // Dice face styling
        held
          ? 'bg-gradient-to-br from-yellow-200 to-yellow-400 border-yellow-500/70'
          : 'bg-gradient-to-br from-slate-100 to-slate-300 border-slate-400',
        // Interaction states
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer hover:scale-105 active:scale-95',
        // Rolling animation
        isRolling && 'animate-spin',
        // Custom 3D transform for depth
        'before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-t before:from-black/20 before:to-transparent before:pointer-events-none',
        className
      )}
      style={{
        boxShadow: held
          ? '0 4px 8px rgba(234, 179, 8, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 0 rgba(0, 0, 0, 0.2)'
          : '0 4px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Dice dots */}
      <div className="relative w-full h-full">
        {renderDots(value)}
      </div>
      
      {/* Hold indicator */}
      {held && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold shadow-lg border border-yellow-600">
          HOLD
        </div>
      )}

    </button>
  );
};

export default Dice3D;