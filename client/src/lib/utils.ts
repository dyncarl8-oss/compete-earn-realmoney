import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Audio utilities for game sound effects
export function playRollingSound() {
  try {
    const audio = new Audio('/rolling sound.mp3');
    audio.volume = 0.3; // Keep volume moderate
    audio.play().catch((error) => {
      // Silently handle autoplay restrictions or missing file
      console.debug('Could not play rolling sound:', error);
    });
  } catch (error) {
    // Silently handle any audio errors
    console.debug('Audio playback error:', error);
  }
}
