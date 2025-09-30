
import React from 'react';
import { User } from '../types';

interface ContactsPanelProps {
  friends: User[];
  onOpenConversation: (peer: User) => void;
}

const ContactsPanel: React.FC<ContactsPanelProps> = ({ friends, onOpenConversation }) => {
  const onlineFriends = friends.filter(f => f.onlineStatus === 'online');

  return (
    <aside className="w-72 bg-black/20 backdrop-blur-md flex-shrink-0 hidden lg:flex flex-col p-4 border-l border-fuchsia-500/20">
      <div className="flex-grow">
        <h2 className="text-lg font-semibold text-fuchsia-300 mb-4">Contacts</h2>
        
        {onlineFriends.length > 0 ? (
          <ul className="space-y-1">
            {onlineFriends.map(friend => (
              <li key={friend.id}>
                <button 
                  onClick={() => onOpenConversation(friend)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-slate-800 transition-colors"
                >
                  <div className="relative">
                    <img src={friend.avatarUrl} alt={friend.name} className="w-9 h-9 rounded-full" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900"></div>
                  </div>
                  <span className="font-medium text-slate-200">{friend.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 text-center mt-8">No friends are currently online.</p>
        )}
      </div>
    </aside>
  );
};

export default ContactsPanel;
