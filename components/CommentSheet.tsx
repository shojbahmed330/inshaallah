import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Post, User, Comment } from '../types';
import { PostCard } from './PostCard';
import CommentCard from './CommentCard';
import { firebaseService } from '../services/firebaseService';
import Icon from './Icon';
import { getTtsPrompt } from '../constants';
import { useSettings } from '../contexts/SettingsContext';

interface CommentSheetProps {
  initialPost: Post;
  commentToReplyTo?: Comment;
  currentUser: User;
  onClose: () => void;
  onReactToPost: (postId: string, emoji: string) => void;
  onReactToComment: (postId: string, commentId: string, emoji: string) => void;
  onPostComment: (postId: string, text: string, parentId?: string | null) => Promise<void>;
  onEditComment: (postId: string, commentId: string, newText: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onReportPost: (post: Post) => void;
  onReportComment: (comment: Comment) => void;
  onOpenProfile: (userName: string) => void;
  onSharePost: (post: Post) => void;
  onOpenPhotoViewer: (post: Post, initialUrl?: string) => void;
}

const CommentSheet: React.FC<CommentSheetProps> = ({
  initialPost,
  commentToReplyTo,
  currentUser,
  onClose,
  onReactToPost,
  onReactToComment,
  onPostComment,
  onEditComment,
  onDeleteComment,
  onOpenProfile,
  onSharePost,
  onOpenPhotoViewer,
  onReportPost,
  onReportComment
}) => {
  const [post, setPost] = useState<Post | null>(initialPost);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingCommentId, setPlayingCommentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(commentToReplyTo || null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  const [isPostMenuOpen, setPostMenuOpen] = useState(false);
  const postMenuRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { language } = useSettings();

  useEffect(() => {
    const unsubscribe = firebaseService.listenToPost(initialPost.id, (livePost) => {
      setPost(livePost);
    });
    return unsubscribe;
  }, [initialPost.id]);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300); // Wait for animation to finish
  };

  useEffect(() => {
    if (replyingTo) {
        commentInputRef.current?.focus();
        setNewCommentText(`@${replyingTo.author.username} `);
    } else if (commentToReplyTo) {
        setReplyingTo(commentToReplyTo);
    }
  }, [replyingTo, commentToReplyTo]);

  const commentsToDisplay = useMemo(() => {
    if (!post?.comments) return [];
    const imageCount = post.imageDetails?.length ?? (post.imageUrl || post.newPhotoUrl ? 1 : 0);
    if (imageCount > 1) {
      // For multi-image posts, only show general comments in the sheet.
      return post.comments.filter(c => c && !c.imageId);
    }
    // For single-image or no-image posts, show all comments.
    return post.comments.filter(c => c);
  }, [post]);

  const generalCommentCount = useMemo(() => commentsToDisplay.length, [commentsToDisplay]);

  const commentThreads = useMemo(() => {
    if (!commentsToDisplay) return [];
    const comments = [...commentsToDisplay].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const commentsById = new Map<string, Comment & { replies: Comment[] }>();
    comments.forEach(c => commentsById.set(c.id, { ...c, replies: [] }));
    const topLevelComments: (Comment & { replies: Comment[] })[] = [];
    comments.forEach(c => {
        const commentWithReplies = commentsById.get(c.id);
        if (!commentWithReplies) return;
        if (c.parentId && commentsById.has(c.parentId)) {
            commentsById.get(c.parentId)?.replies.push(commentWithReplies);
        } else {
            topLevelComments.push(commentWithReplies);
        }
    });
    return topLevelComments;
  }, [commentsToDisplay]);

  const handlePlayComment = useCallback((comment: Comment) => {
    if (comment.type !== 'audio') return;
    setPlayingCommentId(prev => prev === comment.id ? null : comment.id);
  }, []);
  
