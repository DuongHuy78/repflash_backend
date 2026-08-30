import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },
  translation: {
    type: String,
    trim: true,
    default: '',
  },
  ttsText: {
    type: String,
    trim: true,
    default: '',
    maxlength: 5000,
  },
}, { _id: false });

const flashcardSchema = new mongoose.Schema({
  userId: {
    type:  mongoose.Schema.Types.ObjectId,
    required: true,
  },
  front: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  pronunciation: {
    type: String,
    default: '',
    maxlength: 2000,
  },
  speechText: {
    type: String,
    default: '',
    maxlength: 4000,
  },
  back: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  examples: {
    type: [exampleSchema],
    default: [],
  },
  deckId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Deck',
    required: true 
  },
  interval: {
    type: Number,
    default: 0, // In days
  },
  repetition: {
    type: Number,
    default: 0, // How many times it has been reviewed
  },
  easeFactor: {
    type: Number,
    default: 2.5, // Starting ease factor
  },
  nextReview: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    // active thẻ bth ko phải AGAIN, learning đã bấm học lại mastered là đã thuộc, new là thẻ mới chưa học
    enum: ['new', 'active', 'learning', 'mastered'], 
    default: 'new',
  },
  introducedAt: {
    type: Date,
    default: null,
  },
  masteredAt: {
    type: Date,
    default: null,
  },
  sameDayRetry: {
    type: Boolean,
    default: false,
  },
  sameDayRetryCount: {
    type: Number,
    default: 0,
  },
  lastReviewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

flashcardSchema.index({ status: 1, nextReview: 1 });
flashcardSchema.index({ status: 1 });
flashcardSchema.index({ nextReview: 1 });
flashcardSchema.index({ lastReviewedAt: 1 });
flashcardSchema.index({ deckId: 1 });

export default mongoose.model('Flashcard', flashcardSchema);
