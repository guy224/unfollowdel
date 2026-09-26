import { AlertCircle, Camera, Loader2, Play, BookOpen } from 'lucide-react';
import UserAvatar from './UserAvatar';

export default function Status({ authState, onStartScan }) {
  if (authState.isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-pink-500" />
        <p>בודק חיבור לאינסטגרם...</p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0A0A0A]">
        <div className="w-16 h-16 mb-8 rounded-2xl bg-[#111] border border-[#333] flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-[#A1A1AA]" />
        </div>
        <h2 className="text-xl font-medium text-[#EDEDED] mb-3 tracking-tight">אינך מחובר</h2>
        <p className="text-[#A1A1AA] mb-10 text-sm leading-relaxed max-w-[240px]">
          כדי להתחיל, יש להתחבר לחשבון האינסטגרם בדפדפן.
        </p>

        <a 
          href="https://www.instagram.com" 
          target="_blank" 
          rel="noreferrer"
          className="group w-full max-w-[260px] flex justify-center items-center gap-2 bg-[#EDEDED] hover:bg-white text-black py-3 px-6 rounded-lg font-medium text-sm transition-all"
        >
          <Camera className="w-4 h-4" />
          <span>התחבר לאינסטגרם</span>
        </a>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0A0A0A]">
      <div className="w-20 h-20 relative mb-8">
        <div className="absolute inset-0 bg-white/5 rounded-full animate-pulse blur-md"></div>
        <UserAvatar 
          src={authState.user.profilePic} 
          username={authState.user.username}
          className="w-full h-full border border-[#333] relative z-10" 
          textClassName="text-2xl"
        />
      </div>
      
      <h2 className="text-2xl font-medium text-[#EDEDED] mb-2 tracking-tight">שלום, {authState.user.username}</h2>
      <p className="text-[#A1A1AA] mb-10 text-sm">הכל מוכן לתחילת הסריקה.</p>
      
      <button 
        onClick={onStartScan}
        className="group relative w-full max-w-[260px] flex justify-center items-center gap-2 bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] hover:opacity-90 text-white py-3.5 px-6 rounded-lg font-bold text-sm transition-all shadow-lg shadow-pink-500/10"
      >
        <Play className="w-4 h-4 fill-current" />
        <span>התחל סריקה</span>
      </button>

      <div className="mt-4 flex items-center gap-3 text-xs text-[#555]">
        <button
          onClick={() => {
            const url = typeof chrome !== 'undefined' && chrome.runtime
              ? chrome.runtime.getURL('onboarding.html')
              : 'onboarding.html';
            window.open(url, '_blank');
          }}
          className="flex items-center gap-1.5 hover:text-[#A1A1AA] transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          כיצד להשתמש?
        </button>
        <span>•</span>
        <button
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: 'privacy.html' });
            } else {
              window.open('privacy.html', '_blank');
            }
          }}
          className="hover:text-[#A1A1AA] transition-colors underline underline-offset-2 cursor-pointer"
        >
          מדיניות פרטיות
        </button>
      </div>
    </div>
  );
}
