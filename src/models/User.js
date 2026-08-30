import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['active', 'ban'],
    default: 'active',
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  newCardsPerDay: {
    type: Number,
    default: 20,
  },
  currentStreak: { 
    type: Number, default: 0 
  },
  longestStreak: { 
    type: Number, default: 0 
  },
  lastStudyDate: { 
    type: Date, default: null 
  },
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh',
  },
  unlockedMilestones: {
    type: [Number], default: []
  },
  passwordResetTokenHash: {
    type: String,
    select: false,
    default: null,
  },
  passwordResetExpiresAt: {
    type: Date,
    default: null,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
}, { timestamps: true }); // timestamps: true sẽ tự động tạo ra 2 trường 'createdAt' và 'updatedAt'

export default mongoose.model('User', userSchema);
