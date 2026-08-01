import mongoose from 'mongoose';

const deckSchema = new mongoose.Schema({
    deckName: {
        type: String,
        required: true,
    },
    userId: {
        type:  mongoose.Schema.Types.ObjectId,
    },
    description: {
        type: String,
    },
    language: {
        type: String,
        default: 'ja-JP',
    }
});
export default mongoose.model('Deck', deckSchema);