  const handlePostCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !newCommentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      await onPostComment(post.id, newCommentText, replyingTo?.id || null);
      setNewCommentText('');
      setReplyingTo(null);
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setIsPostingComment(false);
    }
  };

  const CommentWithReplies: React.FC<{ comment: Comment & { replies: Comment[] }, isReply?: boolean }> = ({ comment, isReply = false }) => (
    <div className="flex flex-col gap-3">
        <div>
            <CommentCard
                comment={comment}
                currentUser={currentUser}
                isPlaying={playingCommentId === comment.id}
                onPlayPause={() => handlePlayComment(comment)}
                onAuthorClick={onOpenProfile}
                onReply={setReplyingTo}
                onReact={(commentId, emoji) => post && onReactToComment(post.id, commentId, emoji)}
                onEdit={(commentId, newText) => post && onEditComment(post.id, commentId, newText)}
                onDelete={(commentId) => post && onDeleteComment(post.id, commentId)}
                onReport={onReportComment}
                isReply={isReply}
            />
        </div>
        {comment.replies?.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-slate-700 space-y-3">
                {comment.replies.map(reply => (
                    <CommentWithReplies key={reply.id} comment={reply as Comment & { replies: Comment[] }} isReply={true} />
                ))}
            </div>
        )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-end animate-fade-in-fast" onClick={handleClose}>
      <div 
        className={`bg-slate-900 w-full max-w-2xl h-[68vh] rounded-t-2xl flex flex-col ${isClosing ? 'animate-slide-out-to-bottom' : 'animate-slide-in-from-bottom'}`}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex-shrink-0 p-4 border-b border-slate-700/50 flex items-center justify-center relative">
            <div className="w-10 h-1.5 bg-slate-700 rounded-full absolute top-2"></div>
            <h2 className="text-xl font-bold text-slate-100">Comments ({generalCommentCount})</h2>
            <button onClick={handleClose} className="absolute top-2 right-3 p-2 rounded-full text-slate-400 hover:bg-slate-800">
                <Icon name="close" className="w-6 h-6" />
            </button>
        </header>
        
        <div className="flex-grow overflow-y-auto">
            {post ? (
                <div className="flex flex-col gap-6 p-4">
                    {/* Simplified Post Header */}
                    <div className="flex items-center justify-between">
                        <button onClick={() => onOpenProfile(post.author.username)} className="flex items-center text-left group">
                            <img src={post.author.avatarUrl} alt={post.author.name} className="w-12 h-12 rounded-full mr-4"/>
                            <div>
                                <p className="font-bold text-fuchsia-300 text-lg group-hover:underline">{post.author.name}</p>
                                <p className="text-fuchsia-500 text-sm">{new Date(post.createdAt).toLocaleDateString()}</p>
                            </div>
                        </button>
                        {post.author.id !== currentUser.id && (
                            <div className="relative" ref={postMenuRef}>
                                <button onClick={() => setPostMenuOpen(p => !p)}>
                                    <Icon name="ellipsis-vertical" className="w-6 h-6 text-slate-400" />
                                </button>
                                {isPostMenuOpen && (
                                    <div className="absolute top-full right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 text-sm font-semibold">
                                        <button onClick={() => { onReportPost(post); setPostMenuOpen(false); }} className="w-full text-left px-4 py-2 text-yellow-400 hover:bg-yellow-500/10">Report Post</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {post.caption && <p className="text-slate-200">{post.caption}</p>}
                    
                    <div className="border-t border-slate-700/50" />
                    
                    <div className="flex flex-col gap-4">
                        {commentThreads.length > 0 ? commentThreads.map(comment => (
                            <CommentWithReplies key={comment.id} comment={comment} />
                        )) : (
                            <p className="text-slate-400 text-center py-4">Be the first to comment.</p>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-center p-8 text-slate-400">Loading post...</p>
            )}
        </div>

        <footer className="flex-shrink-0 p-3 border-t border-slate-700 bg-slate-800/50">
            {replyingTo && (
                <div className="text-xs text-slate-400 px-2 pb-2 flex justify-between items-center">
                    <span>Replying to {replyingTo.author.name}</span>
                    <button onClick={() => setReplyingTo(null)} className="font-bold">Cancel</button>
                </div>
            )}
            <form onSubmit={handlePostCommentSubmit} className="flex items-center gap-2">
                <img src={currentUser.avatarUrl} alt="Your avatar" className="w-9 h-9 rounded-full" />
                <input
                    ref={commentInputRef}
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-grow bg-slate-800 border border-slate-700 text-slate-100 rounded-full py-2.5 px-4 focus:ring-fuchsia-500 focus:border-fuchsia-500"
                    autoFocus={!!commentToReplyTo}
                />
                 <button type="submit" className="p-2.5 rounded-full bg-fuchsia-600 text-white hover:bg-fuchsia-500 disabled:bg-slate-500" disabled={!newCommentText.trim() || isPostingComment}>
                    <Icon name="paper-airplane" className="w-5 h-5" />
                 </button>
            </form>
        </footer>
      </div>
    </div>
  );
};

export default CommentSheet;