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
  createCard,
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


test('Owner tạo Card trong Deck của mình thành công.', async () => {
  const { user, deck } = await createReviewFixture();

  // Act
  const result = await createCard({
    front: '  犬  ',
    back: '  Con chó  ',
    pronunciation: '  いぬ  ',
    userId: user._id,
    deckId: deck._id,
  });

  // Assert kết quả service
  assert.ok(result._id);

  assert.equal(result.front, '犬');
  assert.equal(result.back, 'Con chó');
  assert.equal(result.pronunciation, 'いぬ');

  assert.equal(
    result.userId.toString(),
    user._id.toString(),
  );

  assert.equal(
    result.deckId.toString(),
    deck._id.toString(),
  );

  assert.equal(result.status, 'new');
  assert.equal(result.introducedAt, null);
});

test('Không tạo Card trong Deck của user khác.', async () => {
  const { user, otherDeck } = await createReviewFixture();

  await assert.rejects(
    () => createCard({
    front: '  犬  ',
    back: '  Con chó  ',
    pronunciation: '  いぬ  ',
    userId: user._id,
    deckId: otherDeck._id,
  }),
    {
      name: 'AppError',
      message: 'Không tìm thấy học phần hoặc bạn không có quyền sử dụng học phần này',
    },
  );
});

test('không tạo Card khi Deck không tồn tại', async () => {
  // Arrange
  const { user } = await createReviewFixture();

  const nonexistentDeckId =
    new mongoose.Types.ObjectId();

  const cardCountBefore =
    await Flashcard.countDocuments({});

  // Act + Assert lỗi
  await assert.rejects(
    () => createCard({
      front: '犬',
      back: 'Con chó',
      userId: user._id,
      deckId: nonexistentDeckId,
    }),
    {
      name: 'AppError',
      message:
        'Không tìm thấy học phần hoặc bạn không có quyền sử dụng học phần này',
    },
  );

  // Assert DB không thay đổi
  const cardCountAfter =
    await Flashcard.countDocuments({});

  assert.equal(cardCountAfter, cardCountBefore);
});

test('không tạo Card khi thiếu deckId', async () => {
  // Arrange
  const { user } = await createReviewFixture();

  const cardCountBefore =
    await Flashcard.countDocuments({});

  // Act + Assert lỗi
  await assert.rejects(
    () => createCard({
      front: '犬',
      back: 'Con chó',
      userId: user._id,

      // Không truyền deckId
    }),
    {
      name: 'AppError',
      message: 'Hãy chọn học phần',
    },
  );

  // Assert DB không thay đổi
  const cardCountAfter =
    await Flashcard.countDocuments({});

  assert.equal(cardCountAfter, cardCountBefore);
});

test('không tạo Card khi deckId sai định dạng', async () => {
  const { user } = await createReviewFixture();

  await assert.rejects(
    () => createCard({
      front: '犬',
      back: 'Con chó',
      userId: user._id,
      deckId: 'invalid-object-id',
    }),
    {
      message: 'Mã học phần không hợp lệ',
    },
  );
});

test('createCard bỏ qua field tiến độ do client tự gửi', async () => {
  // Arrange
  const { user, deck } =
    await createReviewFixture();

  const maliciousNextReview =
    new Date('2099-01-01T00:00:00.000Z');

  const maliciousReviewedAt =
    new Date('2098-01-01T00:00:00.000Z');

  const maliciousMasteredAt =
    new Date('2097-01-01T00:00:00.000Z');

  // Act
  const result = await createCard({
    front: '犬',
    back: 'Con chó',
    userId: user._id,
    deckId: deck._id,

    // Các field client không được tự quyết định
    interval: 999,
    repetition: 999,
    easeFactor: 99,
    status: 'mastered',
    masteredAt: maliciousMasteredAt,
    sameDayRetry: true,
    sameDayRetryCount: 999,
    lastReviewedAt: maliciousReviewedAt,
    nextReview: maliciousNextReview,
  });

  // Assert các giá trị phải lấy default của schema
  assert.equal(result.interval, 0);
  assert.equal(result.repetition, 0);
  assert.equal(result.easeFactor, 2.5);

  assert.equal(result.status, 'new');
  assert.equal(result.masteredAt, null);

  assert.equal(result.sameDayRetry, false);
  assert.equal(result.sameDayRetryCount, 0);
  assert.equal(result.lastReviewedAt, null);

  assert.ok(result.nextReview instanceof Date);

  assert.notEqual(
    result.nextReview.toISOString(),
    maliciousNextReview.toISOString(),
  );

  // Assert database
  const savedCard =
    await Flashcard.findById(result._id);

  assert.ok(savedCard);
  assert.equal(savedCard.interval, 0);
  assert.equal(savedCard.repetition, 0);
  assert.equal(savedCard.easeFactor, 2.5);
  assert.equal(savedCard.status, 'new');
  assert.equal(savedCard.masteredAt, null);
  assert.equal(savedCard.sameDayRetry, false);
  assert.equal(savedCard.sameDayRetryCount, 0);
  assert.equal(savedCard.lastReviewedAt, null);
});


test('createCard bỏ qua status không hợp lệ do client gửi', async () => {
  // Arrange
  const { user, deck } =
    await createReviewFixture();

  // Act
  const result = await createCard({
    front: '犬',
    back: 'Con chó',
    userId: user._id,
    deckId: deck._id,

    status: 'hacked',
  });

  // Assert response
  assert.equal(result.status, 'new');

  // Assert database
  const savedCard =
    await Flashcard.findById(result._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'new');
});
