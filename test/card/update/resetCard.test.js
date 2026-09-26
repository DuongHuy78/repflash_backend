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
  resetCard,
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


test('resetCard đưa thẻ về new và xóa tiến độ SM-2', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'active',
      interval: 12,
      repetition: 4,
      easeFactor: 2.8,
      introducedAt: new Date(),
      sameDayRetry: true,
      sameDayRetryCount: 2,
      masteredAt: new Date(),
      nextReview: new Date('2026-12-01T00:00:00.000Z'),
    },
  });

  const result = await resetCard(card._id, user._id);

  assert.equal(result.status, 'new');
  assert.equal(result.interval, 0);
  assert.equal(result.repetition, 0);
  assert.equal(result.easeFactor, 2.5);
  assert.equal(result.introducedAt, null);
  assert.equal(result.sameDayRetry, false);
  assert.equal(result.sameDayRetryCount, 0);
  assert.equal(result.masteredAt, null);

  const savedCard = await Flashcard.findById(card._id);
  assert.equal(savedCard.status, 'new');
  assert.equal(savedCard.interval, 0);
  assert.equal(savedCard.sameDayRetryCount, 0);
});

test('resetCard từ chối thẻ đang new', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
    },
  });

  await assert.rejects(
    () => resetCard(card._id, user._id),
    {
      name: 'AppError',
      message: 'Thẻ này đang ở hàng Từ mới.',
    },
  );
});
