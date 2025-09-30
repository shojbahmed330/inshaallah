import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Conversation, AppView, Message } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import { getTtsPrompt } from '../constants';
import { useSettings } from '../contexts/SettingsContext';
import { firebaseService } from '../services/firebaseService';

interface ConversationsScreenProps {
  currentUser: User;
  onOpenConversation: (peer: User) => void;
  onSetTtsMessage: (message: string) => void;
  lastCommand: string | null;
  onCommandProcessed: () => void;
  onGoBack: () => void;
}

const SWIPE_ACTION_WIDTH = 64; // Corresponds to w-16
const SWIPE_THRESHOLD = -SWIPE_ACTION_WIDTH * 1.5;

const SwipeableConversationItem: React.FC<{ 
    conversation: Conversation; 
    currentUserId: string; 
    isPinned: boolean;
    isMuted: boolean;
    onClick: () => void;
    onPinToggle: () => void;
    onMuteToggle: () => void;
    onDelete: () => void;
    onLongPress: (event: React.TouchEvent, conversation: Conversation) => void;
}> = ({ conversation, currentUserId, isPinned, isMuted, onClick, onPinToggle, onMuteToggle, onDelete, onLongPress }) => {
    const { peer, lastMessage, unreadCount } = conversation;
    
    const [swipeX, setSwipeX] = useState(0);
    const dragStartX = useRef(0);
    const isSwiping = useRef(false);
    const longPressTimer = useRef<number | null>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartX.current = e.touches[0].clientX;
        isSwiping.current = false;
        if (itemRef.current) itemRef.current.style.transition = 'none';

        longPressTimer.current = window.setTimeout(() => {
            isSwiping.current = true; 
            onLongPress(e, conversation);
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const deltaX = e.touches[0].clientX - dragStartX.current;
        if (Math.abs(deltaX) > 10 && longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (deltaX < 0) {
            isSwiping.current = true;
            setSwipeX(Math.max(deltaX, -(SWIPE_ACTION_WIDTH * 3) - 10)); 
        } else if (deltaX > 0 && swipeX < 0) {
            isSwiping.current = true;
            setSwipeX(swipeX + deltaX * 0.5); // Add some resistance when swiping back
        }
    };

    const handleTouchEnd = () => {
        if (itemRef.current) itemRef.current.style.transition = 'transform 0.2s ease-out';
        
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (swipeX < SWIPE_THRESHOLD) {
            setSwipeX(-(SWIPE_ACTION_WIDTH * 3));
        } else {
            setSwipeX(0);
        }

        setTimeout(() => {
            if (!isSwiping.current) {
                onClick();
            }
            isSwiping.current = false;
        }, 0);
    };
    
    const isLastMessageFromMe = lastMessage?.senderId === currentUserId;
    const timeAgo = lastMessage ? new Date(lastMessage.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    
    const getSnippet = (message?: Message): string => {
        if (!message) return "No messages yet. Start the conversation!";
        if (message.isDeleted) return isLastMessageFromMe ? "You unsent a message" : "Unsent a message";
        const prefix = isLastMessageFromMe ? 'You: ' : '';
        switch (message.type) {
            case 'text': return prefix + (message.text || '');
            case 'image': return prefix + 'Sent an image 📷';
            case 'video': return prefix + 'Sent a video 📹';
            case 'audio': return prefix + `Voice message · ${message.duration}s`;
            default: return prefix + `Voice message · ${message.duration || 0}s`;
        }
    };

    const snippet = getSnippet(lastMessage);
    const displayUnreadCount = isMuted ? 0 : unreadCount;

    return (
        <div className="relative w-full overflow-hidden rounded-lg -webkit-tap-highlight-color: transparent;">
            <div className="absolute top-0 right-0 h-full flex items-center z-0">
                <button onClick={onMuteToggle} className="w-16 h-full flex items-center justify-center bg-indigo-600 text-white"><Icon name={isMuted ? "speaker-wave" : "speaker-x-mark"} className="w-6 h-6"/></button>
                <button onClick={onPinToggle} className="w-16 h-full flex items-center justify-center bg-fuchsia-600 text-white"><Icon name="pin" className="w-6 h-6"/></button>
                <button onClick={onDelete} className="w-16 h-full flex items-center justify-center bg-rose-600 text-white"><Icon name="trash" className="w-6 h-6"/></button>
            </div>
            <div
                ref={itemRef}
                style={{ transform: `translateX(${swipeX}px)` }}
                className={`w-full text-left p-3 flex items-center gap-4 bg-slate-800 relative z-10 touch-pan-y ${displayUnreadCount > 0 ? 'bg-slate-700' : 'bg-slate-800'}`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="relative flex-shrink-0">
                    <img src={peer.avatarUrl} alt={peer.name} className="w-14 h-14 rounded-full" />
                    <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${peer.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} title={peer.onlineStatus === 'online' ? 'Online' : 'Offline'}/>
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-baseline">
                        <p className={`font-bold text-lg truncate flex items-center gap-2 ${displayUnreadCount > 0 ? 'text-white' : 'text-slate-200'}`}>
                            {peer.name}
                            {isMuted && <Icon name="speaker-x-mark" className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                        </p>
                        <p className="text-xs text-slate-400 flex-shrink-0">{timeAgo}</p>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className={`text-sm truncate ${displayUnreadCount > 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>{snippet}</p>
                        {displayUnreadCount > 0 && (
                            <div className="flex-shrink-0 ml-4 h-6 flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full"></div>
                                <span className="w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{displayUnreadCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContextMenu: React.FC<{
    x: number; y: number; conversation: Conversation; isPinned: boolean; isMuted: boolean;
    onClose: () => void; onPinToggle: () => void; onMuteToggle: () => void;
    onMarkAsRead: () => void; onDelete: () => void;
}> = ({ x, y, conversation, isPinned, isMuted, onClose, onPinToggle, onMuteToggle, onMarkAsRead, onDelete }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x, y });

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            let newX = x;
            let newY = y;
            if (x + rect.width > window.innerWidth) newX = window.innerWidth - rect.width - 10;
            if (y + rect.height > window.innerHeight) newY = window.innerHeight - rect.height - 10;
            setPos({ x: newX, y: newY });
        }
    }, [x, y]);

    const MenuItem: React.FC<{ icon: React.ComponentProps<typeof Icon>['name']; label: string; onClick: () => void; className?: string }> = ({ icon, label, onClick, className }) => (
        <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-700 rounded-md ${className}`}>
            <Icon name={icon} className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <div
                ref={menuRef}
                className="fixed bg-slate-800/90 backdrop-blur-md rounded-lg shadow-2xl p-2 z-50 w-56 border border-slate-600 animate-fade-scale-in"
                style={{ top: pos.y, left: pos.x }}
            >
                <MenuItem icon="pin" label={isPinned ? 'Unpin Chat' : 'Pin Chat'} onClick={onPinToggle} />
                <MenuItem icon={isMuted ? 'speaker-wave' : 'speaker-x-mark'} label={isMuted ? 'Unmute' : 'Mute'} onClick={onMuteToggle} />
                {conversation.unreadCount > 0 && <MenuItem icon="check-circle" label="Mark as Read" onClick={onMarkAsRead} />}
                <div className="my-1 h-px bg-slate-700" />
                <MenuItem icon="trash" label="Delete Chat" onClick={onDelete} className="text-red-400" />
            </div>
        </>
    );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-sm font-bold uppercase text-slate-400 px-3 pt-4 pb-1">{title}</h2>
);


const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ currentUser, onOpenConversation, onSetTtsMessage, lastCommand, onCommandProcessed, onGoBack }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(`pinnedChats_${currentUser.id}`) || '[]')));
    const [mutedIds, setMutedIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(`mutedChats_${currentUser.id}`) || '[]')));
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, conversation: Conversation } | null>(null);
    const { language } = useSettings();

    useEffect(() => {
        const unsubscribe = firebaseService.listenToConversations(currentUser.id, (convos) => {
            setConversations(convos);
            if (isLoading) {
                onSetTtsMessage(getTtsPrompt('conversations_loaded', language));
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [currentUser.id, onSetTtsMessage, language, isLoading]);
    
    const handleMuteToggle = (peerId: string) => {
        const newSet = new Set(mutedIds);
        if (newSet.has(peerId)) newSet.delete(peerId);
        else newSet.add(peerId);
        localStorage.setItem(`mutedChats_${currentUser.id}`, JSON.stringify(Array.from(newSet)));
        setMutedIds(newSet);
        contextMenu && handleCloseContextMenu();
    };

    const handleDelete = (convoToDelete: Conversation) => {
        if (window.confirm(`Are you sure you want to delete your conversation with ${convoToDelete.peer.name}? This is a client-side simulation.`)) {
            setConversations(prev => prev.filter(c => c.peer.id !== convoToDelete.peer.id));
        }
        contextMenu && handleCloseContextMenu();
    };

    const handleMarkAsRead = (convoToRead: Conversation) => {
        const chatId = firebaseService.getChatId(currentUser.id, convoToRead.peer.id);
        firebaseService.markMessagesAsRead(chatId, currentUser.id);
        contextMenu && handleCloseContextMenu();
    };
    
    const togglePin = (peerId: string) => {
        const newSet = new Set(pinnedIds);
        if (newSet.has(peerId)) newSet.delete(peerId);
        else newSet.add(peerId);
        localStorage.setItem(`pinnedChats_${currentUser.id}`, JSON.stringify(Array.from(newSet)));
        setPinnedIds(newSet);
        contextMenu && handleCloseContextMenu();
    };

    const handleLongPress = (event: React.TouchEvent, conversation: Conversation) => {
        event.preventDefault();
        const touch = event.touches[0];
        setContextMenu({ x: touch.clientX, y: touch.clientY, conversation });
    };

    const handleCloseContextMenu = () => setContextMenu(null);

    const filteredConversations = useMemo(() => {
        if (!searchQuery) return conversations;
        return conversations.filter(c => c.peer.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [conversations, searchQuery]);

    const { pinned, unread, others } = useMemo(() => {
        const pinned: Conversation[] = [];
        const unread: Conversation[] = [];
        const others: Conversation[] = [];
        
        filteredConversations.forEach(convo => {
            const isMuted = mutedIds.has(convo.peer.id);
            if (pinnedIds.has(convo.peer.id)) pinned.push(convo);
            else if (convo.unreadCount > 0 && !isMuted) unread.push(convo);
            else others.push(convo);
        });
        
        return { pinned, unread, others };
    }, [filteredConversations, pinnedIds, mutedIds]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-300 text-xl">Loading conversations...</p></div>;
    }

    return (
        <div className="h-full w-full flex flex-col bg-slate-900">
            <div className="flex-shrink-0 sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm p-4 sm:p-6 space-y-4">
                <div className="flex justify-between items-center"><h1 className="text-3xl font-bold text-slate-100">Messages</h1><button className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Icon name="edit" className="w-6 h-6" /></button></div>
                 <div className="relative"><div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><svg className="w-5 h-5 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/></svg></div><input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." className="bg-slate-800 border border-slate-700 text-slate-100 text-base rounded-full focus:ring-fuchsia-500 focus:border-fuchsia-500 block w-full pl-10 p-2.5 transition"/></div>
            </div>
            
            <div className="flex-grow overflow-y-auto px-2 sm:px-4">
                {conversations.length > 0 ? (
                   <div className="flex flex-col">
                        {pinned.length > 0 && (
                            <section><SectionHeader title="Pinned" />{pinned.map(c => <SwipeableConversationItem key={c.peer.id} conversation={c} currentUserId={currentUser.id} isPinned={true} isMuted={mutedIds.has(c.peer.id)} onClick={() => onOpenConversation(c.peer)} onPinToggle={() => togglePin(c.peer.id)} onMuteToggle={() => handleMuteToggle(c.peer.id)} onDelete={() => handleDelete(c)} onLongPress={handleLongPress} />)}</section>
                        )}
                         {unread.length > 0 && (
                            <section><SectionHeader title="Unread" />{unread.map(c => <SwipeableConversationItem key={c.peer.id} conversation={c} currentUserId={currentUser.id} isPinned={false} isMuted={mutedIds.has(c.peer.id)} onClick={() => onOpenConversation(c.peer)} onPinToggle={() => togglePin(c.peer.id)} onMuteToggle={() => handleMuteToggle(c.peer.id)} onDelete={() => handleDelete(c)} onLongPress={handleLongPress} />)}</section>
                        )}
                        {others.length > 0 && (
                           <section><SectionHeader title="All Messages" />{others.map(c => <SwipeableConversationItem key={c.peer.id} conversation={c} currentUserId={currentUser.id} isPinned={false} isMuted={mutedIds.has(c.peer.id)} onClick={() => onOpenConversation(c.peer)} onPinToggle={() => togglePin(c.peer.id)} onMuteToggle={() => handleMuteToggle(c.peer.id)} onDelete={() => handleDelete(c)} onLongPress={handleLongPress} />)}</section>
                        )}
                   </div>
                ) : (
                  <div className="text-center py-20 flex flex-col items-center justify-center h-full"><Icon name="message" className="w-16 h-16 mx-auto text-slate-600 mb-4 animate-breathing" /><h2 className="text-xl font-bold text-slate-300">No messages yet</h2><p className="text-slate-400 mt-2">When you start a new conversation, it will appear here.</p></div>
                )}
            </div>
            {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} conversation={contextMenu.conversation} isPinned={pinnedIds.has(contextMenu.conversation.peer.id)} isMuted={mutedIds.has(contextMenu.conversation.peer.id)} onClose={handleCloseContextMenu} onPinToggle={() => togglePin(contextMenu.conversation.peer.id)} onMuteToggle={() => handleMuteToggle(contextMenu.conversation.peer.id)} onMarkAsRead={() => handleMarkAsRead(contextMenu.conversation)} onDelete={() => handleDelete(contextMenu.conversation)} />}
        </div>
    );
};

export default ConversationsScreen;