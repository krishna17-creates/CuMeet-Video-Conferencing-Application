const express = require('express');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const auth = require('../middleware/auth');
const sgMail = require('@sendgrid/mail');

const router = express.Router();

// Simple request logger for this router to help trace scheduling flow
router.use((req, res, next) => {
  try {
    console.log(`[Meetings][${new Date().toISOString()}] ${req.method} ${req.originalUrl} - body keys: ${req.body ? Object.keys(req.body).join(',') : 'none'}`);
  } catch (e) {
    console.log('[Meetings] request logger error', e);
  }
  next();
});

// In-memory buffer of recent email send results (dev/debug only). Keep small to avoid memory growth.
const SEND_RESULTS = [];
const pushSendResults = (entry) => {
  try {
    SEND_RESULTS.unshift(entry);
    if (SEND_RESULTS.length > 50) SEND_RESULTS.length = 50;
  } catch (e) {
    console.error('Failed to push send results', e);
  }
};

// Quick indicator that this routes file was loaded (dev-only)
if (process.env.NODE_ENV !== 'production') {
  console.log('[Meetings] routes loaded (debug mode)');
}

// Development-only trace endpoint to verify server logging and routing.
// GET /api/meetings/debug/trace
router.get('/debug/trace', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not allowed in production' });
  }
  console.log('[Meetings][TRACE] Received debug trace request from', req.ip, 'headers:', Object.keys(req.headers).slice(0,10));
  res.json({ success: true, message: 'trace ok', time: new Date().toISOString() });
});

// Email setup using SendGrid
// You can disable outgoing emails by setting DISABLE_EMAILS=true in environment variables.
const EMAILS_DISABLED = process.env.DISABLE_EMAILS === 'true';

// Configure SendGrid if API key is present
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// DEBUG: Print a concise summary of email configuration (do not print secrets)
console.log('[Meetings][EmailConfig] SENDGRID_API_KEY present=', !!process.env.SENDGRID_API_KEY, 'SENDER_EMAIL present=', !!process.env.SENDER_EMAIL, 'DISABLE_EMAILS=', process.env.DISABLE_EMAILS);

// Also print the computed boolean used by the code so there's no ambiguity
console.log('[Meetings] EMAILS_DISABLED (computed boolean) =', EMAILS_DISABLED);

// Send meeting invitation email
// Send meeting invitation email
const sendMeetingInvitation = async (meeting, participantEmails, hostName, traceId) => {
  const logPrefix = `[SendGrid:${traceId}]`;
  console.log(`${logPrefix} Starting sendMeetingInvitation for meeting ${meeting.meetingId}.`);

  if (EMAILS_DISABLED) {
    console.log(`${logPrefix} SKIPPING: Email sending is disabled via DISABLE_EMAILS=true environment variable.`);
    return;
  }

  if (!process.env.SENDGRID_API_KEY || !process.env.SENDER_EMAIL) {
    console.error(`${logPrefix} SKIPPING: SendGrid is not configured. Ensure SENDGRID_API_KEY and SENDER_EMAIL are set in the .env file.`);
    return;
  }

  if (!Array.isArray(participantEmails) || participantEmails.length === 0) {
    console.log(`${logPrefix} SKIPPING: No valid participant emails provided.`);
    return;
  }
  // It's good practice to re-check expiration before sending,
  // in case of a delay.
  if (meeting.checkExpiration()) {
    await meeting.save();
    console.log(`${logPrefix} SKIPPING: Meeting ${meeting.meetingId} is expired.`);
    return;
  }

  try {
    const subject = `Meeting Invitation: ${meeting.title}`;
    const htmlBody = `
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
    `;

    // Use SendGrid to send emails. Send individually to preserve personalization and avoid exposure of recipient list.
    const fromEmail = process.env.SENDER_EMAIL;

    console.log(`${logPrefix} Preparing to send ${participantEmails.length} invitations from sender: ${fromEmail}.`);

    // Send each email and capture per-recipient result to avoid a single failure hiding others.
    const results = await Promise.all(
      participantEmails.map(async (email) => {
        // Basic email validation
        if (typeof email !== 'string' || !email.includes('@')) {
          console.warn(`${logPrefix} Invalid email format found and skipped: "${email}"`);
          return { email, ok: false, error: 'Invalid email format' };
        }
        const msg = {
          to: email,
          from: fromEmail,
          subject,
          html: htmlBody
        };

        try {
          const res = await sgMail.send(msg);
          // sgMail.send can return an array with response(s)
          console.log(`${logPrefix} Sent to ${email}; status: ${res?.[0]?.statusCode}`);
          return { email, ok: true, status: res && res[0] && res[0].statusCode };
        } catch (err) {
          const body = err?.response?.body || err;
          console.error(`${logPrefix} Error sending to ${email}:`, JSON.stringify(body));
          return { email, ok: false, error: body };
        }
      })
    );

    const failed = results.filter(r => !r.ok);
    if (failed.length > 0) {
      console.warn(`${logPrefix} ${failed.length} of ${results.length} invitations failed.`);
    } else {
      console.log(`${logPrefix} All invitations sent successfully.`);
    }
    // Store results in in-memory buffer for debug inspection
    try {
      pushSendResults({
        type: 'meeting',
        meetingId: meeting.meetingId,
        time: new Date().toISOString(),
        results
      });
    } catch (e) {
      console.error('Failed to store send results', e);
    }
  } catch (error) {
    // This catch is for unexpected issues constructing the request or similar.
    console.error(`${logPrefix} Unexpected error during invitation process:`, error?.response?.body || error);
  }
};

