// @ts-nocheck
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { User, Post, Campaign, FriendshipStatus, Comment, Message, Conversation, ChatSettings, LiveAudioRoom, LiveVideoRoom, Group, Story, Event, GroupChat, JoinRequest, GroupCategory, StoryPrivacy, PollOption, AdminUser, CategorizedExploreFeed, Report, ReplyInfo, Author, Call, LiveAudioRoomMessage, LiveVideoRoomMessage, VideoParticipantState } from '../types';
import { MOCK_MUSIC_LIBRARY, DEFAULT_AVATARS, DEFAULT_COVER_PHOTOS } from '../constants';
import { firebaseService } from './firebaseService';


// --- Gemini API Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
    alert("CRITICAL ERROR: Gemini API key is not configured. Please ensure your environment variables are set up correctly.");
    throw new Error("API_KEY not configured. Please set it in your environment.");
}
const ai = new GoogleGenAI({ apiKey });

export const geminiService = {
  // --- Friends ---
  getFriendRequests: (userId: string): Promise<User[]> => firebaseService.getFriendRequests(userId),
  acceptFriendRequest: (currentUserId: string, requestingUserId: string) => firebaseService.acceptFriendRequest(currentUserId, requestingUserId),
  declineFriendRequest: (currentUserId: string, requestingUserId: string) => firebaseService.declineFriendRequest(currentUserId, requestingUserId),
  checkFriendshipStatus: (currentUserId: string, profileUserId: string): Promise<FriendshipStatus> => firebaseService.checkFriendshipStatus(currentUserId, profileUserId),
  addFriend: (currentUserId: string, targetUserId: string): Promise<{ success: boolean; reason?: string }> => firebaseService.addFriend(currentUserId, targetUserId),
  unfriendUser: (currentUserId: string, targetUserId: string) => firebaseService.unfriendUser(currentUserId, targetUserId),
  cancelFriendRequest: (currentUserId: string, targetUserId: string) => firebaseService.cancelFriendRequest(currentUserId, targetUserId),

  // --- This is a mock/simulated function ---
  async getRecommendedFriends(userId: string): Promise<User[]> {
      const allUsers = await firebaseService.getAllUsersForAdmin();
      const currentUser = allUsers.find(u => u.id === userId);
      if (!currentUser) return [];

      const friendsAndRequests = new Set([
          ...currentUser.friendIds || [],
          userId
      ]);

      return allUsers.filter(u => !friendsAndRequests.has(u.id));
  },
  
   async getFriendsList(userId: string): Promise<User[]> {
      const user = await firebaseService.getUserProfileById(userId);
      if (!user || !user.friendIds || user.friendIds.length === 0) {
          return [];
      }
      return await firebaseService.getUsersByIds(user.friendIds);
  },
  
  getCommonFriends: (userId1: string, userId2: string): Promise<User[]> => firebaseService.getCommonFriends(userId1, userId2),
  
  // --- Profile & Security ---
  async getUserById(userId: string): Promise<User | null> {
    return firebaseService.getUserProfileById(userId);
  },
  
  async searchUsers(query: string): Promise<User[]> {
    return firebaseService.searchUsers(query);
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<void> {
    await firebaseService.updateProfile(userId, updates);
  },
  
  async updateProfilePicture(userId: string, base64: string, caption?: string, captionStyle?: Post['captionStyle']): Promise<{ updatedUser: User; newPost: Post } | null> {
    return firebaseService.updateProfilePicture(userId, base64, caption, captionStyle);
  },
  
  async updateCoverPhoto(userId: string, base64: string, caption?: string, captionStyle?: Post['captionStyle']): Promise<{ updatedUser: User; newPost: Post } | null> {
    return firebaseService.updateCoverPhoto(userId, base64, caption, captionStyle);
  },

  async blockUser(currentUserId: string, targetUserId: string): Promise<boolean> {
      return firebaseService.blockUser(currentUserId, targetUserId);
  },
  
  async unblockUser(currentUserId: string, targetUserId: string): Promise<boolean> {
      return firebaseService.unblockUser(currentUserId, targetUserId);
  },

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<boolean> {
      // This is a mock for demonstration. Real password changes need secure backend logic.
      const user = await firebaseService.getUserProfileById(userId);
      if (user && user.password === currentPass) {
          await firebaseService.updateProfile(userId, { password: newPass });
          return true;
      }
      return false;
  },

  async deactivateAccount(userId: string): Promise<boolean> {
      return firebaseService.deactivateAccount(userId);
  },
  
  // --- Voice Coins ---
  async updateVoiceCoins(userId: string, amount: number): Promise<boolean> {
    return firebaseService.updateVoiceCoins(userId, amount);
  },

  // --- Image Generation ---
  async generateImageForPost(prompt: string): Promise<string | null> {
      // This is a mock function as image generation is a premium feature.
      // In a real app, this would call the Gemini Image API.
      // We will return a placeholder image from an external service.
      try {
          // A simple hash to get a different image for different prompts
          const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const imageUrl = `https://picsum.photos/seed/${hash}/1024`;
          // We need to fetch and convert to base64 to simulate the behavior of the real API returning image bytes.
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
          });
      } catch (error) {
          console.error("Failed to generate placeholder image:", error);
          return null;
      }
  },

  async editImage(base64ImageData: string, mimeType: string, prompt: string): Promise<string | null> {
    try {
        const imagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
            },
        };
        const textPart = {
            text: prompt,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                // Return a data URL for easy display
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null; // No image found in response
    } catch (error) {
        console.error("Error editing image with Gemini:", error);
        return null;
    }
  },
  
  // FIX: Added missing processIntent method.
  async processIntent(command: string, context?: any): Promise<{ intent: string, slots?: any }> {
    // This is a mock implementation. A real implementation would call the Gemini API.
    // For now, it uses simple keyword matching to resolve build errors and provide basic functionality.
    const lowerCommand = command.toLowerCase().trim();

    // Context-sensitive parsing (example)
    if (context?.userNames && context.userNames.length > 0) {
        for (const name of context.userNames) {
            if (lowerCommand.includes(name.toLowerCase())) {
                if (lowerCommand.startsWith('like')) return { intent: 'intent_like', slots: { target_name: name } };
                if (lowerCommand.includes('profile')) return { intent: 'intent_open_profile', slots: { target_name: name } };
                if (lowerCommand.includes('comment')) return { intent: 'intent_view_comments_by_author', slots: { target_name: name } };
            }
        }
    }

    // General commands
    if (lowerCommand.startsWith('search for')) return { intent: 'intent_search_user', slots: { target_name: lowerCommand.substring('search for'.length).trim() } };
    if (lowerCommand.startsWith('generate image')) return { intent: 'intent_generate_image', slots: { prompt: command.substring('generate image'.length).trim() } };
    if (lowerCommand.startsWith('add text')) return { intent: 'intent_add_text_to_story', slots: { text: command.substring('add text'.length).trim() } };
    
    // Simple keyword matching
    const intents: {[key: string]: string} = {
        'back': 'intent_go_back', 'go back': 'intent_go_back',
        'save': 'intent_save_settings',
        'next': 'intent_next_post',
        'previous': 'intent_previous_post',
        'play': 'intent_play_post',
        'pause': 'intent_pause_post',
        'like': 'intent_like',
        'share': 'intent_share',
        'comment': 'intent_comment',
        'view comments': 'intent_view_comments',
        'open profile': 'intent_open_profile',
        'create post': 'intent_create_post',
        'record voice': 'intent_create_voice_post',
        'stop recording': 'intent_stop_recording',
        're-record': 'intent_re_record',
        'post': 'intent_post_confirm',
        'clear image': 'intent_clear_image',
        'create poll': 'intent_create_poll',
        'add friend': 'intent_add_friend',
        'accept': 'intent_accept_request',
        'unfriend': 'intent_unfriend_user',
        'cancel request': 'intent_cancel_friend_request',
        'create group': 'intent_create_group',
        'manage group': 'intent_manage_group',
        'open chat': 'intent_open_group_chat',
        'open events': 'intent_open_group_events',
        'add music': 'intent_add_music',
        'share story': 'intent_post_story',
    };
    for (const keyword in intents) {
        if (lowerCommand.includes(keyword)) {
            return { intent: intents[keyword] };
        }
    }

    return { intent: 'unknown_intent', slots: {} };
  },

  // Music Library (Mock)
  getMusicLibrary(): MusicTrack[] {
      return MOCK_MUSIC_LIBRARY;
  },

  // --- Mocks & Simulations ---
  
  async sendAudioPost(userId: string, duration: number, caption: string): Promise<Post> {
    const user = await firebaseService.getUserProfileById(userId);
    if (!user) throw new Error("User not found for creating post");
    
    const newPost: Post = {
        id: `mock_${Date.now()}`,
        author: { id: user.id, name: user.name, username: user.username, avatarUrl: user.avatarUrl },
        audioUrl: '#', // Mock URL
        caption: caption,
        duration: duration,
        createdAt: new Date().toISOString(),
        commentCount: 0,
        comments: [],
        reactions: {},
    };

    await firebaseService.createPost(newPost, {});
    return newPost;
  },
  
  // --- Posts ---
  listenToFeedPosts: (currentUserId: string, friendIds: string[], blockedUserIds: string[], callback: (posts: Post[]) => void) => {
      return firebaseService.listenToFeedPosts(currentUserId, friendIds, blockedUserIds, callback);
  },
  getPostsByIds: (postIds: string[]): Promise<Post[]> => firebaseService.getPostsByIds(postIds),
  savePost: (userId: string, postId: string): Promise<boolean> => firebaseService.savePost(userId, postId),
  unsavePost: (userId: string, postId: string): Promise<boolean> => firebaseService.unsavePost(userId, postId),

  getChatId: (user1Id, user2Id) => firebaseService.getChatId(user1Id, user2Id),
  listenToMessages: (chatId, callback) => firebaseService.listenToMessages(chatId, callback),
  listenToConversations: (userId, callback) => firebaseService.listenToConversations(userId, callback),
  sendMessage: (chatId, sender, recipient, messageContent) => firebaseService.sendMessage(chatId, sender, recipient, messageContent),
  unsendMessage: (chatId, messageId, userId) => firebaseService.unsendMessage(chatId, messageId, userId),
  reactToMessage: (chatId, messageId, userId, emoji) => firebaseService.reactToMessage(chatId, messageId, userId, emoji),
  deleteChatHistory: (chatId) => firebaseService.deleteChatHistory(chatId),
  getChatSettings: (chatId) => firebaseService.getChatSettings(chatId),
  updateChatSettings: (chatId, settings) => firebaseService.updateChatSettings(chatId, settings),
  markMessagesAsRead: (chatId, userId) => firebaseService.markMessagesAsRead(chatId, userId),

    createReplySnippet(message: Message): ReplyInfo {
        let content = '';
        if (message.isDeleted) {
            content = "Unsent message";
        } else {
            switch(message.type) {
                case 'text': content = message.text || ''; break;
                case 'image': content = 'Image'; break;
                case 'video': content = 'Video'; break;
                case 'audio': content = `Voice Message · ${message.duration}s`; break;
            }
        }
        return {
            messageId: message.id,
            senderName: message.senderId,
            content: content
        };
    },

    // --- Rooms ---
    listenToLiveAudioRooms: (callback: (rooms: LiveAudioRoom[]) => void) => firebaseService.listenToLiveAudioRooms(callback),
    listenToLiveVideoRooms: (callback: (rooms: LiveVideoRoom[]) => void) => firebaseService.listenToLiveVideoRooms(callback),
    listenToAudioRoom: (roomId: string, callback: (room: LiveAudioRoom | null) => void) => firebaseService.listenToRoom(roomId, 'audio', callback),
    listenToVideoRoom: (roomId: string, callback: (room: LiveVideoRoom | null) => void) => firebaseService.listenToRoom(roomId, 'video', callback),
    createLiveAudioRoom: (host: User, topic: string) => firebaseService.createLiveAudioRoom(host, topic),
    createLiveVideoRoom: (host: User, topic: string) => firebaseService.createLiveVideoRoom(host, topic),
    joinLiveAudioRoom: (userId: string, roomId: string) => firebaseService.joinLiveAudioRoom(userId, roomId),
    joinLiveVideoRoom: (userId: string, roomId: string) => firebaseService.joinLiveVideoRoom(userId, roomId),
    leaveLiveAudioRoom: (userId: string, roomId: string) => firebaseService.leaveLiveAudioRoom(userId, roomId),
    leaveLiveVideoRoom: (userId: string, roomId: string) => firebaseService.leaveLiveVideoRoom(userId, roomId),
    endLiveAudioRoom: (userId: string, roomId: string) => firebaseService.endLiveAudioRoom(userId, roomId),
    endLiveVideoRoom: (userId: string, roomId: string) => firebaseService.endLiveVideoRoom(userId, roomId),
    getAudioRoomDetails: (roomId: string) => firebaseService.getAudioRoomDetails(roomId),
    getRoomDetails: (roomId: string, type: 'audio' | 'video') => firebaseService.getRoomDetails(roomId, type),
    raiseHandInAudioRoom: (userId: string, roomId: string) => firebaseService.raiseHandInAudioRoom(userId, roomId),
    inviteToSpeakInAudioRoom: (hostId: string, userId: string, roomId: string) => firebaseService.inviteToSpeakInAudioRoom(hostId, userId, roomId),
    moveToAudienceInAudioRoom: (hostId: string, userId: string, roomId: string) => firebaseService.moveToAudienceInAudioRoom(hostId, userId, roomId),
    listenToLiveAudioRoomMessages: (roomId: string, callback: (messages: LiveAudioRoomMessage[]) => void) => firebaseService.listenToLiveAudioRoomMessages(roomId, callback),
    sendLiveAudioRoomMessage: (roomId: string, sender: User, text: string, isHost: boolean, isSpeaker: boolean) => firebaseService.sendLiveAudioRoomMessage(roomId, sender, text, isHost, isSpeaker),
    reactToLiveAudioRoomMessage: (roomId: string, messageId: string, userId: string, emoji: string) => firebaseService.reactToLiveAudioRoomMessage(roomId, messageId, userId, emoji),
    listenToLiveVideoRoomMessages: (roomId: string, callback: (messages: LiveVideoRoomMessage[]) => void) => firebaseService.listenToLiveVideoRoomMessages(roomId, callback),
    sendLiveVideoRoomMessage: (roomId: string, sender: User, text: string) => firebaseService.sendLiveVideoRoomMessage(roomId, sender, text),
    updateParticipantStateInVideoRoom: (roomId: string, userId: string, updates: Partial<VideoParticipantState>) => firebaseService.updateParticipantStateInVideoRoom(roomId, userId, updates),
    
    // --- Ads & Campaigns ---
    getCampaignsForSponsor: (sponsorId: string) => firebaseService.getCampaignsForSponsor(sponsorId),
    submitCampaignForApproval: (campaignData: Omit<Campaign, 'id'|'views'|'clicks'|'status'|'transactionId'>, transactionId: string) => firebaseService.submitCampaignForApproval(campaignData, transactionId),
    getRandomActiveCampaign: () => firebaseService.getRandomActiveCampaign(),
    trackAdView: (campaignId: string) => firebaseService.trackAdView(campaignId),
    trackAdClick: (campaignId: string) => firebaseService.trackAdClick(campaignId),
    submitLead: (leadData: Omit<Lead, 'id'>) => firebaseService.submitLead(leadData),
    getLeadsForCampaign: (campaignId: string) => firebaseService.getLeadsForCampaign(campaignId),
    getInjectableAd: (currentUser: User) => firebaseService.getInjectableAd(currentUser),
    getInjectableStoryAd: (currentUser: User) => firebaseService.getInjectableStoryAd(currentUser),

    // --- Stories ---
    getStories: (currentUserId: string) => firebaseService.getStories(currentUserId),
    markStoryAsViewed: (storyId: string, userId: string) => firebaseService.markStoryAsViewed(storyId, userId),
    createStory: (storyData, mediaFile) => firebaseService.createStory(storyData, mediaFile),
    
    // --- Groups ---
    listenToUserGroups: (userId: string, callback: (groups: Group[]) => void) => firebaseService.listenToUserGroups(userId, callback),
    listenToGroup: (groupId: string, callback: (group: Group | null) => void) => firebaseService.listenToGroup(groupId, callback),
    getGroupById: (groupId: string) => firebaseService.getGroupById(groupId),
    getSuggestedGroups: (userId: string) => firebaseService.getSuggestedGroups(userId),
    createGroup: (creator, name, description, coverPhotoUrl, privacy, requiresApproval, category) => firebaseService.createGroup(creator, name, description, coverPhotoUrl, privacy, requiresApproval, category),
    joinGroup: (userId, groupId, answers) => firebaseService.joinGroup(userId, groupId, answers),
    leaveGroup: (userId, groupId) => firebaseService.leaveGroup(userId, groupId),
    getPostsForGroup: (groupId) => firebaseService.getPostsForGroup(groupId),
    listenToPostsForGroup: (groupId: string, callback: (posts: Post[]) => void) => firebaseService.listenToPostsForGroup(groupId, callback),
    updateGroupSettings: (groupId, settings) => firebaseService.updateGroupSettings(groupId, settings),
    pinPost: (groupId, postId) => firebaseService.pinPost(groupId, postId),
    unpinPost: (groupId) => firebaseService.unpinPost(groupId),
    voteOnPoll: (userId, postId, optionIndex) => firebaseService.voteOnPoll(userId, postId, optionIndex),
    markBestAnswer: (userId, postId, commentId) => firebaseService.markBestAnswer(userId, postId, commentId),
    inviteFriendToGroup: (groupId, friendId) => firebaseService.inviteFriendToGroup(groupId, friendId),
    
    // --- Group Chat & Events ---
    listenToGroupChat: (groupId: string, callback: (chat: GroupChat | null) => void) => firebaseService.listenToGroupChat(groupId, callback),
    getGroupChat: (groupId: string) => firebaseService.getGroupChat(groupId),
    sendGroupChatMessage: (groupId, sender, text) => firebaseService.sendGroupChatMessage(groupId, sender, text),
    reactToGroupChatMessage: (groupId: string, messageId: string, userId: string, emoji: string) => firebaseService.reactToGroupChatMessage(groupId, messageId, userId, emoji),
    getGroupEvents: (groupId: string) => firebaseService.getGroupEvents(groupId),
    createGroupEvent: (creator, groupId, title, description, date) => firebaseService.createGroupEvent(creator, groupId, title, description, date),
    rsvpToEvent: (userId, eventId) => firebaseService.rsvpToEvent(userId, eventId),
    
    // --- Admin Panel ---
    adminLogin: (email, password) => firebaseService.adminLogin(email, password),
    adminRegister: (email, password) => firebaseService.adminRegister(email, password),
    getAdminDashboardStats: () => firebaseService.getAdminDashboardStats(),
    getAllUsersForAdmin: () => firebaseService.getAllUsersForAdmin(),
    updateUserRole: (userId, newRole) => firebaseService.updateUserRole(userId, newRole),
    getPendingCampaigns: () => firebaseService.getPendingCampaigns(),
    approveCampaign: (campaignId) => firebaseService.approveCampaign(campaignId),
    rejectCampaign: (campaignId, reason) => firebaseService.rejectCampaign(campaignId, reason),
    getAllPostsForAdmin: () => firebaseService.getAllPostsForAdmin(),
    deletePostAsAdmin: (postId) => firebaseService.deletePostAsAdmin(postId),
    deleteCommentAsAdmin: (commentId, postId) => firebaseService.deleteCommentAsAdmin(commentId, postId),
    getPostById: (postId) => firebaseService.getPostById(postId),
    getPendingReports: () => firebaseService.getPendingReports(),
    resolveReport: (reportId, resolution) => firebaseService.resolveReport(reportId, resolution),
    createReport: (reporter: User, content: Post | Comment | User, contentType: 'post' | 'comment' | 'user', reason: string) => firebaseService.createReport(reporter, content, contentType, reason),
    banUser: (userId) => firebaseService.banUser(userId),
    unbanUser: (userId) => firebaseService.unbanUser(userId),
    warnUser: (userId, message) => firebaseService.warnUser(userId, message),
    suspendUserCommenting: (userId, days) => firebaseService.suspendUserCommenting(userId, days),
    liftUserCommentingSuspension: (userId) => firebaseService.liftUserCommentingSuspension(userId),
    suspendUserPosting: (userId, days) => firebaseService.suspendUserPosting(userId, days),
    liftUserPostingSuspension: (userId) => firebaseService.liftUserPostingSuspension(userId),
    getUserDetailsForAdmin: (userId) => firebaseService.getUserDetailsForAdmin(userId),
    sendSiteWideAnnouncement: (message) => firebaseService.sendSiteWideAnnouncement(message),
    getAllCampaignsForAdmin: () => firebaseService.getAllCampaignsForAdmin(),
    verifyCampaignPayment: (campaignId, adminId) => firebaseService.verifyCampaignPayment(campaignId, adminId),
    adminUpdateUserProfilePicture: (userId, base64) => firebaseService.adminUpdateUserProfilePicture(userId, base64),
    reactivateUserAsAdmin: (userId) => firebaseService.reactivateUserAsAdmin(userId),
    promoteGroupMember: (groupId: string, userToPromote: User, newRole: 'Admin' | 'Moderator') => firebaseService.promoteGroupMember(groupId, userToPromote, newRole),
    demoteGroupMember: (groupId: string, userToDemote: User, oldRole: 'Admin' | 'Moderator') => firebaseService.demoteGroupMember(groupId, userToDemote, oldRole),
    removeGroupMember: (groupId: string, userToRemove: User) => firebaseService.removeGroupMember(groupId, userToRemove),
    approveJoinRequest: (groupId: string, userId: string) => firebaseService.approveJoinRequest(groupId, userId),
    rejectJoinRequest: (groupId: string, userId: string) => firebaseService.rejectJoinRequest(groupId, userId),
    approvePost: (postId: string) => firebaseService.approvePost(postId),
    rejectPost: (postId: string) => firebaseService.rejectPost(postId),
    async getCategorizedExploreFeed(userId: string): Promise<CategorizedExploreFeed> {
        const posts = await firebaseService.getExplorePosts(userId);
        if (posts.length === 0) {
            return { trending: [], forYou: [], recent: [], funnyVoiceNotes: [], newTalent: [] };
        }

        const postsById = new Map(posts.map(p => [p.id, p]));
        
        const lightweightPosts = posts.map(p => {
            const { comments, reactions, ...rest } = p;
            return {
                ...rest,
                reactionCount: Object.keys(reactions || {}).length,
            };
        });

        const systemInstruction = `You are a social media content curator for VoiceBook. You will be given a list of posts in JSON format. Your task is to categorize these posts into the following categories: 'trending', 'forYou', 'recent', 'funnyVoiceNotes', 'newTalent'. Return a single JSON object with keys corresponding to these categories, and the values should be an array of the original post objects that fit into that category. A post can appear in multiple categories if it fits. 
        
        CRITICAL INSTRUCTIONS FOR 'forYou' CATEGORY:
        1.  Create a diverse and engaging feed. It should be a MIX of content types: image posts, short videos (posts with a 'videoUrl'), and interesting audio notes.
        2.  AVOID showing too many posts with a postType of 'profile_picture_change' or 'cover_photo_change'. Do not let these dominate the feed. Prefer posts with original content.
        3.  Prioritize content that is visually appealing or has good engagement (reactionCount, commentCount) but is different from the main 'trending' category.

        General Rules:
        - 'trending' should be based on high engagement (reactionCount/commentCount).
        - 'recent' are the 5-10 most recent posts based on their 'createdAt' timestamp.
        - 'funnyVoiceNotes' are audio posts that seem humorous from their caption.
        - 'newTalent' are posts from newer users or with unique content.`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Here are the posts to categorize: ${JSON.stringify(lightweightPosts)}`,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                },
            });

            const jsonString = response.text.trim();
            const categorizedLightweightFeed = JSON.parse(jsonString);

            const rehydratedFeed: CategorizedExploreFeed = { trending: [], forYou: [], recent: [], funnyVoiceNotes: [], newTalent: [] };
            for (const category of Object.keys(rehydratedFeed)) {
                if (categorizedLightweightFeed[category]) {
                    rehydratedFeed[category] = categorizedLightweightFeed[category]
                        .map((lightPost: Post) => postsById.get(lightPost.id))
                        .filter((p: Post | undefined): p is Post => !!p);
                }
            }
            return rehydratedFeed;
            
        } catch (error) {
            console.error("Failed to parse categorized feed from Gemini:", error);
            // Fallback to a simple categorization if Gemini fails
            return {
                trending: posts.slice(0, 5),
                forYou: posts.slice(5, 10),
                recent: posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
                funnyVoiceNotes: [],
                newTalent: [],
            };
        }
    },
    
    // --- 1-on-1 Calls ---
    createCall: (caller, callee, chatId, type) => firebaseService.createCall(caller, callee, chatId, type),
    listenForIncomingCalls: (userId, callback) => firebaseService.listenForIncomingCalls(userId, callback),
    listenToCall: (callId, callback) => firebaseService.listenToCall(callId, callback),
    updateCallStatus: (callId, status) => firebaseService.updateCallStatus(callId, status),

    getAgoraToken: (channelName: string, uid: string | number) => firebaseService.getAgoraToken(channelName, uid),
};