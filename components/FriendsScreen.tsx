

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ScrollState, FriendshipStatus, AppView } from '../types';
import { geminiService } from '../services/geminiService';
import Icon from './Icon';
import UserCard from './UserCard';
import { useSettings } from '../contexts/SettingsContext';

interface FriendsScreenProps {
  currentUser: User;
  requests: User[];
  friends: User[];
  onOpenProfile: (username: string) => void;
  scrollState: ScrollState;
  onNavigate: (view: AppView, props?: any) => void;
  onGoBack: () => void;
  initialTab?: ActiveTab;
  onOpenConversation: (peer: User) => void;
}

type ActiveTab = 'requests' | 'suggestions' | 'all_friends';

const FriendsScreen: React.FC<FriendsScreenProps> = ({ currentUser, requests, friends, onOpenProfile, scrollState, onNavigate, onGoBack, initialTab, onOpenConversation }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab || 'requests');
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useSettings();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    // Requests and friends are now passed via props, so we only fetch suggestions.
    const suggs = await geminiService.getRecommendedFriends(currentUser.id);
    setSuggestions(suggs);
    setIsLoading(false);
    
    if (!initialTab) {
        if (requests.length > 0) {
            setActiveTab('requests');
        } else if (suggs.length > 0) {
            setActiveTab('suggestions');
        } else {
            setActiveTab('all_friends');
        }
    }

  }, [currentUser.id, initialTab, requests.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || scrollState === 'none') {
        return;
    }

    let animationFrameId: number;
    const animateScroll = () => {
        if (scrollState === 'down') {
            scrollContainer.scrollTop += 2;
        } else if (scrollState === 'up') {
            scrollContainer.scrollTop -= 2;
        }
        animationFrameId = requestAnimationFrame(animateScroll);
    };
    
    animationFrameId = requestAnimationFrame(animateScroll);

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [scrollState]);

  const handleAccept = useCallback(async (requestingUser: User) => {
    await geminiService.acceptFriendRequest(currentUser.id, requestingUser.id);
    // The real-time listener in UserApp will update the requests and friends props automatically.
  }, [currentUser.id]);
  
  const handleDecline = useCallback(async (requestingUser: User) => {
    await geminiService.declineFriendRequest(currentUser.id, requestingUser.id);
     // The real-time listener in UserApp will update the requests prop automatically.
  }, [currentUser.id]);
  
  const handleAddFriend = useCallback(async (targetUser: User) => {
    // Provide instant UI feedback by updating the suggestion's status locally
    setSuggestions(currentSuggestions => 
        currentSuggestions.map(user => 
            user.id === targetUser.id 
                ? { ...user, friendshipStatus: FriendshipStatus.REQUEST_SENT } 
                : user
        )
    );
    const result = await geminiService.addFriend(currentUser.id, targetUser.id);
     if (!result.success) {
         // Revert UI on failure
         setSuggestions(currentSuggestions => 
            currentSuggestions.map(user => 
                user.id === targetUser.id 
                    ? { ...user, friendshipStatus: FriendshipStatus.NOT_FRIENDS } 
                    : user
            )
        );
     }
  }, [currentUser.id]);

  const handleUnfriend = useCallback(async (userToUnfriend: User) => {
    if (window.confirm(`Are you sure you want to remove ${userToUnfriend.name} from your friends?`)) {
        await geminiService.unfriendUser(currentUser.id, userToUnfriend.id);
        // The listener in UserApp will update the friends prop automatically.
    }
  }, [currentUser.id]);

  const handleCancelRequest = useCallback(async (userToCancel: User) => {
    const success = await geminiService.cancelFriendRequest(currentUser.id, userToCancel.id);
    if (success) {
        // Update local suggestions state for instant UI feedback, as it's not from a live listener.
        setSuggestions(current => current.map(u => u.id === userToCancel.id ? { ...u, friendshipStatus: FriendshipStatus.NOT_FRIENDS } : u));
    }
  }, [currentUser.id]);

  const renderContent = () => {
    if (isLoading) {
        return <div className="text-lime-500 text-center p-10">Loading...</div>;
    }
    
    let userList: User[] = [];
    if (activeTab === 'requests') {
        const friendIds = new Set(friends.map(f => f.id));
        // Filter out any requests from users who are already friends. This handles data inconsistencies.
        userList = requests.filter(r => r && r.id && !friendIds.has(r.id));
    } else if (activeTab === 'suggestions') {
        userList = suggestions;
    } else if (activeTab === 'all_friends') {
        userList = friends;
    }


    if (userList.length === 0) {
        return <div className="text-lime-500 text-center p-10 bg-slate-900/50 rounded-b-lg border border-t-0 border-lime-500/20">No users to show in this list.</div>
    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-slate-900/50 rounded-b-lg border border-t-0 border-lime-500/20">
            {userList.filter(Boolean).map(user => (
                <UserCard
                    key={user.id}
                    user={user}
                    onProfileClick={onOpenProfile}
                    onUnfriend={activeTab === 'all_friends' ? handleUnfriend : undefined}
                    onCancelRequest={activeTab === 'suggestions' && user.friendshipStatus === FriendshipStatus.REQUEST_SENT ? handleCancelRequest : undefined}
                >
                    {activeTab === 'requests' && (
                        <>
                           <button onClick={() => handleDecline(user)} className="px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-lime-200 font-semibold transition-colors">Decline</button>
                           <button onClick={() => handleAccept(user)} className="px-3 py-2 text-sm rounded-lg bg-lime-600 hover:bg-lime-500 text-black font-bold transition-colors">Accept</button>
                        </>
                    )}
                     {activeTab === 'suggestions' && (
                        <>
                            {user.friendshipStatus === FriendshipStatus.REQUEST_SENT ? (
                               <button disabled className="px-3 py-2 text-sm rounded-lg bg-slate-700 text-lime-500 font-semibold cursor-not-allowed">Sent</button>
                            ) : (
                               <button onClick={() => handleAddFriend(user)} className="px-3 py-2 text-sm rounded-lg bg-lime-600 hover:bg-lime-500 text-black font-bold transition-colors flex items-center gap-2">
                                   <Icon name="add-friend" className="w-5 h-5" /> Add Friend
                               </button>
                            )}
                        </>
                    )}
                    {activeTab === 'all_friends' && (
                        <button onClick={() => onOpenConversation(user)} className="px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-lime-200 font-semibold transition-colors">Message</button>
                    )}
                </UserCard>
            ))}
        </div>
    )
  }
  
  const TabButton: React.FC<{tabId: ActiveTab; label: string; count: number;}> = ({ tabId, label, count }) => (
    <button 
        onClick={() => setActiveTab(tabId)}
        className={`px-4 py-3 font-semibold text-lg border-b-4 transition-colors ${activeTab === tabId ? 'border-lime-500 text-lime-300' : 'border-transparent text-lime-500 hover:text-lime-300'}`}
    >
        {label} {count > 0 && <span className={`ml-2 text-sm px-2 py-0.5 rounded-full ${activeTab === tabId ? 'bg-lime-500 text-black' : 'bg-slate-700 text-lime-300'}`}>{count}</span>}
    </button>
  );

  return (
    <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-lime-200">Friends</h1>
        
        <div className="border-b border-lime-500/20 flex items-center bg-slate-900/50 rounded-t-lg">
            <TabButton tabId="requests" label="Friend Requests" count={requests.filter(r => r && r.id && !friends.some(f => f.id === r.id)).length} />
            <TabButton tabId="suggestions" label="Suggestions" count={suggestions.length} />
            <TabButton tabId="all_friends" label="All Friends" count={friends.length} />
        </div>
        
        {renderContent()}

      </div>
    </div>
  );
};

export default FriendsScreen;