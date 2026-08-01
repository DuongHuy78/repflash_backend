import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema({
  userId: {
    type:  mongoose.Schema.Types.ObjectId,
    required: true,
  },
  front: {
    type: String,
    required: true,
  },
  back: {
    type: String,
    required: true,
  },
  deckId: { 
    type: mongoose.Schema.Types.ObjectId, ref: 'Deck' 
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
    enum: ['active', 'learning', 'mastered'], // active thẻ bth ko phải AGAIN, learning đã bấm học lại mastered là đã thuộc
    default: 'active',
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
flashcardSchema.index({ deck: 1 });

export default mongoose.model('Flashcard', flashcardSchema);
