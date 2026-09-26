import test, {
  before,
  beforeEach,
  after,
} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import User from '../../../src/models/User.js';
import Deck from '../../../src/models/Deck.js';
import Flashcard from '../../../src/models/Flashcard.js';

import {
  getAllCards,
  getDueCards,
  getNewCards,
} from '../../../src/service/cardService.js';
import { createReviewFixture } from '../../support/testData.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

dotenv.config({
    path: path.resolve(currentDirectory, '../../../../.env'),
});


before(async () => {
  const testUrl = process.env.MONGODB_TEST_URL;

  if (!testUrl || !testUrl.includes('test')) {
    throw new Error(
      'MONGODB_TEST_URL phải trỏ tới database dành riêng cho test',
    );
  }

  await mongoose.connect(testUrl);
});

beforeEach(async () => {
  await Promise.all([
    Flashcard.deleteMany({}),
    Deck.deleteMany({}),
    User.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
      await Promise.all([
        Flashcard.deleteMany({}),
        Deck.deleteMany({}),
        User.deleteMany({}),
      ]);
  }

  await mongoose.disconnect();
});


test('getAllCards không trả thẻ của user khác', async () => {
  // Arrange: cố ý đặt thẻ của user khác vào cùng deck để test riêng điều kiện userId.
  const {
    user,
    deck,
    card,
    otherCard,
  } = await createReviewFixture();

  otherCard.deckId = deck._id;
  await otherCard.save();

  // Act
  const result = await getAllCards(
    { deckId: deck._id },
    user._id,
  );

  // Assert
  const returnedCardIds = result.cards.map(
    returnedCard => returnedCard._id.toString(),
  );

  assert.ok(returnedCardIds.includes(card._id.toString()));
  assert.ok(!returnedCardIds.includes(otherCard._id.toString()));
  assert.equal(result.totalCards, 1);
});


test('getDueCards không đưa thẻ new vào ôn tập', async () => {
  const { user, deck } = await createReviewFixture();

  const newCard = await Flashcard.create({
    front: 'thẻ mới',
    back: 'new',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
    nextReview: new Date(),
  });

  const dueCard = await Flashcard.create({
    front: 'thẻ ôn',
    back: 'due',
    userId: user._id,
    deckId: deck._id,
    status: 'active',
    nextReview: new Date(),
  });

  const cards = await getDueCards(deck._id, user._id);
  const ids = cards.map((item) => item._id.toString());

  assert.ok(ids.includes(dueCard._id.toString()));
  assert.ok(!ids.includes(newCard._id.toString()));
});

test('getNewCards chỉ trả thẻ new theo trần và thứ tự tạo', async () => {
  const { user, deck } = await createReviewFixture({
    userOverrides: { newCardsPerDay: 2 },
  });

  await Flashcard.create({
    front: 'active',
    back: 'không lấy',
    userId: user._id,
    deckId: deck._id,
    status: 'active',
    nextReview: new Date(),
  });

  const first = await Flashcard.create({
    front: 'một',
    back: '1',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  });
  const second = await Flashcard.create({
    front: 'hai',
    back: '2',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
  });
  await Flashcard.create({
    front: 'ba',
    back: '3',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
  });

  const result = await getNewCards(deck._id, user._id);

  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0]._id.toString(), first._id.toString());
  assert.equal(result.cards[1]._id.toString(), second._id.toString());
  assert.ok(result.cards.every((item) => item.status === 'new'));
  assert.equal(result.limit, 2);
  assert.equal(result.usedToday, 0);
  assert.equal(result.remainingQuota, 2);
  assert.equal(result.totalNew, 3);
});

test('getNewCards trừ suất đã mở hôm nay', async () => {
  const { user, deck } = await createReviewFixture({
    userOverrides: { newCardsPerDay: 2 },
  });

  await Flashcard.create({
    front: 'đã mở',
    back: 'opened',
    userId: user._id,
    deckId: deck._id,
    status: 'active',
    introducedAt: new Date(),
  });

  const remainingNew = await Flashcard.create({
    front: 'chưa mở 1',
    back: '1',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
  });
  await Flashcard.create({
    front: 'chưa mở 2',
    back: '2',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
  });
  await Flashcard.create({
    front: 'chưa mở 3',
    back: '3',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
  });

  const result = await getNewCards(deck._id, user._id);
  const ids = result.cards.map((item) => item._id.toString());

  assert.equal(result.cards.length, 1);
  assert.ok(ids.includes(remainingNew._id.toString()));
  assert.equal(result.limit, 2);
  assert.equal(result.usedToday, 1);
  assert.equal(result.remainingQuota, 1);
  assert.equal(result.totalNew, 3);
});

test('getNewCards đếm suất theo tài khoản, không theo từng học phần', async () => {
  const { user, deck } = await createReviewFixture({
    userOverrides: { newCardsPerDay: 1 },
  });

  const otherDeck = await Deck.create({
    deckName: 'Học phần B',
    description: '',
    language: 'ja-JP',
    userId: user._id,
  });

  await Flashcard.create({
    front: 'deck A đã mở',
    back: 'a',
    userId: user._id,
    deckId: deck._id,
    status: 'active',
    introducedAt: new Date(),
  });

  await Flashcard.create({
    front: 'deck B mới',
    back: 'b',
    userId: user._id,
    deckId: otherDeck._id,
    status: 'new',
  });

  const result = await getNewCards(otherDeck._id, user._id);

  assert.equal(result.cards.length, 0);
  assert.equal(result.limit, 1);
  assert.equal(result.usedToday, 1);
  assert.equal(result.remainingQuota, 0);
  assert.equal(result.totalNew, 1);
});
test('getNewCards dùng mặc định 20 khi user chưa có newCardsPerDay', async () => {
  const { user, deck } = await createReviewFixture();

  await User.updateOne(
    { _id: user._id },
    { $unset: { newCardsPerDay: 1 } },
  );

  await Flashcard.create({
    front: 'mới',
    back: '1',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
  });

  const result = await getNewCards(deck._id, user._id);

  assert.equal(result.cards.length, 1);
  assert.equal(result.limit, 20);
  assert.equal(result.usedToday, 0);
  assert.equal(result.remainingQuota, 20);
  assert.equal(result.totalNew, 1);
});

test('getNewCards hết suất vẫn trả totalNew', async () => {
  const { user, deck } = await createReviewFixture({
    userOverrides: { newCardsPerDay: 1 },
  });

  await Flashcard.create({
    front: 'đã mở hết suất',
    back: 'opened',
    userId: user._id,
    deckId: deck._id,
    status: 'active',
    introducedAt: new Date(),
  });
  await Flashcard.create({
    front: 'còn chờ ngày mai',
    back: 'waiting',
    userId: user._id,
    deckId: deck._id,
    status: 'new',
  });

  const result = await getNewCards(deck._id, user._id);

  assert.equal(result.cards.length, 0);
  assert.equal(result.limit, 1);
  assert.equal(result.usedToday, 1);
  assert.equal(result.remainingQuota, 0);
  assert.equal(result.totalNew, 1);
});
