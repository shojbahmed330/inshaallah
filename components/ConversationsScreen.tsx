import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const ConversationItem: React.FC<{ 
    conversation: Conversation; 
    currentUserId: string; 
    isPinned: boolean;
    onClick: () => void;
    onPinToggle: () => void;
}> = ({ conversation, currentUserId, isPinned, onClick, onPinToggle }) => {
    const { peer, lastMessage, unreadCount } = conversation;

    if (!lastMessage) {
        return (
            <button onClick={onClick} className="w-full text-left p-3 flex items-center gap-4 rounded-lg transition-colors hover:bg-slate-700/50 group">
                <div className="relative flex-shrink-0">
                    <img src={peer.avatarUrl} alt={peer.name} className="w-14 h-14 rounded-full" />
                    <div
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                            peer.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'
                        }`}
                        title={peer.onlineStatus === 'online' ? 'Online' : 'Offline'}
                    />
                </div>
                <div className="flex-grow overflow-hidden">
                    <p className="font-bold text-lg truncate text-slate-200">{peer.name}</p>
                    <p className="text-sm truncate text-slate-400 italic">No messages yet. Start the conversation!</p>
                </div>
            </button>
        );
    }
    
    const isLastMessageFromMe = lastMessage.senderId === currentUserId;

    const timeAgo = new Date(lastMessage.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
    
    const getSnippet = (message: Message): string => {
        if (message.isDeleted) {
            return isLastMessageFromMe ? "You unsent a message" : "Unsent a message";
        }
        const prefix = isLastMessageFromMe ? 'You: ' : '';
        switch (message.type) {
            case 'text':
                return prefix + (message.text || '');
            case 'image':
                return prefix + 'Sent an image 📷';
            case 'video':
                return prefix + 'Sent a video 📹';
            case 'audio':
            default:
                return prefix + `Voice message · ${message.duration}s`;
        }
    };

    const snippet = getSnippet(lastMessage);

    return (
        <button onClick={onClick} className={`w-full text-left p-3 flex items-center gap-4 rounded-lg transition-colors hover:bg-slate-700/50 group ${unreadCount > 0 ? 'bg-slate-700' : ''}`}>
            <div className="relative flex-shrink-0">
                <img src={peer.avatarUrl} alt={peer.name} className="w-14 h-14 rounded-full" />
                <div
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                        peer.onlineStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'
                    }`}
                    title={peer.onlineStatus === 'online' ? 'Online' : 'Offline'}
                />
            </div>
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-baseline">
                    <p className={`font-bold text-lg truncate ${unreadCount > 0 ? 'text-white' : 'text-slate-200'}`}>{peer.name}</p>
                    <p className="text-xs text-slate-400 flex-shrink-0">{timeAgo}</p>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <p className={`text-sm truncate ${unreadCount > 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>{snippet}</p>
                    {unreadCount > 0 && (
                        <div className="flex-shrink-0 ml-4 h-6 flex items-center gap-2">
                            <div className="w-2.5 h-2.5 bg-fuchsia-500 rounded-full"></div>
                            <span className="w-6 h-6 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onPinToggle(); }} className={`p-2 rounded-full transition-all group-hover:opacity-100 ${isPinned ? 'opacity-100 text-fuchsia-400' : 'opacity-0 text-slate-400 hover:text-fuchsia-300'}`}>
                <Icon name="pin" className="w-5 h-5" />
            </button>
        </button>
    )
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-sm font-bold uppercase text-slate-400 px-3 pt-4 pb-1">{title}</h2>
);


const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ currentUser, onOpenConversation, onSetTtsMessage, lastCommand, onCommandProcessed, onGoBack }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(`pinnedChats_${currentUser.id}`);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });
    const { language } = useSettings();

    useEffect(() => {
        setIsLoading(true);
        const unsubscribe = firebaseService.listenToConversations(currentUser.id, (convos) => {
            setConversations(convos);
            setIsLoading(wasLoading => {
                if (wasLoading) {
                    onSetTtsMessage(getTtsPrompt('conversations_loaded', language));
                    return false; 
                }
                return false; 
            });
        });

        return () => unsubscribe();
    }, [currentUser.id, onSetTtsMessage, language]);
    
    const togglePin = (peerId: string) => {
        setPinnedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(peerId)) {
                newSet.delete(peerId);
            } else {
                newSet.add(peerId);
            }
            localStorage.setItem(`pinnedChats_${currentUser.id}`, JSON.stringify(Array.from(newSet)));
            return newSet;
        });
    };

    const handleCommand = useCallback(async (command: string) => {
        try {
            const userNames = conversations.map(c => c.peer.name);
            const intentResponse = await geminiService.processIntent(command, { userNames });

            switch (intentResponse.intent) {
                case 'intent_go_back':
                    onGoBack();
                    break;
                case 'intent_reload_page':
                    onSetTtsMessage("Reloading conversations...");
                    break;
                case 'intent_open_chat':
                    if (intentResponse.slots?.target_name) {
                        const targetName = intentResponse.slots.target_name as string;
                        const targetConversation = conversations.find(c => c.peer.name.toLowerCase() === (targetName).toLowerCase());
                        if (targetConversation) {
                            onOpenConversation(targetConversation.peer);
                        } else {
                            onSetTtsMessage(`I couldn't find a conversation with ${targetName}.`);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error("Error processing command in ConversationsScreen:", error);
        } finally {
            onCommandProcessed();
        }
    }, [conversations, onOpenConversation, onSetTtsMessage, onCommandProcessed, onGoBack]);

    useEffect(() => {
        if (lastCommand) {
            handleCommand(lastCommand);
        }
    }, [lastCommand, handleCommand]);
    
    const filteredConversations = useMemo(() => {
        if (!searchQuery) return conversations;
        return conversations.filter(c => 
            c.peer.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [conversations, searchQuery]);

    const { pinned, unread, others } = useMemo(() => {
        const pinned: Conversation[] = [];
        const unread: Conversation[] = [];
        const others: Conversation[] = [];
        
        filteredConversations.forEach(convo => {
            if (pinnedIds.has(convo.peer.id)) {
                pinned.push(convo);
            } else if (convo.unreadCount > 0) {
                unread.push(convo);
            } else {
                others.push(convo);
            }
        });
        
        return { pinned, unread, others };
    }, [filteredConversations, pinnedIds]);


    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><p className="text-slate-300 text-xl">Loading conversations...</p></div>;
    }

    return (
        <div className="h-full w-full flex flex-col bg-slate-900">
            <div className="flex-shrink-0 sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm p-4 sm:p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-slate-100">Messages</h1>
                    <button className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <Icon name="edit" className="w-6 h-6" />
                    </button>
                </div>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                       <svg className="w-5 h-5 text-slate-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/></svg>
                    </div>
                    <input 
                        type="search" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="bg-slate-800 border border-slate-700 text-slate-100 text-base rounded-full focus:ring-fuchsia-500 focus:border-fuchsia-500 block w-full pl-10 p-2.5 transition"
                    />
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto px-2 sm:px-4">
                {conversations.length > 0 ? (
                   <div className="flex flex-col">
                        {pinned.length > 0 && (
                            <section>
                                <SectionHeader title="Pinned" />
                                {pinned.map(convo => (
                                    <ConversationItem key={convo.peer.id} conversation={convo} currentUserId={currentUser.id} isPinned={true} onClick={() => onOpenConversation(convo.peer)} onPinToggle={() => togglePin(convo.peer.id)} />
                                ))}
                            </section>
                        )}
                         {unread.length > 0 && (
                            <section>
                                <SectionHeader title="Unread" />
                                {unread.map(convo => (
                                    <ConversationItem key={convo.peer.id} conversation={convo} currentUserId={currentUser.id} isPinned={false} onClick={() => onOpenConversation(convo.peer)} onPinToggle={() => togglePin(convo.peer.id)} />
                                ))}
                            </section>
                        )}
                        {others.length > 0 && (
                           <section>
                                <SectionHeader title="All Messages" />
                                {others.map(convo => (
                                    <ConversationItem key={convo.peer.id} conversation={convo} currentUserId={currentUser.id} isPinned={false} onClick={() => onOpenConversation(convo.peer)} onPinToggle={() => togglePin(convo.peer.id)} />
                                ))}
                           </section>
                        )}
                   </div>
                ) : (
                  <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                      <Icon name="message" className="w-16 h-16 mx-auto text-slate-600 mb-4 animate-breathing" />
                      <h2 className="text-xl font-bold text-slate-300">No messages yet</h2>
                      <p className="text-slate-400 mt-2">When you start a new conversation, it will appear here.</p>
                  </div>
                )}
            </div>
        </div>
    );
};

export default ConversationsScreen;