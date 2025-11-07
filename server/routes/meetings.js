const express = require('express');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// Email transporter setup
// You can disable outgoing emails by setting DISABLE_EMAILS=true in environment variables.
const EMAILS_DISABLED = process.env.DISABLE_EMAILS === 'true';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send meeting invitation email
const sendMeetingInvitation = async (meeting, participantEmails, hostName) => {
  if (EMAILS_DISABLED) {
    console.log('Email sending disabled via DISABLE_EMAILS env var; skipping invitations');
    return;
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('Email credentials not configured, skipping email notifications');
    return;
  }

  // It's good practice to re-check expiration before sending,
  // in case of a delay.
  if (meeting.checkExpiration()) {
    await meeting.save();
    console.log(`Skipping email for expired meeting: ${meeting.meetingId}`);
    return;
  }

  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      subject: `Meeting Invitation: ${meeting.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">You're invited to a meeting</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <h3>${meeting.title}</h3>
            <p><strong>Host:</strong> ${hostName}</p>
            <p><strong>When:</strong> ${meeting.formattedScheduledAt || new Date(meeting.scheduledAt).toString()}</p>
            <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
            ${meeting.description ? `<p><strong>Description:</strong> ${meeting.description}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${meeting.meetingLink}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Join Meeting
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            Meeting ID: ${meeting.meetingId}<br>
            Link: <a href="${meeting.meetingLink}">${meeting.meetingLink}</a>
          </p>
        </div>
      `
    };

    for (const email of participantEmails) {
      await transporter.sendMail({
        ...mailOptions,
        to: email
      });
    }
    
    console.log('Meeting invitations sent successfully');
  } catch (error) {
    console.error('Error sending meeting invitations:', error);
  }
};

// Create a new meeting
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, scheduledAt, duration, participants, type, formattedScheduledAt } = req.body;
    const hostId = req.user.userId;

    const host = await User.findById(hostId);
    if (!host) {
      return res.status(404).json({
        success: false,
        message: 'Host user not found'
      });
    }

    const meetingData = {
      title: title || 'Untitled Meeting',
      host: hostId,
      type: type || 'scheduled'
    };

    if (description) meetingData.description = description;
    if (scheduledAt) meetingData.scheduledAt = new Date(scheduledAt);
    if (formattedScheduledAt) meetingData.formattedScheduledAt = formattedScheduledAt;
    if (duration) meetingData.duration = duration;
    if (participants && Array.isArray(participants)) {
      meetingData.invitedEmails = participants.filter(email => email.trim());
    }

    // Set expiration time based on scheduled time + duration
    if (scheduledAt && duration) {
      const scheduledDateTime = new Date(scheduledAt);
      const expirationTime = new Date(scheduledDateTime);
      expirationTime.setMinutes(expirationTime.getMinutes() + duration);
      meetingData.expiresAt = expirationTime;

      // Calculate grace period expiration (duration + 30%)
      const gracePeriodMinutes = duration * 1.3;
      const gracePeriodExpirationTime = new Date(scheduledDateTime);
      gracePeriodExpirationTime.setMinutes(gracePeriodExpirationTime.getMinutes() + gracePeriodMinutes);
      meetingData.gracePeriodExpiresAt = gracePeriodExpirationTime;
    }

    // For instant meetings, start immediately
    if (type === 'instant') {
      meetingData.status = 'active';
      meetingData.startedAt = new Date();
      if (duration) {
        const now = new Date();
        const expirationTime = new Date(now);
        expirationTime.setMinutes(expirationTime.getMinutes() + duration);
        meetingData.expiresAt = expirationTime;
        const gracePeriodMinutes = duration * 1.3;
        const gracePeriodExpirationTime = new Date(now);
        gracePeriodExpirationTime.setMinutes(gracePeriodExpirationTime.getMinutes() + gracePeriodMinutes);
        meetingData.gracePeriodExpiresAt = gracePeriodExpirationTime;
      }
    }

    const meeting = new Meeting(meetingData);
    
    // Explicitly generate the meeting link to ensure it's correct and complete.
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      console.warn('FRONTEND_URL environment variable not set. Meeting links may be incorrect.');
    }
    meeting.meetingLink = `${frontendUrl || 'http://localhost:5173'}/meeting/${meeting.meetingId}`;

    await meeting.save();

    // Add host as participant
    await meeting.addParticipant({
      userId: hostId,
      name: host.name,
      email: host.email,
      isHost: true
    });

    // Send email invitations if participants are specified
    if (meetingData.invitedEmails && meetingData.invitedEmails.length > 0) {
      await sendMeetingInvitation(meeting, meetingData.invitedEmails, host.name);
    }

    await meeting.populate('host', 'name email');

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      meeting: {
        id: meeting._id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
        status: meeting.status,
        type: meeting.type,
        host: meeting.host,
        formattedScheduledAt: meeting.formattedScheduledAt,
        meetingLink: meeting.meetingLink,
        expiresAt: meeting.expiresAt,
        gracePeriodExpiresAt: meeting.gracePeriodExpiresAt,
        participants: meeting.participants,
        createdAt: meeting.createdAt
      }
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during meeting creation'
    });
  }
});

// Get all meetings for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 20, page = 1 } = req.query;

    const query = {
      $or: [
        { host: userId },
        { 'participants.user': userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const meetings = await Meeting.find(query)
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalMeetings = await Meeting.countDocuments(query);

    res.json({
      success: true,
      meetings: meetings.map(meeting => ({
        id: meeting._id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
        status: meeting.status,
        type: meeting.type,
        host: meeting.host,
        participantCount: meeting.participants.length,
        createdAt: meeting.createdAt,
        meetingLink: meeting.meetingLink,
        expiresAt: meeting.expiresAt,
        gracePeriodExpiresAt: meeting.gracePeriodExpiresAt,
        isExpired: meeting.isExpired,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt
      })),
      pagination: {
        currentPage: page * 1,
        totalPages: Math.ceil(totalMeetings / limit),
        totalMeetings,
        hasNext: page * limit < totalMeetings,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching meetings'
    });
  }
});

// Get specific meeting by ID
router.get('/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;

    const meeting = await Meeting.findOne({ meetingId })
      .populate('host', 'name email')
      .populate('participants.user', 'name email');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if user has access to this meeting
    const hasAccess = 
      meeting.host._id.toString() === userId ||
      meeting.participants.some(p => p.user._id.toString() === userId) ||
      meeting.invitedEmails.includes(req.user.email);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this meeting'
      });
    }

    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
        status: meeting.status,
        type: meeting.type,
        host: meeting.host,
        participants: meeting.participants,
        meetingLink: meeting.meetingLink,
        expiresAt: meeting.expiresAt,
        isExpired: meeting.isExpired,
        settings: meeting.settings,
        createdAt: meeting.createdAt,
        startedAt: meeting.startedAt,
        endedAt: meeting.endedAt
      }
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching meeting'
    });
  }
});

// Join a meeting
router.post('/:meetingId/join', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check if meeting is accessible
    const hasAccess = 
      meeting.host.toString() === userId ||
      meeting.participants.some(p => p.user.toString() === userId) ||
      meeting.invitedEmails.includes(user.email);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You are not invited to this meeting'
      });
    }

    // Start meeting if it's scheduled and host is joining
    if (meeting.status === 'scheduled' && meeting.host.toString() === userId) {
      await meeting.startMeeting();
    }

    // Add participant if not already added
    await meeting.addParticipant({
      userId,
      name: user.name,
      email: user.email,
      isHost: meeting.host.toString() === userId
    });

    await meeting.populate('host', 'name email');
    await meeting.populate('participants.user', 'name email');

    res.json({
      success: true,
      message: 'Successfully joined the meeting',
      meeting: {
        id: meeting._id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        status: meeting.status,
        host: meeting.host,
        participants: meeting.participants,
        settings: meeting.settings
      }
    });
  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while joining meeting'
    });
  }
});

// Leave a meeting
router.post('/:meetingId/leave', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    await meeting.removeParticipant(userId);

    // If host leaves and there are no other participants, end the meeting
    if (meeting.host.toString() === userId) {
      const activeParticipants = meeting.participants.filter(p => !p.leftAt);
      if (activeParticipants.length <= 1) {
        await meeting.endMeeting();
      }
    }

    res.json({
      success: true,
      message: 'Successfully left the meeting'
    });
  } catch (error) {
    console.error('Leave meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while leaving meeting'
    });
  }
});

// Update meeting
router.put('/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { title, description, scheduledAt, duration } = req.body;
    const userId = req.user.userId;

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Only host can update the meeting
    if (meeting.host.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the meeting host can update this meeting'
      });
    }

    // Cannot update meetings that have ended
    if (meeting.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update ended meetings'
      });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
    if (duration) updateData.duration = duration;

    const updatedMeeting = await Meeting.findOneAndUpdate(
      { meetingId },
      updateData,
      { new: true, runValidators: true }
    ).populate('host', 'name email');

    res.json({
      success: true,
      message: 'Meeting updated successfully',
      meeting: updatedMeeting
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during meeting update'
    });
  }
});

// Delete/Cancel meeting
router.delete('/:meetingId', auth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;

    const meeting = await Meeting.findOne({ meetingId });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Only host can delete the meeting
    if (meeting.host.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the meeting host can delete this meeting'
      });
    }

    if (meeting.status === 'active') {
      // End the meeting first
      await meeting.endMeeting();
    } else if (meeting.status === 'scheduled') {
      // Cancel the meeting
      meeting.status = 'cancelled';
      await meeting.save();
    }

    res.json({
      success: true,
      message: 'Meeting cancelled successfully'
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting meeting'
    });
  }
});

module.exports = router;