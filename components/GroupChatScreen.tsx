import React, { useState, useEffect, useRef } from 'react';
import { GroupChat, Group, User, GroupChatMessage, ReplyInfo, Author } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import TaggedContent from './TaggedContent';
import Waveform from './Waveform';

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

interface GroupChatScreenProps {
  currentUser: User;
  groupId: string;
  onGoBack: () => void;
  onOpenProfile: (userName: string) => void;
}

const MessageBubble: React.FC<{
    message: GroupChatMessage;
    isMe: boolean;
    onReply: (message: GroupChatMessage) => void;
    onReact: (messageId: string, emoji: string) => void;
    onOpenProfile: (username: string) => void;
}> = ({ message, isMe, onReply, onReact, onOpenProfile }) => {
    const [isMenuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const renderContent = () => {
        if (message.isDeleted) return <p className="italic text-sm text-slate-500">Message deleted</p>;
        if (message.mediaType === 'image' && message.mediaUrl) return <img src={message.mediaUrl} alt="Sent" className="max-w-xs max-h-48 rounded-lg cursor-pointer" />;
        if (message.audioUrl) return <audio src={message.audioUrl} controls className="w-48 h-10" />;
        return <p className="text-slate-200"><TaggedContent text={message.text || ''} onTagClick={onOpenProfile} /></p>;
    };
    
    const reactionSummary = Object.entries(message.reactions || {})
        // @FIX: Explicitly cast `userIds` to string[] to resolve TypeScript inference error.
        .filter(([, userIds]) => (userIds as string[]).length > 0)
        .map(([emoji, userIds]) => ({ emoji, count: (userIds as string[]).length }))
        .sort((a, b) => b.count - a.count);

    return (
        <div className={`flex items-start gap-3 group relative ${isMe ? 'flex-row-reverse' : ''}`}>
            {!isMe && <img src={message.sender.avatarUrl} alt={message.sender.name} className="w-10 h-10 rounded-full cursor-pointer" onClick={() => onOpenProfile(message.sender.username)} />}
            <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <p className="text-xs text-lime-400 font-semibold ml-2 mb-0.5">{message.sender.name}</p>}
                {message.replyTo && (
                    <div className="text-xs bg-slate-700/50 px-3 py-1.5 rounded-t-lg border-b-2 border-slate-600 max-w-xs">
                        <p className="font-bold text-slate-400">Replying to {message.replyTo.senderName}</p>
                        <p className="text-slate-300 italic truncate">"{message.replyTo.content}"</p>
                    </div>
                )}
                <div className={`px-3 py-2 rounded-lg ${isMe ? 'bg-slate-700' : 'bg-slate-800/70'}`}>
                    {renderContent()}
                </div>
                {reactionSummary.length > 0 && (
                    <div className="flex gap-1 mt-1">
                        {reactionSummary.map(({ emoji, count }) => (
                            <div key={emoji} className="bg-slate-700/50 text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <span>{emoji}</span>
                                <span className="text-slate-300 font-semibold">{count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {!message.isDeleted && (
                <div ref={menuRef} className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'}`}>
                    <div className="flex bg-slate-900 rounded-full p-1 border border-slate-700">
                        <button onClick={() => setMenuOpen(p => !p)} className="p-1 rounded-full hover:bg-slate-700"><Icon name="face-smile" className="w-5 h-5 text-slate-300" /></button>
                        <button onClick={() => onReply(message)} className="p-1 rounded-full hover:bg-slate-700"><Icon name="reply" className="w-5 h-5 text-slate-300" /></button>
                    </div>
                    {isMenuOpen && (
                        <div className="absolute bottom-full mb-1 bg-slate-900 rounded-full p-1 flex items-center gap-1 shadow-lg border border-slate-700">
                            {EMOJI_REACTIONS.map(emoji => <button key={emoji} onClick={() => { onReact(message.id, emoji); setMenuOpen(false); }} className="text-2xl p-1 rounded-full hover:bg-slate-700">{emoji}</button>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const GroupChatScreen: React.FC<GroupChatScreenProps> = ({ currentUser, groupId, onGoBack, onOpenProfile }) => {
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<GroupChatMessage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const unsubGroup = geminiService.listenToGroup(groupId, setGroup);
    const unsubChat = geminiService.listenToGroupChat(groupId, (chatData) => {
        setChat(chatData);
        setIsLoading(false);
    });
    return () => {
        unsubGroup();
        unsubChat();
    };
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const replyInfo = replyingTo ? geminiService.createReplySnippet({ ...replyingTo, type: 'text', senderId: replyingTo.sender.name, text: replyingTo.text }) : undefined;
    await geminiService.sendGroupChatMessage(groupId, currentUser, { text: newMessage, replyTo: replyInfo });
    setNewMessage('');
    setReplyingTo(null);
  };
  
  const handleSendMedia = async (file: File) => {
      const replyInfo = replyingTo ? geminiService.createReplySnippet({ ...replyingTo, type: 'text', senderId: replyingTo.sender.name, text: replyingTo.text }) : undefined;
      await geminiService.sendGroupChatMessage(groupId, currentUser, { mediaFile: file, replyTo: replyInfo });
      setReplyingTo(null);
  };
  
  const handleSendAudio = async (blob: Blob, duration: number) => {
      const replyInfo = replyingTo ? geminiService.createReplySnippet({ ...replyingTo, type: 'text', senderId: replyingTo.sender.name, text: replyingTo.text }) : undefined;
      await geminiService.sendGroupChatMessage(groupId, currentUser, { audioBlob: blob, duration, replyTo: replyInfo });
      setReplyingTo(null);
  };

  const handleReact = (messageId: string, emoji: string) => {
    geminiService.reactToGroupChatMessage(groupId, messageId, currentUser.id, emoji);
  };
  
  const handleStartRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            handleSendAudio(audioBlob, 10); // Placeholder duration
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch(e) { console.error(e); }
  };
  
  const handleStopRecording = () => {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
  }

  if (isLoading || !group) {
    return <div className="flex items-center justify-center h-full bg-slate-900"><p className="text-slate-300">Loading chat...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <header className="flex-shrink-0 flex items-center p-3 border-b border-slate-700 bg-slate-800">
         <button onClick={onGoBack} className="p-2 rounded-full hover:bg-slate-700 transition-colors mr-2">
            <Icon name="back" className="w-6 h-6 text-slate-300"/>
         </button>
        <img src={group.coverPhotoUrl} alt={group.name} className="w-10 h-10 rounded-md object-cover" />
        <div className="ml-3">
          <h2 className="font-bold text-lg text-slate-100">{group.name} Chat</h2>
          <p className="text-sm text-slate-400">{group.memberCount} members</p>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto p-4 space-y-4">
        {chat?.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isMe={msg.sender.id === currentUser.id} onReply={setReplyingTo} onReact={handleReact} onOpenProfile={onOpenProfile} />
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="flex-shrink-0 p-3 border-t border-slate-700 bg-slate-800">
          {replyingTo && (
              <div className="text-xs bg-slate-700 px-3 py-1.5 rounded-t-md flex justify-between items-center">
                  <p className="text-slate-400">Replying to <span className="font-bold text-slate-300">{replyingTo.sender.name}</span></p>
                  <button onClick={() => setReplyingTo(null)} className="font-bold text-slate-400">X</button>
              </div>
          )}
          {isRecording && <div className="h-10 bg-slate-700 rounded-lg flex items-center p-2"><Waveform isPlaying isRecording/></div>}
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleSendMedia(e.target.files[0])} className="hidden" accept="image/*" />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-lime-400 hover:bg-slate-700 rounded-full"><Icon name="photo" className="w-6 h-6"/></button>
          <button onMouseDown={handleStartRecording} onMouseUp={handleStopRecording} onTouchStart={handleStartRecording} onTouchEnd={handleStopRecording} className="p-2 text-lime-400 hover:bg-slate-700 rounded-full"><Icon name="mic" className="w-6 h-6"/></button>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-grow bg-slate-700 border border-slate-600 text-slate-100 rounded-full py-2 px-4 focus:ring-lime-500 focus:border-lime-500"
          />
          <button onClick={handleSendMessage} className="bg-lime-600 text-black p-2.5 rounded-full hover:bg-lime-500 disabled:bg-slate-500" disabled={!newMessage.trim()}>
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.826L11.25 8.25l-5.607 1.77a.75.75 0 00-.826.95l1.414 4.949a.75.75 0 00.95.826l3.296-1.048a.75.75 0 00.421-.23l7.48-7.48a.75.75 0 00-1.06-1.06l-7.48 7.48a.75.75 0 00-.23.421l-1.048 3.296z" /></svg>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default GroupChatScreen;