import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Post, User, ScrollState, Campaign, AppView, Story, Comment } from '../types';
import { PostCard } from './PostCard';
import CreatePostWidget from './CreatePostWidget';
import SkeletonPostCard from './SkeletonPostCard';
import { geminiService } from './services/geminiService';
import RewardedAdWidget from './RewardedAdWidget';
import StoriesTray from './StoriesTray';
import { firebaseService } from './services/firebaseService';
import { useSettings } from './contexts/SettingsContext';
import { getTtsPrompt } from '../constants';

interface CommandResponse {
  intent: string;
  slots?: { [key: string]: string | number };
}


interface FeedScreenProps {
  isLoading: boolean;
  posts: Post[];
  currentUser: User;
  onOpenProfile: (userName: string) => void;
  onOpenComments: (post: Post, commentToReplyTo?: Comment) => void;
  onReactToPost: (postId: string, emoji: string) => void;
  onStartCreatePost: (props?: any) => void;
  onRewardedAdClick: (campaign: Campaign) => void;
  onAdViewed: (campaignId: string) => void;
  onAdClick: (post: Post) => void;
  onSharePost: (post: Post) => void;
  onOpenPhotoViewer: (post: Post, initialUrl?: string) => void;
  onDeletePost: (postId: string) => void;
  onReportPost: (post: Post) => void;
  scrollState: ScrollState;
  onSetScrollState: (state: ScrollState) => void;
  onNavigate: (view: AppView, props?: any) => void;
  friends: User[];
  setSearchResults: (results: User[]) => void;
  hiddenPostIds: Set<string>;
  onHidePost: (postId: string) => void;
  onSavePost: (post: Post, isSaving: boolean) => void;
  onCopyLink: (post: Post) => void;
  lastCommand: string | null;
  lastCommandResponse: CommandResponse | null;
  onCommandProcessed: () => void;
  onSetTtsMessage: (message: string) => void;
}

