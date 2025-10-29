const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  joinedAt: {
    type: Date
  },
  leftAt: {
    type: Date
  },
  isHost: {
    type: Boolean,
    default: false
  }
});

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    unique: true,
    default: () => Math.random().toString(36).substring(2, 12).toUpperCase()
  },
  meetingLink: {
    type: String
  },
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [50, 'Title cannot be more than 50 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledAt: {
    type: Date
  },
  formattedScheduledAt: {
    type: String
  },
  duration: {
    type: Number,
    default: 60, // minutes
    min: [15, 'Minimum duration is 15 minutes'],
    max: [480, 'Maximum duration is 8 hours']
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['instant', 'scheduled'],
    default: 'scheduled'
  },
  participants: [participantSchema],
  invitedEmails: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  settings: {
    allowRecording: {
      type: Boolean,
      default: false
    },
    muteOnEntry: {
      type: Boolean,
      default: false
    },
    waitingRoom: {
      type: Boolean,
      default: false
    },
    maxParticipants: {
      type: Number,
      default: 100
    }
  },
  startedAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  gracePeriodExpiresAt: {
    type: Date
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
meetingSchema.index({ host: 1, createdAt: -1 });
meetingSchema.index({ meetingId: 1 });
meetingSchema.index({ scheduledAt: 1 });
meetingSchema.index({ status: 1 });

// Virtual for meeting URL
meetingSchema.virtual('meetingUrl').get(function() {
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/meeting/${this.meetingId}`;
});

// Method to check if meeting is expired
meetingSchema.methods.checkExpiration = function() {
  if (this.expiresAt && new Date() > this.expiresAt) {
    this.isExpired = true;
    return true;
  }
  return false;
};

// Method to generate meeting link
meetingSchema.methods.generateMeetingLink = function() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  this.meetingLink = `${baseUrl}/meeting/${this.meetingId}`;
  return this.meetingLink;
};

// Method to add participant
meetingSchema.methods.addParticipant = function(userInfo) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userInfo.userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userInfo.userId,
      name: userInfo.name,
      email: userInfo.email,
      joinedAt: new Date(),
      isHost: userInfo.isHost || false
    });
  } else if (!existingParticipant.joinedAt) {
    existingParticipant.joinedAt = new Date();
  }
  
  return this.save();
};

// Method to remove participant
meetingSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant && !participant.leftAt) {
    participant.leftAt = new Date();
  }
  
  return this.save();
};

// Method to start meeting
meetingSchema.methods.startMeeting = function() {
  this.status = 'active';
  this.startedAt = new Date();
  return this.save();
};

// Method to end meeting
meetingSchema.methods.endMeeting = function() {
  this.status = 'ended';
  this.endedAt = new Date();
  
  // Mark all active participants as left
  this.participants.forEach(participant => {
    if (!participant.leftAt) {
      participant.leftAt = new Date();
    }
  });
  
  return this.save();
};

module.exports = mongoose.model('Meeting', meetingSchema);