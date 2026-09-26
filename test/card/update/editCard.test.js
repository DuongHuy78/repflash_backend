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
  editCard,
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


test('editCard từ chối sửa thẻ của user khác', async () => {
  // Arrange
  const { card, otherUser } = await createReviewFixture();
  const originalFront = card.front;

  // Act + assert lỗi quyền sở hữu
  await assert.rejects(
    () => editCard(
      card._id,
      { front: 'Nội dung không được phép sửa' },
      otherUser._id,
    ),
    {
      name: 'AppError',
      message: 'Không tìm thấy thẻ hoặc bạn không có quyền sửa',
    },
  );

  // Assert dữ liệu trong DB không bị thay đổi
  const unchangedCard = await Flashcard.findById(card._id);
  assert.ok(unchangedCard);
  assert.equal(unchangedCard.front, originalFront);
});


test('owner sửa nội dung Card thành công', async () => {
  // Arrange
  const { user, card } = await createReviewFixture();

  // Act
  const result = await editCard(
    card._id,
    {
      front: '犬',
      back: 'Con chó',
      pronunciation: 'いぬ',
    },
    user._id,
  );

  // Assert response
  assert.equal(result.front, '犬');
  assert.equal(result.back, 'Con chó');
  assert.equal(result.pronunciation, 'いぬ');

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.ok(savedCard);
  assert.equal(savedCard.front, '犬');
  assert.equal(savedCard.back, 'Con chó');
  assert.equal(savedCard.pronunciation, 'いぬ');
});

test('partial edit một field không làm mất field khác', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      front: '猫',
      back: 'Con mèo',
      pronunciation: 'ねこ',
      speechText: 'ねこ',
      examples: [
        {
          text: '猫が好きです。',
          translation: 'Tôi thích mèo.',
          ttsText: 'ねこがすきです。',
        },
      ],
    },
  });

  // Act: chỉ gửi back
  const result = await editCard(
    card._id,
    {
      back: 'Loài mèo',
    },
    user._id,
  );

  // Assert
  assert.equal(result.back, 'Loài mèo');

  assert.equal(result.front, '猫');
  assert.equal(result.pronunciation, 'ねこ');
  assert.equal(result.speechText, 'ねこ');

  assert.equal(result.examples.length, 1);
  assert.equal(
    result.examples[0].text,
    '猫が好きです。',
  );

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.equal(savedCard.back, 'Loài mèo');
  assert.equal(savedCard.front, '猫');
  assert.equal(savedCard.pronunciation, 'ねこ');
  assert.equal(savedCard.examples.length, 1);
});

test('editCard từ chối nextReview không hợp lệ', async () => {
  // Arrange
  const { user, card } = await createReviewFixture();

  const originalNextReview =
    card.nextReview.getTime();

  // Act + Assert lỗi
  await assert.rejects(
    () => editCard(
      card._id,
      {
        nextReview: 'không-phải-ngày',
      },
      user._id,
    ),
    {
      name: 'AppError',
      message: 'Ngày ôn tiếp theo không hợp lệ',
    },
  );

  // Assert database không thay đổi
  const unchangedCard =
    await Flashcard.findById(card._id);

  assert.equal(
    unchangedCard.nextReview.getTime(),
    originalNextReview,
  );
});

test('editCard bỏ qua field tiến độ client tự gửi', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      interval: 3,
      repetition: 2,
      easeFactor: 2.5,
    },
  });

  // Act
  const result = await editCard(
    card._id,
    {
      front: '犬',

      // Những field không được sửa trực tiếp
      interval: 999,
      repetition: 999,
      easeFactor: 99,
    },
    user._id,
  );

  // Field nội dung hợp lệ vẫn được cập nhật
  assert.equal(result.front, '犬');

  // Field tiến độ giữ nguyên
  assert.equal(result.interval, 3);
  assert.equal(result.repetition, 2);
  assert.equal(result.easeFactor, 2.5);

  // Assert database
  const savedCard = await Flashcard.findById(card._id);

  assert.equal(savedCard.front, '犬');
  assert.equal(savedCard.interval, 3);
  assert.equal(savedCard.repetition, 2);
  assert.equal(savedCard.easeFactor, 2.5);
});

test('validation edit lỗi không làm thay đổi dữ liệu cũ', async () => {
  // Arrange
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      front: '猫',
      back: 'Con mèo',
      pronunciation: 'ねこ',
    },
  });

  // Act + Assert lỗi
  await assert.rejects(
    () => editCard(
      card._id,
      {
        front: '   ',
      },
      user._id,
    ),
    /mặt trước.*trống/i,
  );

  // Assert database không bị thay đổi
  const unchangedCard =
    await Flashcard.findById(card._id);

  assert.ok(unchangedCard);
  assert.equal(unchangedCard.front, '猫');
  assert.equal(unchangedCard.back, 'Con mèo');
  assert.equal(unchangedCard.pronunciation, 'ねこ');
});


test('editCard bỏ qua status từ client', async () => {
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
    },
  });

  const result = await editCard(
    card._id,
    {
      front: 'mèo',
      status: 'active',
    },
    user._id,
  );

  assert.equal(result.front, 'mèo');
  assert.equal(result.status, 'new');

  const savedCard = await Flashcard.findById(card._id);
  assert.equal(savedCard.status, 'new');
  assert.equal(savedCard.front, 'mèo');
});

test('editCard bỏ qua nextReview khi thẻ new', async () => {
  const originalNextReview = new Date('2026-01-01T00:00:00.000Z');
  const { user, card } = await createReviewFixture({
    cardOverrides: {
      status: 'new',
      nextReview: originalNextReview,
    },
  });

  const result = await editCard(
    card._id,
    {
      back: 'mèo (đã sửa)',
      nextReview: '2026-12-31T00:00:00.000Z',
    },
    user._id,
  );

  assert.equal(result.back, 'mèo (đã sửa)');
  assert.equal(
    new Date(result.nextReview).getTime(),
    originalNextReview.getTime(),
  );
});