const FeedScreen: React.FC<FeedScreenProps> = ({
    isLoading, posts: initialPosts, currentUser, onOpenProfile,
    onOpenComments, onReactToPost, onStartCreatePost, onRewardedAdClick, onAdViewed,
    onAdClick, scrollState, onSetScrollState, onNavigate, friends, setSearchResults,
    onSharePost, onOpenPhotoViewer, onDeletePost, onReportPost, hiddenPostIds, onHidePost, onSavePost, onCopyLink,
    lastCommand, lastCommandResponse, onCommandProcessed, onSetTtsMessage
}) => {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [adInjected, setAdInjected] = useState(false);
  const [currentPostIndex, setCurrentPostIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rewardedCampaign, setRewardedCampaign] = useState<Campaign | null>(null);
  const [storiesByAuthor, setStoriesByAuthor] = useState<Awaited<ReturnType<typeof geminiService.getStories>>>([]);
  
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { language } = useSettings();
  
  const isInitialLoad = useRef(true);
  const isProgrammaticScroll = useRef(false);
  const currentPostIndexRef = useRef(currentPostIndex);
  currentPostIndexRef.current = currentPostIndex;

  const visiblePosts = useMemo(() => {
    return posts.filter(p => p && !hiddenPostIds.has(p.id));
  }, [posts, hiddenPostIds]);

  useEffect(() => {
    setPosts(initialPosts);
    setAdInjected(false); // Reset ad injection when initial posts change
  }, [initialPosts]);

  const fetchRewardedCampaign = useCallback(async () => {
      const camp = await geminiService.getRandomActiveCampaign();
      setRewardedCampaign(camp);
  }, []);
  
  const fetchStories = useCallback(async () => {
      const realStories = await geminiService.getStories(currentUser.id);
      const adStory = await firebaseService.getInjectableStoryAd(currentUser);
  
      if (adStory) {
          const adStoryGroup = {
              author: adStory.author,
              stories: [adStory],
              allViewed: false, // Doesn't apply to ads
          };
          // Inject the ad story at the second position
          const combinedStories = [...realStories];
          combinedStories.splice(1, 0, adStoryGroup);
          setStoriesByAuthor(combinedStories);
      } else {
          setStoriesByAuthor(realStories);
      }
  }, [currentUser]);

  useEffect(() => {
    if (!isLoading) {
        fetchRewardedCampaign();
        fetchStories();
    }
  }, [isLoading, fetchRewardedCampaign, fetchStories]);

  useEffect(() => {
    const injectAd = async () => {
        if (!isLoading && !adInjected && posts.length > 2) {
            setAdInjected(true);
            const adPost = await firebaseService.getInjectableAd(currentUser);
            if (adPost) {
                const newPosts = [...posts];
                const injectionIndex = 3; 
                newPosts.splice(injectionIndex, 0, adPost);
                setPosts(newPosts);
            }
        }
    };
    injectAd();
  }, [isLoading, posts, adInjected, currentUser]);

  useEffect(() => {
    const scrollContainer = feedContainerRef.current;
    if (!scrollContainer || scrollState === ScrollState.NONE) {
        return;
    }

    let animationFrameId: number;

    const animateScroll = () => {
        if (scrollState === ScrollState.DOWN) {
            scrollContainer.scrollTop += 2;
        } else if (scrollState === ScrollState.UP) {
            scrollContainer.scrollTop -= 2;
        }
        animationFrameId = requestAnimationFrame(animateScroll);
    };

    animationFrameId = requestAnimationFrame(animateScroll);

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [scrollState]);

    useEffect(() => {
        if (!lastCommand || !lastCommandResponse) return;

        const { intent, slots } = lastCommandResponse;

        switch (intent) {
            case 'intent_next_post':
                isProgrammaticScroll.current = true;
                setCurrentPostIndex(prev => (prev < 0 ? 0 : (prev + 1) % posts.length));
                setIsPlaying(true);
                break;
            case 'intent_previous_post':
                isProgrammaticScroll.current = true;
                setCurrentPostIndex(prev => (prev > 0 ? prev - 1 : posts.length - 1));
                setIsPlaying(true);
                break;
            case 'intent_play_post':
                if (currentPostIndex === -1 && posts.length > 0) {
                    isProgrammaticScroll.current = true;
                    setCurrentPostIndex(0);
                }
                setIsPlaying(true);
                break;
            case 'intent_pause_post':
                setIsPlaying(false);
                break;
            case 'intent_like':
                 if (currentPostIndex !== -1 && posts[currentPostIndex] && !posts[currentPostIndex].isSponsored) {
                  onReactToPost(posts[currentPostIndex].id, '👍');
                }
                break;
            case 'intent_share':
                if (currentPostIndex !== -1 && posts[currentPostIndex]) {
                    onSharePost(posts[currentPostIndex]);
                }
                break;
            case 'intent_comment':
                 if (currentPostIndex !== -1 && posts[currentPostIndex] && !posts[currentPostIndex].isSponsored) {
                    onOpenComments(posts[currentPostIndex]);
                }
                break;
            case 'intent_scroll_down': onSetScrollState(ScrollState.DOWN); break;
            case 'intent_scroll_up': onSetScrollState(ScrollState.UP); break;
            case 'intent_stop_scroll': onSetScrollState(ScrollState.NONE); break;
            case 'intent_create_post': onStartCreatePost(); break;
            case 'intent_create_voice_post': onStartCreatePost({ startRecording: true }); break;
            case 'intent_reload_page':
                onSetTtsMessage("Reloading your feed...");
                fetchRewardedCampaign();
                break;
            case 'intent_search_user':
                if (slots?.target_name) {
                    const query = slots.target_name as string;
                    geminiService.searchUsers(query).then(results => {
                        setSearchResults(results);
                        onNavigate(AppView.SEARCH_RESULTS, { query });
                    });
                }
                break;
        }

        onCommandProcessed();

    }, [lastCommand, lastCommandResponse, posts, currentPostIndex, onReactToPost, onOpenComments, onSetScrollState, onStartCreatePost, onSetTtsMessage, onCommandProcessed, fetchRewardedCampaign, onSharePost, setSearchResults, onNavigate]);


  useEffect(() => {
    if (isInitialLoad.current || posts.length === 0 || currentPostIndex < 0 || !isProgrammaticScroll.current) return;

    const cardElement = postRefs.current[currentPostIndex];
    if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const scrollTimeout = setTimeout(() => {
            isProgrammaticScroll.current = false;
        }, 1000); 
        
        return () => clearTimeout(scrollTimeout);
    }
  }, [currentPostIndex, posts]);

  useEffect(() => {
    if (isInitialLoad.current || posts.length === 0 || currentPostIndex < 0) return;
    
    const activePost = posts[currentPostIndex];
    if (activePost?.isSponsored && activePost.campaignId) {
        onAdViewed(activePost.campaignId);
    }
  }, [currentPostIndex, posts, onAdViewed]);

  useEffect(() => {
    const observer = new IntersectionObserver(
        (entries) => {
            if (isProgrammaticScroll.current) return;

            const intersectingEntries = entries.filter(entry => entry.isIntersecting);
            if (intersectingEntries.length > 0) {
                const mostVisibleEntry = intersectingEntries.reduce((prev, current) => 
                    prev.intersectionRatio > current.intersectionRatio ? prev : current
                );
                
                const indexStr = (mostVisibleEntry.target as HTMLElement).dataset.index;
                if (indexStr) {
                    const index = parseInt(indexStr, 10);
                    if (currentPostIndexRef.current !== index) {
                         setCurrentPostIndex(index);
                         setIsPlaying(false);
                    }
                }
            }
        },
        { 
            root: feedContainerRef.current,
            threshold: 0.6, 
        }
    );

    const currentPostRefs = postRefs.current;
    currentPostRefs.forEach(ref => {
        if (ref) observer.observe(ref);
    });

    return () => {
        currentPostRefs.forEach(ref => {
            if (ref) observer.unobserve(ref);
        });
    };
  }, [posts]);


  useEffect(() => {
    if (posts.length > 0 && !isLoading && isInitialLoad.current) {
        isInitialLoad.current = false;
    }
  }, [posts, isLoading]);

  if (isLoading) {
    return (
      <div className="w-full max-w-lg md:max-w-2xl mx-auto flex flex-col items-center gap-6">
          <SkeletonPostCard />
          <SkeletonPostCard />
          <SkeletonPostCard />
      </div>
    );
  }

  return (
    <div ref={feedContainerRef} className="w-full max-w-lg md:max-w-2xl mx-auto flex flex-col items-center gap-6">
        <StoriesTray 
            currentUser={currentUser}
            storiesByAuthor={storiesByAuthor}
            onCreateStory={() => onNavigate(AppView.CREATE_STORY)}
            onViewStories={(initialUserIndex) => onNavigate(AppView.STORY_VIEWER, { storiesByAuthor, initialUserIndex })}
        />
        <CreatePostWidget 
            user={currentUser} 
            onStartCreatePost={onStartCreatePost}
        />
        <div className="w-full border-t border-fuchsia-500/20" />
        <RewardedAdWidget campaign={rewardedCampaign} onAdClick={onRewardedAdClick} />
        {visiblePosts.filter(Boolean).map((post, index) => (
            <div 
                key={`${post.id}-${index}`} 
                className="w-full"
                ref={el => { postRefs.current[index] = el; }}
                data-index={index}
            >
                <PostCard 
                    post={post} 
                    currentUser={currentUser}
                    isActive={index === currentPostIndex}
                    isPlaying={isPlaying && index === currentPostIndex}
                    onPlayPause={() => {
                        if (post.isSponsored && (post.videoUrl || post.imageUrl)) return;
                        if (index === currentPostIndex) {
                            setIsPlaying(p => !p)
                        } else {
                            isProgrammaticScroll.current = true;
                            setCurrentPostIndex(index);
                            setIsPlaying(true);
                        }
                    }}
                    onReact={onReactToPost}
                    onOpenComments={onOpenComments}
                    onAuthorClick={onOpenProfile}
                    onAdClick={onAdClick}
                    onSharePost={onSharePost}
                    onOpenPhotoViewer={onOpenPhotoViewer}
                    onDeletePost={onDeletePost}
                    onReportPost={onReportPost}
                    isSaved={currentUser.savedPostIds?.includes(post.id)}
                    onSavePost={onSavePost}
                    onCopyLink={onCopyLink}
                    onHidePost={onHidePost}
                />
            </div>
        ))}
    </div>
  );
};

export default FeedScreen;
