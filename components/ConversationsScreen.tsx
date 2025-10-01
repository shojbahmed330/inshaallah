import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Conversation, AppView, Message } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { getTtsPrompt } from '../constants';
import { useSettings } from '../contexts/SettingsContext';
import { firebaseService } from '../services/firebaseService';

const SWIPE_THRESHOLD = -70; // Pixels to swipe before it's considered an action
const SWIPE_ACTION_WIDTH = 80; // Increased width for icon + text

// Re-engineered ConversationItem to be a stateful, interactive component with unified pointer events
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
    
    // Interaction State
    const [swipeX, setSwipeX] = useState(0);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
    
    const touchStart = useRef({ x: 0, y: 0, time: 0 });
    const longPressTimeout = useRef<number | null>(null);
    const isDragging = useRef(false);
    const isSwipingHorizontally = useRef(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const dragStartSwipeX = useRef(0);


    // --- Pointer Event Handlers for Unified Mouse/Touch ---

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Only trigger on primary button for mouse
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isDragging.current = true;
        isSwipingHorizontally.current = false;
        touchStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        dragStartSwipeX.current = swipeX; // Capture swipe position at drag start
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        // Reset any open context menus
        if (contextMenu) setContextMenu(null);

        // Set up a long press timer
        longPressTimeout.current = window.setTimeout(() => {
            if (isDragging.current) { // Check if pointer is still down without significant movement
                setContextMenu({ x: e.clientX, y: e.clientY });
                isDragging.current = false; // Prevent click from firing after long press
            }
        }, 500);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;

        const deltaX = e.clientX - touchStart.current.x;
        const deltaY = e.clientY - touchStart.current.y;

        // If the pointer moves more than a small threshold, cancel the long press
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            if (longPressTimeout.current) {
                clearTimeout(longPressTimeout.current);
                longPressTimeout.current = null;
            }
        }
        
        // Prioritize horizontal swiping
        if (!isSwipingHorizontally.current && Math.abs(deltaX) > Math.abs(deltaY) + 5) {
            isSwipingHorizontally.current = true;
        }

        if (isSwipingHorizontally.current) {
             const newSwipeX = dragStartSwipeX.current + deltaX;
             // Allow some "bounce" but clamp it
             const clampedSwipeX = Math.max(-SWIPE_ACTION_WIDTH * 3 - 20, Math.min(newSwipeX, 20));
             setSwipeX(clampedSwipeX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;

        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        isDragging.current = false;

        // Clear long press timer if it hasn't fired
        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }

        // --- Handle Swipe Snap ---
        if (swipeX < SWIPE_THRESHOLD) {
            setSwipeX(-SWIPE_ACTION_WIDTH * 3); // Snap open
        } else {
            setSwipeX(0); // Snap closed
        }

        // --- Handle Click ---
        // A click is a short press with minimal movement
        const pressDuration = Date.now() - touchStart.current.time;
        const movedDistance = Math.sqrt(Math.pow(e.clientX - touchStart.current.x, 2) + Math.pow(e.clientY - touchStart.current.y, 2));

        if (pressDuration < 250 && movedDistance < 10 && !contextMenu) {
            onClick();
        }
    };
    
    const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging.current) {
            handlePointerUp(e);
        }
    };

    const handleActionClick = (action: 'pin' | 'mute' | 'delete', e: React.MouseEvent) => {
        e.stopPropagation();
        if (action === 'pin') onPinToggle(peer.id);
        else alert(`${action.charAt(0).toUpperCase() + action.slice(1)} action clicked.`);
        setSwipeX(0); // Close swipe menu after action
    };

    const handleContextAction = (action: 'pin' | 'mute' | 'delete' | 'read') => {
        if (action === 'pin') onPinToggle(peer.id);
        else alert(`${action} action clicked.`);
        setContextMenu(null);
    };


    if (!lastMessage) return null;

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

    const actionButtonClasses = "w-[80px] h-full flex flex-col items-center justify-center text-white transition-colors text-xs gap-1";

    return (
        <div 
            style={style}
            className={`w-full relative overflow-hidden rounded-lg animate-list-item-slide-in ${isNew ? 'animate-glow' : ''}`}
        >
            {/* Swipe Actions */}
            <div className="absolute top-0 right-0 h-full flex">
                <button title={isPinned ? 'Unpin' : 'Pin'} onClick={(e) => handleActionClick('pin', e)} className={`${actionButtonClasses} bg-sky-600 hover:bg-sky-500`}>
                    <Icon name="pin" className="w-6 h-6"/>
                    <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <button title="Mute" onClick={(e) => handleActionClick('mute', e)} className={`${actionButtonClasses} bg-indigo-600 hover:bg-indigo-500`}>
                    <Icon name="bell-slash" className="w-6 h-6"/>
                    <span>Mute</span>
                </button>
                <button title="Delete" onClick={(e) => handleActionClick('delete', e)} className={`${actionButtonClasses} bg-red-600 hover:bg-red-500`}>
                    <Icon name="trash" className="w-6 h-6"/>
                    <span>Delete</span>
                </button>
            </div>
            
            {/* Main Content */}
            <div
                ref={itemRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                className={`w-full text-left p-3 flex items-center gap-4 rounded-lg transition-transform duration-200 ease-out bg-slate-800 active:bg-slate-700 cursor-pointer relative z-10`}
                style={{ transform: `translateX(${swipeX}px)`, touchAction: 'pan-y' }}
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
                <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}>
                    <div
                        className="absolute bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 text-white animate-context-menu-fade-in text-sm py-1"
                        style={{ top: contextMenu.y + 5, left: contextMenu.x + 5 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={() => handleContextAction('pin')} className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2"><Icon name="pin" className="w-5 h-5"/> {isPinned ? 'Unpin Chat' : 'Pin Chat'}</button>
                        <button onClick={() => handleContextAction('read')} className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2"><Icon name="check-double" className="w-5 h-5"/> Mark as Read</button>
                        <button onClick={() => handleContextAction('mute')} className="w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-2"><Icon name="bell-slash" className="w-5 h-5"/> Mute</button>
                        <div className="border-t border-slate-700 my-1"></div>
                        <button onClick={() => handleContextAction('delete')} className="w-full text-left px-4 py-2 text-red-400 hover:bg-red-500/10 flex items-center gap-2"><Icon name="trash" className="w-5 h-5"/> Delete</button>
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
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, 'online' | 'offline'>>({});
  
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
  
  const peerIds = useMemo(() => conversations.map(c => c.peer.id).sort().join(','), [conversations]);

  useEffect(() => {
      const unsubscribes: (() => void)[] = [];
      const ids = peerIds ? peerIds.split(',') : [];

      if (ids.length > 0) {
          ids.forEach(peerId => {
              // The name `listenToCurrentUser` is a bit of a misnomer, it listens to any user by ID.
              const unsubscribe = firebaseService.listenToCurrentUser(peerId, (userProfile) => {
                  if (userProfile) {
                      setOnlineStatuses(prev => ({
                          ...prev,
                          [userProfile.id]: userProfile.onlineStatus,
                      }));
                  }
              });
              unsubscribes.push(unsubscribe);
          });
      }
      return () => {
          unsubscribes.forEach(unsub => unsub());
      };
  }, [peerIds]);

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
    return conversations
        .map(convo => ({
            ...convo,
            peer: {
                ...convo.peer,
                onlineStatus: onlineStatuses[convo.peer.id] || convo.peer.onlineStatus || 'offline'
            }
        }))
        .filter(c => c.peer.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery, onlineStatuses]);
  
  const pinnedConvos = useMemo(() => {
    return filteredConversations.filter(c => pinnedChats.has(c.peer.id)).sort((a,b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
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
                  <Icon name="message" className="w-16 h-16 mx-auto text-slate-600 animate-float" />
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