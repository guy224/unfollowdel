import { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus } from '../utils/instagramApi';
import Status from './components/Status';
import Scanner from './components/Scanner';
import Dashboard from './components/Dashboard';
import UserAvatar from './components/UserAvatar';

function App() {
  const [authState, setAuthState] = useState({ isLoading: true, isAuthenticated: false, user: null });
  const [currentView, setCurrentView] = useState('status'); // 'status', 'scanning', 'dashboard'
  
  // App State Data
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    // 1. Instantly read cached user from chrome.storage.local to eliminate flashing
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['ig_cached_user'], (res) => {
        if (res?.ig_cached_user?.username && !res.ig_cached_user.username.startsWith('user_')) {
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            user: res.ig_cached_user
          });
        }
      });
    }

    // 2. Perform fresh auth check & update cache in background
    const initAuth = async () => {
      const auth = await checkAuthStatus();
      setAuthState({
        isLoading: false,
        isAuthenticated: auth.isAuthenticated,
        user: auth.user
      });
    };
    initAuth();
  }, []);

  const handleScanComplete = (followersData, followingData) => {
    setFollowers(followersData);
    setFollowing(followingData);
    setCurrentView('dashboard');
  };

  const handleSilentRescan = useCallback((f, fl) => {
    setFollowers(f);
    setFollowing(fl);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0A] text-[#EDEDED] font-sans selection:bg-white/30">
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-[#222]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src="./logo.svg" alt="UnfollowDel Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-clip-text text-transparent">
            UnfollowDel
          </h1>
        </div>
        {authState.user && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#222] bg-[#111]">
            <span className="text-xs font-medium text-[#A1A1AA] max-w-[120px] truncate">{authState.user.username}</span>
            <UserAvatar 
              src={authState.user.profilePic} 
              username={authState.user.username}
              className="w-6 h-6 border border-[#222]" 
              textClassName="text-[10px]"
            />
          </div>
        )}
      </header>

      <main className="flex-1 w-full relative flex flex-col overflow-hidden">
        {currentView === 'status' && (
          <Status 
            authState={authState} 
            onStartScan={() => setCurrentView('scanning')} 
          />
        )}
        
        {currentView === 'scanning' && (
          <Scanner 
            onComplete={handleScanComplete} 
            onCancel={() => setCurrentView('status')}
          />
        )}
        
        {currentView === 'dashboard' && (
          <Dashboard 
            currentUser={authState.user}
            followers={followers} 
            following={following}
            onBack={() => setCurrentView('status')}
            onRescan={() => setCurrentView('scanning')}
            onSilentRescan={handleSilentRescan}
          />
        )}
      </main>
      
      {/* Subtle Bottom Footer */}
      <footer className="w-full px-4 py-2 border-t border-[#1a1a1a] flex justify-between items-center text-[11px] text-[#71717A] bg-[#0A0A0A]/90 select-none">
        <span>UnfollowDel v1.0</span>
        <button
          type="button"
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: 'privacy.html' });
            } else {
              window.open('privacy.html', '_blank');
            }
          }}
          className="hover:text-[#EDEDED] transition-colors underline underline-offset-2 cursor-pointer"
        >
          מדיניות פרטיות
        </button>
      </footer>
    </div>
  );
}

export default App;
