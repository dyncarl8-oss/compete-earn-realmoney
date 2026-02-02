import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PlayerProfileProps {
  id: string;
  username: string;
  profileImageUrl?: string | null;
  isCurrentTurn?: boolean;
  isCurrentPlayer?: boolean;
  position?: 'bottom' | 'left' | 'top' | 'right' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  className?: string;
  chatBubble?: {
    message: string;
    visible: boolean;
    type: 'category' | 'action' | 'info';
  };
}

const PlayerProfile: React.FC<PlayerProfileProps> = ({
  id,
  username,
  profileImageUrl,
  isCurrentTurn = false,
  isCurrentPlayer = false,
  position = 'bottom',
  className,
  chatBubble
}) => {

  // Determine chat bubble position based on player position
  const getBubblePosition = () => {
    switch (position) {
      case 'bottom':
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
      case 'top':
        return 'top-full mt-2 left-1/2 transform -translate-x-1/2';
      case 'left':
        return 'right-full mr-2 top-1/2 transform -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 transform -translate-y-1/2';
      case 'bottom-left':
        return 'bottom-full mb-2 left-0';
      case 'bottom-right':
        return 'bottom-full mb-2 right-0';
      case 'top-left':
        return 'top-full mt-2 left-0';
      case 'top-right':
        return 'top-full mt-2 right-0';
      default:
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
    }
  };

  // Get arrow direction for chat bubble
  const getArrowClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-green-500';
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-green-500';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-green-500';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-green-500';
      case 'bottom-left':
        return 'top-full left-4 border-l-transparent border-r-transparent border-b-transparent border-t-green-500';
      case 'bottom-right':
        return 'top-full right-4 border-l-transparent border-r-transparent border-b-transparent border-t-green-500';
      case 'top-left':
        return 'bottom-full left-4 border-l-transparent border-r-transparent border-t-transparent border-b-green-500';
      case 'top-right':
        return 'bottom-full right-4 border-l-transparent border-r-transparent border-t-transparent border-b-green-500';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-green-500';
    }
  };

  return (
    <div className={cn('relative flex flex-col items-center space-y-1', className)}>
      {/* Chat Bubble */}
      {chatBubble && chatBubble.visible && (
        <div className={cn('absolute z-20 animate-in fade-in zoom-in duration-300', getBubblePosition())}>
          <div className={cn(
            'relative px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg max-w-[120px] text-center',
            chatBubble.type === 'category' ? 'bg-green-500' : 
            chatBubble.type === 'action' ? 'bg-blue-500' : 'bg-gray-500'
          )}>
            {chatBubble.message}
            {/* Speech bubble arrow */}
            <div 
              className={cn('absolute w-0 h-0 border-4', getArrowClasses())}
            />
          </div>
        </div>
      )}

      {/* Avatar with minimal indicators - just colored rings */}
      <Avatar className={cn(
        'w-12 h-12',
        isCurrentTurn && isCurrentPlayer ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-400/30' : 
        isCurrentTurn ? 'ring-2 ring-green-400 shadow-lg shadow-green-400/30' : 
        isCurrentPlayer ? 'ring-2 ring-blue-400 shadow-lg shadow-blue-400/30' : ''
      )}>
        <AvatarImage src={profileImageUrl || undefined} alt={username} />
        <AvatarFallback className="bg-slate-700 text-slate-300 text-sm">
          {username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Player Name */}
      <div className={cn(
        'text-xs font-medium truncate max-w-[80px] text-center',
        isCurrentTurn && isCurrentPlayer ? 'text-purple-300' :
        isCurrentTurn ? 'text-green-300' : 
        isCurrentPlayer ? 'text-blue-300' : 'text-slate-300'
      )}>
        {username}
      </div>
    </div>
  );
};

export default PlayerProfile;