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
  reviewCard,
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


test('Again đưa thẻ vào hàng retry trong ngày', async () => {
    // Arrange
    const { user, card } = await createReviewFixture();

    // Act
    const result = await reviewCard(
        card._id,
        1,
        user._id,
    );

  // Assert kết quả service
  assert.equal(result.card.status, 'learning');
  assert.equal(result.card.sameDayRetry, true);
  assert.equal(result.card.sameDayRetryCount, 1);

  // Assert dữ liệu đã lưu vào DB
  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'learning');
  assert.equal(savedCard.sameDayRetry, true);
  assert.equal(savedCard.sameDayRetryCount, 1);
});

test('từ chối quality là số âm', async () => {
    // Arrange
    const { user, card } = await createReviewFixture();

    // Act + assert
  await assert.rejects(
    () => reviewCard(
      card._id,
      -1,
      user._id,
    ),
    {
      name: 'AppError',
      message: 'Điểm review không hợp lệ',
    },
  );
});

test('từ chối quality lớn hơn phạm vi', async () => {
    // Arrange
    const { user, card } = await createReviewFixture();

    // Act + assert
  await assert.rejects(
    () => reviewCard(
      card._id,
      5,
      user._id,
    ),
    {
      name: 'AppError',
      message: 'Điểm review không hợp lệ',
    },
  );
});

test('từ chối quality sai kiểu', async () => {
  // Arrange
  const { user, card } = await createReviewFixture();

    // Act + assert
  await assert.rejects(
    () => reviewCard(
      card._id,
      '1',
      user._id,
    ),
    {
      name: 'AppError',
      message: 'Điểm review không hợp lệ',
    },
  );
});

test('không cho phép user khác review thẻ', async () => {
  const { card, otherUser } = await createReviewFixture();

  // Act + assert
  await assert.rejects(
    () => reviewCard(
      card._id,
      1,
      otherUser._id,
    ),
    {
      name: 'AppError',
      message: 'Không tìm thấy thẻ hoặc không thuộc quyền sở hữu',
    },
  );
});


test('Easy tại interval 7 chưa chuyển thẻ thành mastered', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      interval: 7,
      repetition: 3,
      status: 'active',
      masteredAt: null,
    },
  });

  // Act
  const result = await reviewCard(
    card._id,
    4,
    user._id,
  );

  // Assert response
  assert.equal(result.card.status, 'active');
  assert.equal(result.card.masteredAt, null);

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'active');
  assert.equal(savedCard.masteredAt, null);
});

test('Easy tại interval 8 chuyển thẻ thành mastered', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      interval: 8,
      repetition: 3,
      status: 'active',
      masteredAt: null,
    },
  });

  // Act
  const result = await reviewCard(
    card._id,
    4,
    user._id,
  );

  // Assert response
  assert.equal(result.mastered, true);
    assert.equal(
    result.cardId.toString(),
    card._id.toString(),
  );
  assert.equal(
    result.message,
    'Thẻ đã được đánh dấu là đã thuộc.',
  );

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'mastered');
});

test('Good tại interval 8 không chuyển thẻ thành mastered', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      interval: 8,
      repetition: 3,
      status: 'active',
      masteredAt: null,
    },
  });

  // Act
  const result = await reviewCard(
    card._id,
    3,
    user._id,
  );

  // Assert response
  assert.equal(result.card.status, 'active');
  assert.equal(result.card.masteredAt, null);

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'active');
  assert.equal(savedCard.masteredAt, null);
});

test('Again không làm easeFactor thấp hơn 1.3', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      easeFactor: 1.3,
      interval: 1,
      repetition: 2,
    },
  });

  const result = await reviewCard(
    card._id,
    1,
    user._id,
  );

  assert.equal(result.card.easeFactor, 1.3);
});

test('Good chuyển thẻ learning ra khỏi hàng retry', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'learning',
      sameDayRetry: true,
      sameDayRetryCount: 2,
      repetition: 2,
      interval: 2,
    }
  });

  const result = await reviewCard(
    card._id,
    4,
    user._id,
  );

  assert.equal(result.card.status, 'active');
  assert.equal(result.card.sameDayRetry, false);
});


test('Again trên thẻ new đưa vào bò nhai cỏ và gán introducedAt', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
      introducedAt: null,
      lastReviewedAt: null,
    },
  });

  const result = await reviewCard(card._id, 1, user._id);

  assert.equal(result.card.status, 'learning');
  assert.equal(result.card.sameDayRetry, true);
  assert.ok(result.card.introducedAt);

  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'learning');
  assert.equal(savedCard.sameDayRetry, true);
  assert.ok(savedCard.introducedAt);
});

test('Good trên thẻ new tốt nghiệp active và gán introducedAt', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
      introducedAt: null,
      lastReviewedAt: null,
    },
  });

  const result = await reviewCard(card._id, 3, user._id);

  assert.equal(result.card.status, 'active');
  assert.ok(result.card.introducedAt);

  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'active');
  assert.ok(savedCard.introducedAt);
});

test('ôn lần hai không đè introducedAt', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
      introducedAt: null,
      lastReviewedAt: null,
    },
  });

  const firstReview = await reviewCard(card._id, 3, user._id);
  const introducedAt = firstReview.card.introducedAt;

  assert.ok(introducedAt);

  const secondReview = await reviewCard(card._id, 3, user._id);

  assert.equal(
    new Date(secondReview.card.introducedAt).getTime(),
    new Date(introducedAt).getTime(),
  );
});

test('Again trên thẻ ôn lớn hơn 10 ngày', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'learning',
      interval: 11,
      repetition: 4,
      easeFactor: 2.5,
    },
  });

  const result = await reviewCard(card._id, 1, user._id);

  assert.equal(result.card.interval, 3);
  assert.equal(result.card.repetition, 4);
  assert.equal(result.card.status, 'learning');
  assert.equal(result.card.sameDayRetry, true);
  assert.equal(result.card.sameDayRetryCount, 1);
});

test('Hard trên thẻ ôn lớn hơn 10 ngày', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'learning',
      interval: 11,
      repetition: 4,
      easeFactor: 2.5,
    },
  });

  const result = await reviewCard(card._id, 2, user._id);

  assert.equal(result.card.interval, 13);
  assert.equal(result.card.repetition, 5);
  assert.equal(result.card.status, 'active');
  assert.equal(result.card.sameDayRetry, false);
  assert.equal(result.card.sameDayRetryCount, 0);
});