// Create a new meeting
router.post('/', auth, async (req, res) => {
  try {
    // --- NEW LOG: Confirming entry into the route handler ---
    console.log('[Meetings Route] POST / handler reached after auth middleware.');

    const { title, description, scheduledAt, duration, participants, type, formattedScheduledAt } = req.body;
    const hostId = req.user.userId;

    // traceId helps correlate logs for this scheduling request
    const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    console.log(`[Meetings:${traceId}] POST / - incoming data:`, {
      title: title?.slice(0, 120),
      scheduledAt,
      duration,
      participantsCount: Array.isArray(participants) ? participants.length : (participants ? String(participants).split(',').length : 0),
      userId: hostId
    });
    console.time(`[Meetings:${traceId}] total`);

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
    
    // Debug log for participants processing
    console.log('[Debug] Incoming participants:', {
      participants,
      isArray: Array.isArray(participants),
      rawLength: participants ? participants.length : 'N/A'
    });
    
    // Robustly handle participants, whether it's an array or a comma-separated string
    if (participants) {
      const emails = Array.isArray(participants) 
        ? participants 
        : String(participants).split(',');
      
      meetingData.invitedEmails = emails.map(email => email.trim()).filter(email => email);
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

  console.log(`[Meetings:${traceId}] Saving meeting to DB...`);
  console.time(`[Meetings:${traceId}] save`);
  await meeting.save();
  console.timeEnd(`[Meetings:${traceId}] save`);
  console.log(`[Meetings:${traceId}] Meeting saved:`, { id: meeting._id, meetingId: meeting.meetingId });

    // Add host as participant
    console.log(`[Meetings:${traceId}] Adding host as participant:`, { hostId, hostEmail: host.email });
    console.time(`[Meetings:${traceId}] addParticipant`);
    await meeting.addParticipant({
      userId: hostId,
      name: host.name,
      email: host.email,
      isHost: true
    });
    console.timeEnd(`[Meetings:${traceId}] addParticipant`);
    console.log(`[Meetings:${traceId}] Host added as participant`);

    // Send email invitations if participants are specified
    let emailsQueued = false;
  if (meetingData.invitedEmails && meetingData.invitedEmails.length > 0) {
      // Kick off email sending asynchronously so the API response doesn't block
      // waiting for external email providers. sendMeetingInvitation returns
      // per-recipient results; we intentionally do not await here.
      try {
        emailsQueued = true;
        console.log(`[Meetings:${traceId}] Queuing email sends for participants:`, meetingData.invitedEmails.length, 'emailsQueued set to true');
        // Decouple background send from request flow
        setImmediate(() => {
          // Wrap in a try/catch because the function is now async and could throw
          try {
            console.log(`[Meetings:${traceId}] Background send process starting.`);
            sendMeetingInvitation(meeting, meetingData.invitedEmails, host.name, traceId).catch(err => {
              console.error(`[Meetings:${traceId}] Unhandled promise rejection in background email send:`, err);
            });
          } catch (err) {
            console.error(`[Meetings:${traceId}] Critical error invoking background email send:`, err);
          }
        });
      } catch (err) {
        console.error('[Meetings] Failed to queue email sends:', err);
        emailsQueued = false;
      }
    } else {
      console.log(`[Meetings:${traceId}] No invited emails to send. Skipping email logic.`);
    }

    await meeting.populate('host', 'name email');

    console.log(`[Meetings:${traceId}] Sending response to client; emailsQueued=`, emailsQueued);
    console.timeEnd(`[Meetings:${traceId}] total`);

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      emailsQueued,
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

// Debug: trigger a test email send (protected)
// POST /api/meetings/debug/send-test
// body: { to?: string, subject?: string, html?: string }
router.post('/debug/send-test', auth, async (req, res) => {
  try {
    const to = req.body.to || req.user?.email;
    const subject = req.body.subject || 'CuMeet Test Email';
    const html = req.body.html || `<p>This is a test email from CuMeet to <strong>${to}</strong>.</p>`;

    if (!to) {
      return res.status(400).json({ success: false, message: 'No recipient specified for test email' });
    }

    if (EMAILS_DISABLED) {
      console.log('[Debug Send] Emails are disabled via DISABLE_EMAILS; skipping test send');
      return res.json({ success: true, emailsQueued: false, message: 'Emails are disabled on the server' });
    }

    if (!process.env.SENDGRID_API_KEY || !process.env.SENDER_EMAIL) {
      console.log('[Debug Send] SendGrid not configured; cannot send test email');
      return res.json({ success: true, emailsQueued: false, message: 'SendGrid not configured on server' });
    }

    // Fire-and-forget background send
    (async () => {
      try {
        const msg = { to, from: process.env.SENDER_EMAIL, subject, html };
        const r = await sgMail.send(msg);
        console.log('[Debug Send] Test email sent', { to, status: r && r[0] && r[0].statusCode });
        // record debug send result
        try {
          pushSendResults({
            type: 'debug',
            to,
            time: new Date().toISOString(),
            status: r && r[0] && r[0].statusCode
          });
        } catch (e) {
          console.error('Failed to store debug send result', e);
        }
      } catch (err) {
        console.error('[Debug Send] Error sending test email:', err && err.response && err.response.body ? err.response.body : err);
        try {
          pushSendResults({
            type: 'debug',
            to,
            time: new Date().toISOString(),
            error: err && err.response && err.response.body ? err.response.body : String(err)
          });
        } catch (e) {
          console.error('Failed to store debug send error', e);
        }
      }
    })();

    return res.json({ success: true, emailsQueued: true, message: 'Test email queued for background sending' });
  } catch (error) {
    console.error('Debug send error:', error);
    return res.status(500).json({ success: false, message: 'Server error while queuing test email' });
  }
});

// GET recent send results (dev-only)
router.get('/debug/send-results', auth, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Not allowed in production' });
  }
  res.json({ success: true, results: SEND_RESULTS.slice(0, 50) });
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

    const totalMeetings = await Meeting.countDocuments(query);
    
    // --- FIX: Actually fetch the meetings from the database ---
    const meetings = await Meeting.find(query)
      .sort({ scheduledAt: -1, createdAt: -1 }) // Show upcoming/most recent first
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('host', 'name email')
      .exec();

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