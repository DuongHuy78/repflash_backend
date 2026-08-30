import mongoose from 'mongoose';

import User from '../src/models/User.js';
import Deck from '../src/models/Deck.js';
import Flashcard from '../src/models/Flashcard.js';

export const createReviewFixture = async ({
    userOverrides = {},
    deckOverrides = {},
    cardOverrides = {},
} = {}) => {
    const uniqueId1 = new mongoose.Types.ObjectId().toString();
    const uniqueId2 = new mongoose.Types.ObjectId().toString();

    const user1 = await User.create({
        username: `review-user-${uniqueId1}`,
        email: `review-${uniqueId1}@example.com`,
        password: 'test-password',
        timezone: 'Asia/Ho_Chi_Minh',
        ...userOverrides,
    });

    const user2 = await User.create({
        username: `review-user-${uniqueId2}`,
        email: `review-${uniqueId2}@example.com`,
        password: 'test-password',
        timezone: 'Asia/Ho_Chi_Minh',
        ...userOverrides,
    });

    const deck1 = await Deck.create({
        deckName: 'Deck kiểm thử',
        description: '',
        language: 'ja-JP',
        userId: user1._id,
        ...deckOverrides,
    });

    const deck2 = await Deck.create({
        deckName: 'Deck kiểm thử',
        description: '',
        language: 'ja-JP',
        userId: user2._id,
        ...deckOverrides,
    });

    const card1 = await Flashcard.create({
        front: '猫',
        back: 'Con mèo',
        pronunciation: 'ねこ',
        userId: user1._id,
        deckId: deck1._id,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        status: 'active',
        sameDayRetry: false,
        sameDayRetryCount: 0,
        ...cardOverrides,
    });

    const card2 = await Flashcard.create({
        front: 'card2',
        back: 'card2',
        pronunciation: 'card2',
        userId: user2._id,
        deckId: deck2._id,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        status: 'active',
        sameDayRetry: false,
        sameDayRetryCount: 0,
        ...cardOverrides,
    });

    return {
        user: user1,
        deck: deck1,
        card: card1,

        otherUser: user2,
        otherDeck: deck2,
        otherCard: card2,
    };
};