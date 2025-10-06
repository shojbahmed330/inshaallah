// @ts-nocheck
import { GoogleGenAI, Type } from "@google/genai";
import { User, Post, Campaign, FriendshipStatus, Comment, Group, Message, ReplyInfo, MusicTrack } from '../types';
import { firebaseService } from './firebaseService';
import { MOCK_MUSIC_LIBRARY } from '../constants';


// --- Gemini API Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
    alert("CRITICAL ERROR: Gemini API key is not configured. Please ensure your environment variables are set up correctly.");
    throw new Error("API_KEY not configured. Please set it in your environment.");
}
const ai = new GoogleGenAI({ apiKey });

export const geminiService = {
  // --- Intent Processing ---
  async processIntent(command: string, context?: any): Promise<{ intent: string; slots?: any }> {
    const systemInstruction = `You are an intent recognition system for a social media app called VoiceBook. Your task is to understand user commands in any language (especially English and Bengali) and extract relevant information.
    
    Available Intents:
    - Navigation: intent_open_feed, intent_open_friends_page, intent_open_messages, intent_open_settings, intent_go_back, intent_open_profile, intent_open_explore, intent_open_reels, intent_open_rooms, intent_open_groups, intent_open_ads_center, intent_open_menu.
    - Scrolling & Feed Navigation: intent_scroll_down, intent_scroll_up, intent_stop_scroll, intent_next_post, intent_previous_post.
    - Post Interaction: intent_like, intent_share, intent_comment, intent_play_post, intent_pause_post, intent_save_post, intent_copy_link, intent_hide_post, intent_report_post.
    - Post Creation: intent_create_post, intent_create_voice_post, intent_start_recording, intent_stop_recording, intent_re_record, intent_post_confirm, intent_clear_image, intent_create_poll.
    - Friends: intent_accept_request, intent_decline_request, intent_add_friend, intent_unfriend_user, intent_cancel_friend_request.
    - Comments: intent_play_comment_by_author.
    - Rooms/Groups: intent_create_group, intent_manage_group, intent_open_group_invite_page, intent_open_group_chat, intent_open_group_events.
    - Stories: intent_add_music, intent_post_story.
    - Ads: intent_create_campaign, intent_view_campaign_dashboard, intent_launch_campaign.
    - General: intent_reload_page, intent_unknown.
    
    Intents with slots:
    - intent_open_profile: { "target_name": "my" | "<user name>" } (Bengali: "আমার প্রোফাইল", "এক্স ব্যবহারকারীর প্রোফাইল")
    - intent_search_user: { "target_name": "<user name>" } (Bengali: "খোঁজো [নাম]")
    - intent_generate_image: { "prompt": "<image description>" } (Bengali: "একটা ছবি আঁকো [বিবরণ]")
    - intent_add_text_to_story: { "text": "<story text>" } (Bengali: "স্টোরিতে লেখো [টেক্সট]")
    - intent_set_story_privacy: { "privacy_level": "public" | "friends" } (Bengali: "প্রাইভেসি পাবলিক করো")
    - intent_view_group_by_name: { "group_name": "<group name>" } (Bengali: "[গ্রুপের নাম] গ্রুপটা দেখাও")
    - intent_filter_groups_by_category: { "category_name": "<category>" } (Bengali: "[ক্যাটাগরি] গ্রুপের তালিকা দেখাও")
    - intent_search_group: { "search_query": "<query>" } (Bengali: "[বিষয়] নিয়ে গ্রুপ খোঁজো")
    - intent_set_sponsor_name, intent_set_campaign_caption, intent_set_campaign_budget, intent_set_media_type.

    Context for the current screen may be provided. Use it to resolve ambiguity. Context: ${JSON.stringify(context || {})}
    
    The user command can be in English, Bengali, or a mix (Banglish). Interpret it correctly.
    Respond with a single JSON object: {"intent": "intent_name", "slots": {"key": "value"}}. Do not add any other text.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Command: "${command}"`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
            },
        });
        
        const jsonString = response.text.trim();
        const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, '');
        const result = JSON.parse(cleanedJsonString);
        return result;

    } catch (error) {
        console.error("Error processing intent with Gemini:", error);
        try {
            const match = error.toString().match(/\{.*\}/s);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch(e) { /* ignore parse error */ }
        return { intent: 'intent_unknown' };
    }
  },
  
  // --- This service now acts as a facade, calling firebaseService for data operations ---
  // --- This keeps the UI components clean and separates concerns. ---

  getFriendRequests: (userId) => firebaseService.getFriendRequests(userId),
  acceptFriendRequest: (currentUserId, requestingUserId) => firebaseService.acceptFriendRequest(currentUserId, requestingUserId),
  declineFriendRequest: (currentUserId, requestingUserId) => firebaseService.declineFriendRequest(currentUserId, requestingUserId),
  addFriend: (currentUserId, targetUserId) => firebaseService.addFriend(currentUserId, targetUserId),
  unfriendUser: (currentUserId, targetUserId) => firebaseService.unfriendUser(currentUserId, targetUserId),
  cancelFriendRequest: (currentUserId, targetUserId) => firebaseService.cancelFriendRequest(currentUserId, targetUserId),
  getRecommendedFriends: (userId) => firebaseService.getRecommendedFriends(userId),
  getCommonFriends: (userId1, userId2) => firebaseService.getCommonFriends(userId1, userId2),
  
  getUserById: (userId) => firebaseService.getUserProfileById(userId),
  searchUsers: (query) => firebaseService.searchUsers(query),
  updateProfile: (userId, updates) => firebaseService.updateProfile(userId, updates),
  updateProfilePicture: (userId, base64, caption, style) => firebaseService.updateProfilePicture(userId, base64, caption, style),
  updateCoverPhoto: (userId, base64, caption, style) => firebaseService.updateCoverPhoto(userId, base64, caption, style),
  blockUser: (currentUserId, targetUserId) => firebaseService.blockUser(currentUserId, targetUserId),
  unblockUser: (currentUserId, targetUserId) => firebaseService.unblockUser(currentUserId, targetUserId),
  changePassword: (userId, currentPass, newPass) => firebaseService.changePassword(userId, currentPass, newPass),
  deactivateAccount: (userId) => firebaseService.deactivateAccount(userId),
  
  updateVoiceCoins: (userId, amount) => firebaseService.updateVoiceCoins(userId, amount),
  
  savePost: (userId, postId) => firebaseService.savePost(userId, postId),
  unsavePost: (userId, postId) => firebaseService.unsavePost(userId, postId),
  getPostsByIds: (postIds) => firebaseService.getPostsByIds(postIds),

  async generateImageForPost(prompt: string): Promise<string | null> {
      try {
          const hash = prompt.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const imageUrl = `https://picsum.photos/seed/${hash}/1024`;
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

  // Groups
  getGroupById: (groupId) => firebaseService.getGroupById(groupId),
  getSuggestedGroups: (userId) => firebaseService.getSuggestedGroups(userId),
  createGroup: (creator, name, description, coverUrl, privacy, requiresApproval, category) => firebaseService.createGroup(creator, name, description, coverUrl, privacy, requiresApproval, category),
  updateGroupSettings: (groupId, settings) => firebaseService.updateGroupSettings(groupId, settings),

  // Stories
  getStories: (currentUserId) => firebaseService.getStories(currentUserId),

  // Reports
  createReport: (reporter, content, contentType, reason) => firebaseService.createReport(reporter, content, contentType, reason),
  
  // Admin
  getPendingCampaigns: () => firebaseService.getPendingCampaigns(),
  approveCampaign: (campaignId) => firebaseService.approveCampaign(campaignId),
  rejectCampaign: (campaignId, reason) => firebaseService.rejectCampaign(campaignId, reason),
  getAllUsersForAdmin: () => firebaseService.getAllUsersForAdmin(),
  banUser: (userId) => firebaseService.banUser(userId),
  unbanUser: (userId) => firebaseService.unbanUser(userId),
  suspendUserCommenting: (userId, days) => firebaseService.suspendUserCommenting(userId, days),
  liftUserCommentingSuspension: (userId) => firebaseService.liftUserCommentingSuspension(userId),
  suspendUserPosting: (userId, days) => firebaseService.suspendUserPosting(userId, days),
  liftUserPostingSuspension: (userId) => firebaseService.liftUserPostingSuspension(userId),
  warnUser: (userId, message) => firebaseService.warnUser(userId, message),
  reactivateUserAsAdmin: (userId) => firebaseService.reactivateUserAsAdmin(userId),
  adminUpdateUserProfilePicture: (userId, base64) => firebaseService.adminUpdateUserProfilePicture(userId, base64),
  
  // Polls & Answers
  voteOnPoll: (userId, postId, optionIndex) => firebaseService.voteOnPoll(userId, postId, optionIndex),
  markBestAnswer: (userId, postId, commentId) => firebaseService.markBestAnswer(userId, postId, commentId),

  // FIX: Add missing service methods by delegating to firebaseService or providing mock implementations.
  getRandomActiveCampaign: () => firebaseService.getRandomActiveCampaign(),
  getCampaignsForSponsor: (sponsorId) => firebaseService.getCampaignsForSponsor(sponsorId),
  submitCampaignForApproval: (campaignData, transactionId) => firebaseService.submitCampaignForApproval(campaignData, transactionId),
  updateUserRole: (userId, newRole) => firebaseService.updateUserRole(userId, newRole),
  getAllPostsForAdmin: () => firebaseService.getAllPostsForAdmin(),
  deletePostAsAdmin: (postId) => firebaseService.deletePostAsAdmin(postId),
  deleteCommentAsAdmin: (commentId, postId) => firebaseService.deleteCommentAsAdmin(commentId, postId),
  getAdminDashboardStats: () => firebaseService.getAdminDashboardStats(),
  listenToLiveAudioRooms: (callback) => firebaseService.listenToLiveAudioRooms(callback),
  createLiveAudioRoom: (host, topic) => firebaseService.createLiveAudioRoom(host, topic),
  getAgoraToken: (channelName, uid) => firebaseService.getAgoraToken(channelName, uid),
  joinLiveAudioRoom: (userId, roomId) => firebaseService.joinLiveAudioRoom(userId, roomId),
  leaveLiveAudioRoom: (userId, roomId) => firebaseService.leaveLiveAudioRoom(userId, roomId),
  listenToAudioRoom: (roomId, callback) => firebaseService.listenToRoom(roomId, 'audio', callback),
  endLiveAudioRoom: (userId, roomId) => firebaseService.endLiveAudioRoom(userId, roomId),
  raiseHandInAudioRoom: (userId, roomId) => firebaseService.raiseHandInAudioRoom(userId, roomId),
  inviteToSpeakInAudioRoom: (hostId, userId, roomId) => firebaseService.inviteToSpeakInAudioRoom(hostId, userId, roomId),
  moveToAudienceInAudioRoom: (hostId, userId, roomId) => firebaseService.moveToAudienceInAudioRoom(hostId, userId, roomId),
  listenToLiveAudioRoomMessages: (roomId, callback) => firebaseService.listenToLiveAudioRoomMessages(roomId, callback),
  sendLiveAudioRoomMessage: (roomId, sender, text, isHost, isSpeaker) => firebaseService.sendLiveAudioRoomMessage(roomId, sender, text, isHost, isSpeaker),
  reactToLiveAudioRoomMessage: (roomId, messageId, userId, emoji) => firebaseService.reactToLiveAudioRoomMessage(roomId, messageId, userId, emoji),
  listenToLiveVideoRooms: (callback) => firebaseService.listenToLiveVideoRooms(callback),
  createLiveVideoRoom: (host, topic) => firebaseService.createLiveVideoRoom(host, topic),
  endLiveVideoRoom: (userId, roomId) => firebaseService.endLiveVideoRoom(userId, roomId),
  leaveLiveVideoRoom: (userId, roomId) => firebaseService.leaveLiveVideoRoom(userId, roomId),
  updateParticipantStateInVideoRoom: (roomId, userId, updates) => firebaseService.updateParticipantStateInVideoRoom(roomId, userId, updates),
  joinLiveVideoRoom: (userId, roomId) => firebaseService.joinLiveVideoRoom(userId, roomId),
  listenToVideoRoom: (roomId, callback) => firebaseService.listenToRoom(roomId, 'video', callback),
  listenToLiveVideoRoomMessages: (roomId, callback) => firebaseService.listenToLiveVideoRoomMessages(roomId, callback),
  sendLiveVideoRoomMessage: (roomId, sender, text) => firebaseService.sendLiveVideoRoomMessage(roomId, sender, text),
  listenToGroup: (groupId, callback) => firebaseService.listenToGroup(groupId, callback),
  listenToPostsForGroup: (groupId, callback) => firebaseService.listenToPostsForGroup(groupId, callback),
  joinGroup: (userId, groupId, answers) => firebaseService.joinGroup(userId, groupId, answers),
  leaveGroup: (userId, groupId) => firebaseService.leaveGroup(userId, groupId),
  pinPost: (groupId, postId) => firebaseService.pinPost(groupId, postId),
  unpinPost: (groupId) => firebaseService.unpinPost(groupId),
  promoteGroupMember: (groupId, user, role) => firebaseService.promoteGroupMember(groupId, user, role),
  demoteGroupMember: (groupId, user, role) => firebaseService.demoteGroupMember(groupId, user, role),
  removeGroupMember: (groupId, user) => firebaseService.removeGroupMember(groupId, user),
  approveJoinRequest: (groupId, userId) => firebaseService.approveJoinRequest(groupId, userId),
  rejectJoinRequest: (groupId, userId) => firebaseService.rejectJoinRequest(groupId, userId),
  approvePost: (postId) => firebaseService.approvePost(postId),
  rejectPost: (postId) => firebaseService.rejectPost(postId),
  listenToGroupChat: (groupId, callback) => firebaseService.listenToGroupChat(groupId, callback),
  sendGroupChatMessage: (groupId, sender, text, replyTo) => firebaseService.sendGroupChatMessage(groupId, sender, text, replyTo),
  reactToGroupChatMessage: (groupId, messageId, userId, emoji) => firebaseService.reactToGroupChatMessage(groupId, messageId, userId, emoji),
  getGroupEvents: (groupId) => firebaseService.getGroupEvents(groupId),
  rsvpToEvent: (userId, eventId) => firebaseService.rsvpToEvent(userId, eventId),
  createGroupEvent: (creator, groupId, title, description, date) => firebaseService.createGroupEvent(creator, groupId, title, description, date),
  getMusicLibrary: (): MusicTrack[] => MOCK_MUSIC_LIBRARY,
  createStory: (storyData, mediaFile) => firebaseService.createStory(storyData, mediaFile),
  markStoryAsViewed: (storyId, userId) => firebaseService.markStoryAsViewed(storyId, userId),
  getFriendsList: (userId) => firebaseService.getFriends(userId),
  inviteFriendToGroup: (groupId, friendId) => firebaseService.inviteFriendToGroup(groupId, friendId),
  getCategorizedExploreFeed: (userId) => firebaseService.getCategorizedExploreFeed(userId),
  getPostById: (postId) => firebaseService.getPostById(postId),
  getPendingReports: () => firebaseService.getPendingReports(),
  resolveReport: (reportId, resolution) => firebaseService.resolveReport(reportId, resolution),
  getUserDetailsForAdmin: (userId) => firebaseService.getUserDetailsForAdmin(userId),
  sendSiteWideAnnouncement: (message) => firebaseService.sendSiteWideAnnouncement(message),
  getAllCampaignsForAdmin: () => firebaseService.getAllCampaignsForAdmin(),
  verifyCampaignPayment: (campaignId, adminId) => firebaseService.verifyCampaignPayment(campaignId, adminId),
  createReplySnippet: (message: Message): ReplyInfo => {
    let content = '';
    switch(message.type) {
        case 'text': content = message.text || ''; break;
        case 'image': content = 'Photo'; break;
        case 'video': content = 'Video'; break;
        case 'audio': content = `Voice message (${message.duration}s)`; break;
        default: content = '...'; break;
    }
    return {
        messageId: message.id,
        senderName: 'User', // This is a simplification. The UI should derive the name.
        content: content.substring(0, 30),
    };
  },
};
