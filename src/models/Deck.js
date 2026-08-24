import mongoose from 'mongoose';

const deckSchema = new mongoose.Schema({
    deckName: {
        type: String,
        required: true,
        trim: true,
    },
    userId: {
        type:  mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    language: {
        type: String,
        trim: true,
        required: true,
        default: 'ja-JP',
    }
});
export default mongoose.model('Deck', deckSchema);
