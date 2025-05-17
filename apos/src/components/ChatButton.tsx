'use client';

import React from 'react';

interface ChatButtonProps {
  onClick: () => void;
  hasNewMessages: boolean;
}

export default function ChatButton({ onClick, hasNewMessages }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white p-3 rounded-full hover:shadow-lg hover:from-[#4338CA] hover:to-[#6D28D9] shadow-md transition-all relative"
      title="Abrir Chat de Suporte"
      style={{ 
        filter: hasNewMessages ? 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.5))' : 'none',
        animation: hasNewMessages ? 'pulse 2s infinite' : 'none'
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {hasNewMessages && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-sm">
          !
        </span>
      )}
    </button>
  );
}