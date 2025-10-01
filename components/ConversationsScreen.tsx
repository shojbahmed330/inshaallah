import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Conversation, AppView, Message } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { getTtsPrompt } from '../constants';
import { useSettings } from '../contexts/SettingsContext';
import { firebaseService } from '../services/firebaseService';

const SWIPE_THRESHOLD = -80;
const SWIPE_ACTION_WIDTH = 70;

// Re-engineered ConversationItem to be a stateful, interactive component
const ConversationItem: React.FC<{
  conversation: Conversation;
  currentUserId: string;
  isPinned: boolean;
  isNew: boolean;
  style: React.CSSProperties;
  onClick: () => void;
  onPinToggle: (peerId: string) => void;
}> = ({ conversation, currentUserId, isPinned, isNew, style, onClick, onPinToggle }) => {
    const { peer, lastMessage, unreadCount } = conversation;
    
    // Swipe and Long Press State
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiped, setIsSwiped] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    const swipeRef = useRef<HTMLDivElement>(null);
    const touchStart = useRef({ x: 0, y: 0, time: 0 });
    const longPressTimeout = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY, time: Date.now() };
        setIsSwiped(false);
        
        longPressTimeout.current = window.setTimeout(() => {
            setContextMenu({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
            longPressTimeout.current = null;
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaX = e.targetTouches[0].clientX - touchStart.current.x;
        const deltaY = Math.abs(e.targetTouches[0].clientY - touchStart.current.y);

        if (Math.abs(deltaX) > deltaY + 10) { // Prioritize horizontal movement for swipe
             if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
             if (deltaX < 0 && deltaX > SWIPE_THRESHOLD * 2.5) {
                setSwipeX(deltaX);
            }
        } else {
             if (longPressTimeout.current) clearTimeout(longPressTimeout.current);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimeout.current) clearTimeout(longPressTimeout.current);

        if (swipeX < SWIPE_THRESHOLD) {
            setSwipeX(-SWIPE_ACTION_WIDTH * 3);
            setIsSwiped(true);
        } else {
            setSwipeX(0);
            setIsSwiped(false);
        }

        const pressDuration = Date.now() - touchStart.current.time;
        if (pressDuration < 200 && Math.abs(swipeX) < 10 && !contextMenu) {
            onClick();
        }
    };

    const handleActionClick = (action: 'pin' | 'mute' | 'delete', e: React.MouseEvent) => {
        e.stopPropagation();
        if (action === 'pin') onPinToggle(peer.id);
        // Mute and Delete are placeholders for now
        else alert(`${action.charAt(0).toUpperCase() + action.slice(1)} action clicked.`);
        setSwipeX(0);
        setIsSwiped(false);
    };

    if (!lastMessage) return null; // Simplified: Don't show empty conversations for now

    const isLastMessageFromMe = lastMessage.senderId === currentUserId;
    const timeAgo = new Date(lastMessage.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const getSnippet = (message: Message): string => {
        if (message.isDeleted) return isLastMessageFromMe ? "You unsent a message" : "Unsent a message";
        const prefix = isLastMessageFromMe ? 'You: ' : '';
        switch (message.type) {
            case 'text': return prefix + (message.text || '');
            case 'image': return prefix + 'Sent an image 📷';
            case 'video': return prefix + 'Sent a video 📹';
            case 'audio': return prefix + `Voice message · ${message.duration}s`;
            default: return prefix + `Voice message · ${message.duration}s`;
        }
    };
    const snippet = getSnippet(lastMessage);

    const actionButtonClasses = "w-[70px] h-full flex flex-col items-center justify-center text-white font-semibold transition-colors";

    return (
        <div 
            style={style}
            className={`w-full relative overflow-hidden rounded-lg animate-list-item-slide-in ${isNew ? 'animate-glow' : ''}`}
        >
            {/* Swipe Actions */}
            <div className="absolute top-0 right-0 h-full flex">
                <button onClick={(e) => handleActionClick('pin', e)} className={`${actionButtonClasses} bg-sky-600 hover:bg-sky-500`}><Icon name="pin" className="w-6 h-6"/>{isPinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={(e) => handleActionClick('mute', e)} className={`${actionButtonClasses} bg-indigo-600 hover:bg-indigo-500`}><Icon name="bell-slash" className="w-6 h-6"/>Mute</button>
                <button onClick={(e) => handleActionClick('delete', e)} className={`${actionButtonClasses} bg-red-600 hover:bg-red-500`}><Icon name="trash" className="w-6 h-6"/>Delete</button>
            </div>
            
            {/* Main Content */}
            <div
                ref={swipeRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`w-full text-left p-3 flex items-center gap-4 rounded-lg transition-transform duration-200 ease-out bg-slate-800/80 active:bg-slate-700/80`}
                style={{ transform: `translateX(${swipeX}px)` }}
            >
                <div className="relative flex-shrink-0">
                    <img src={peer.avatarUrl} alt={peer.name} className="w-14 h-14 rounded-full" />
                    <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${peer.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'}`}/>
                    {unreadCount > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-fuchsia-500 border-2 border-slate-800" />}
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-baseline">
                        <p className={`font-bold text-lg truncate ${unreadCount > 0 ? 'text-white' : 'text-slate-200'}`}>{peer.name}</p>
                        <p className="text-xs text-slate-400 flex-shrink-0">{timeAgo}</p>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className={`text-sm truncate ${unreadCount > 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>{snippet}</p>
                        {unreadCount > 0 && (
                            <span className="flex-shrink-0 ml-4 w-6 h-6 bg-fuchsia-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
                        )}
                    </div>
                </div>
            </div>
            {/* Long Press Context Menu */}
            {contextMenu && (
                <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
                    <div
                        className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 text-white animate-context-menu-fade-in text-sm"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button onClick={() => onPinToggle(peer.id)} className="w-full text-left px-4 py-2 hover:bg-slate-700">Pin Chat</button>
                        <button className="w-full text-left px-4 py-2 hover:bg-slate-700">Mute Notifications</button>
                        <button className="w-full text-left px-4 py-2 hover:bg-slate-700">Mark as Read</button>
                        <div className="border-t border-slate-700 my-1"></div>
                        <button className="w-full text-left px-4 py-2 text-red-400 hover:bg-red-500/10">Delete Chat</button>
                    </div>
                </div>
            )}
        </div>
    );
};


const ConversationsScreen: React.FC<any> = ({ currentUser, onOpenConversation, onSetTtsMessage, lastCommand, onCommandProcessed, onGoBack }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set());
  const [newlyUpdatedChatId, setNewlyUpdatedChatId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  
  const { language } = useSettings();
  const prevConvosRef = useRef<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load pinned chats from local storage
    const savedPins = localStorage.getItem(`pinnedChats_${currentUser.id}`);
    if (savedPins) {
        setPinnedChats(new Set(JSON.parse(savedPins)));
    }

    const unsubscribe = firebaseService.listenToConversations(currentUser.id, (convos) => {
      setConversations(convos);

      if (isLoading) {
        onSetTtsMessage(getTtsPrompt('conversations_loaded', language));
        setIsLoading(false);
      }
      
      convos.forEach(convo => {
          const prevLastMsgId = prevConvosRef.current.get(convo.peer.id);
          if (convo.lastMessage && convo.lastMessage.senderId !== currentUser.id && prevLastMsgId !== convo.lastMessage.id) {
            setNewlyUpdatedChatId(convo.peer.id);
            setTimeout(() => setNewlyUpdatedChatId(null), 1600);
          }
          if (convo.lastMessage) {
            prevConvosRef.current.set(convo.peer.id, convo.lastMessage.id);
          }
      });
    });

    return () => unsubscribe();
  }, [currentUser.id, onSetTtsMessage, language, isLoading]);
  
  const handleScroll = () => {
    if(scrollRef.current) {
        setScrolled(scrollRef.current.scrollTop > 20);
    }
  }
  
  const handlePinToggle = (peerId: string) => {
    const newPins = new Set(pinnedChats);
    if (newPins.has(peerId)) newPins.delete(peerId);
    else newPins.add(peerId);
    setPinnedChats(newPins);
    localStorage.setItem(`pinnedChats_${currentUser.id}`, JSON.stringify(Array.from(newPins)));
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => c.peer.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery]);
  
  const pinnedConvos = useMemo(() => {
    return filteredConversations.filter(c => pinnedChats.has(c.peer.id));
  }, [filteredConversations, pinnedChats]);
  
  const recentConvos = useMemo(() => {
    return filteredConversations.filter(c => !pinnedChats.has(c.peer.id));
  }, [filteredConversations, pinnedChats]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><p className="text-slate-300 text-xl">Loading conversations...</p></div>;
  }

  return (
    <div className="h-full w-full flex flex-col bg-slate-900">
      <header className={`sticky top-0 z-20 flex-shrink-0 px-4 pt-4 transition-all duration-300 ${scrolled ? 'bg-slate-900/80 backdrop-blur-md pb-2' : 'pb-0'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
            <h1 className={`font-bold text-slate-100 transition-all duration-300 ${scrolled ? 'text-xl' : 'text-3xl'}`}>Messages</h1>
            {!scrolled && <button className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Icon name="edit" className="w-6 h-6" /></button>}
        </div>
        <div className={`max-w-4xl mx-auto transition-all duration-300 ${scrolled ? 'h-14 pt-2' : 'h-16 pt-4'}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-5 h-5 text-slate-400"/></div>
                <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search messages..." className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-fuchsia-500 focus:outline-none placeholder:text-slate-400"/>
            </div>
        </div>
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            {filteredConversations.length > 0 ? (
                <>
                    {pinnedConvos.length > 0 && (
                        <section>
                            <h2 className="text-xs font-bold uppercase text-fuchsia-400/80 tracking-wider mb-2 px-2">Pinned</h2>
                            <div className="flex flex-col gap-2">
                                {pinnedConvos.map((convo, i) => (
                                    <ConversationItem key={convo.peer.id} conversation={convo} currentUserId={currentUser.id} isPinned={true} onPinToggle={handlePinToggle} isNew={newlyUpdatedChatId === convo.peer.id} onClick={() => onOpenConversation(convo.peer)} style={{ animationDelay: `${i * 50}ms` }} />
                                ))}
                            </div>
                        </section>
                    )}
                    {recentConvos.length > 0 && (
                        <section>
                            {pinnedConvos.length > 0 && <h2 className="text-xs font-bold uppercase text-fuchsia-400/80 tracking-wider mb-2 px-2">Recent</h2>}
                            <div className="flex flex-col gap-2">
                                {recentConvos.map((convo, i) => (
                                    <ConversationItem key={convo.peer.id} conversation={convo} currentUserId={currentUser.id} isPinned={false} onPinToggle={handlePinToggle} isNew={newlyUpdatedChatId === convo.peer.id} onClick={() => onOpenConversation(convo.peer)} style={{ animationDelay: `${(i + pinnedConvos.length) * 50}ms` }}/>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            ) : (
              <div className="text-center py-20">
                  <Icon name="message" className="w-16 h-16 mx-auto text-slate-600 mb-4 animate-float" />
                  <h2 className="text-xl font-bold text-slate-300">No Messages Yet</h2>
                  <p className="text-slate-400 mt-2">When you start a new conversation, it will appear here.</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ConversationsScreen;