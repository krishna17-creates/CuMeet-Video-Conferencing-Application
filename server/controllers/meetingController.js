/**
 * Meetings Controller
 * Handles meeting creation, listing, joining, and leaving
 */

const Meeting = require('../models/Meeting');

/**
 * Create a new meeting
 */
const createMeeting = async (userId, { title, description, startTime, maxParticipants }) => {
  try {
    const meeting = new Meeting({
      title,
      description,
      organizerId: userId,
      startTime,
      maxParticipants,
      isActive: true,
    });

    await meeting.save();
    console.log(`[MeetingController] Meeting created: ${meeting._id}`);
    return meeting;
  } catch (error) {
    console.error('[MeetingController] Error creating meeting:', error.message);
    throw error;
  }
};

/**
 * Get user's meetings
 */
const getUserMeetings = async (userId) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ organizerId: userId }],
    }).sort({ createdAt: -1 });

    return meetings;
  } catch (error) {
    console.error('[MeetingController] Error getting meetings:', error.message);
    throw error;
  }
};

/**
 * Get meeting by ID
 */
const getMeetingById = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    return meeting;
  } catch (error) {
    console.error('[MeetingController] Error getting meeting:', error.message);
    throw error;
  }
};

/**
 * Check if meeting is active (not expired)
 */
const isMeetingActive = async (meetingId) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return false;
    }

    const now = Date.now();
    const startTime = new Date(meeting.startTime).getTime();
    const endTime = startTime + 24 * 60 * 60 * 1000; // 24 hours

    return now >= startTime && now <= endTime;
  } catch (error) {
    console.error('[MeetingController] Error checking active:', error.message);
    return false;
  }
};

/**
 * Join meeting
 */
const joinMeeting = async (meetingId, userId, displayName) => {
  try {
    const isActive = await isMeetingActive(meetingId);
    if (!isActive) {
      throw new Error('Meeting expired or not started');
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    console.log(
      `[MeetingController] User ${userId} joined meeting ${meetingId}`
    );

    return {
      success: true,
      meeting,
      displayName,
    };
  } catch (error) {
    console.error('[MeetingController] Error joining meeting:', error.message);
    throw error;
  }
};

/**
 * Leave meeting
 */
const leaveMeeting = async (meetingId, userId) => {
  try {
    console.log(
      `[MeetingController] User ${userId} left meeting ${meetingId}`
    );

    return {
      success: true,
      message: 'Left meeting',
    };
  } catch (error) {
    console.error('[MeetingController] Error leaving meeting:', error.message);
    throw error;
  }
};

/**
 * Delete meeting
 */
const deleteMeeting = async (meetingId, userId) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    if (meeting.organizerId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    await Meeting.findByIdAndDelete(meetingId);
    console.log(`[MeetingController] Meeting deleted: ${meetingId}`);

    return { success: true };
  } catch (error) {
    console.error('[MeetingController] Error deleting meeting:', error.message);
    throw error;
  }
};

module.exports = {
  createMeeting,
  getUserMeetings,
  getMeetingById,
  isMeetingActive,
  joinMeeting,
  leaveMeeting,
  deleteMeeting,
};
