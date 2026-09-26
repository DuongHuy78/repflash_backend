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
  createBulkCards,
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


test('bulk import nhiều Card hợp lệ thành công', async () => {
  // Arrange
  const { user, deck } = await createReviewFixture();

  const cards = [
    {
      front: '犬',
      back: 'Con chó',
      pronunciation: 'いぬ',
    },
    {
      front: '鳥',
      back: 'Con chim',
      pronunciation: 'とり',
    },
  ];

  const countBefore = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  // Act
  const result = await createBulkCards(
    cards,
    deck._id,
    user._id,
  );

  // Assert response
  assert.equal(result.count, 2);
  assert.equal(
    result.message,
    'Đã nhập thành công 2 thẻ',
  );

  // Assert database
  const countAfter = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  assert.equal(countAfter, countBefore + 2);

  const savedCards = await Flashcard.find({
    userId: user._id,
    deckId: deck._id,
    front: {
      $in: ['犬', '鳥'],
    },
  });

  assert.equal(savedCards.length, 2);
});

const invalidBulkInputs = [
  {
    name: 'mảng rỗng',
    value: [],
  },
  {
    name: 'null',
    value: null,
  },
  {
    name: 'object',
    value: {},
  },
  {
    name: 'chuỗi',
    value: 'không phải mảng',
  },
];

for (const testCase of invalidBulkInputs) {
  test(`bulk import từ chối ${testCase.name}`, async () => {
    const { user, deck } =
      await createReviewFixture();

    await assert.rejects(
      () => createBulkCards(
        testCase.value,
        deck._id,
        user._id,
      ),
      {
        name: 'AppError',
        message: 'Không có dữ liệu thẻ hợp lệ',
      },
    );
  });
}

test('Card lỗi ở giữa làm toàn bộ bulk import thất bại', async () => {
  // Arrange
  const { user, deck } = await createReviewFixture();

  const cards = [
    {
      front: '1',
      back: 'Con chó',
    },
    {
      front: '2',
      back: 'Con chim',
    },
    {
      front: '3',
      back: '   ', // Card thứ ba bị lỗi
    },
    {
      front: '4',
      back: 'Con cá',
    },
  ];

  const countBefore = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  // Act + Assert lỗi đúng dòng
  await assert.rejects(
    () => createBulkCards(
      cards,
      deck._id,
      user._id,
    ),
    {
      name: 'AppError',
      message:
        'Thẻ ở dòng 3: Mặt sau không được để trống',
    },
  );

  // Assert không lưu cả Card 1 và Card 2
  const countAfter = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  assert.equal(countAfter, countBefore);

  const importedCards = await Flashcard.find({
    front: {
      $in: ['1', '2', '3', '4'],
    },
    userId: user._id,
  });

  assert.equal(importedCards.length, 0);
});

test('bulk import từ chối khi vượt quá 500 Card', async () => {
  // Arrange
  const { user, deck } = await createReviewFixture();

  const cards = Array.from(
    { length: 501 },
    (_, index) => ({
      front: `Từ ${index + 1}`,
      back: `Nghĩa ${index + 1}`,
    }),
  );

  const countBefore = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  // Act + Assert
  await assert.rejects(
    () => createBulkCards(
      cards,
      deck._id,
      user._id,
    ),
    {
      name: 'AppError',
      message:
        'Mỗi lần chỉ được nhập tối đa 500 thẻ',
    },
  );

  const countAfter = await Flashcard.countDocuments({
    userId: user._id,
    deckId: deck._id,
  });

  assert.equal(countAfter, countBefore);
});

test('bulk import từ chối khi thiếu deckId', async () => {
  const { user } = await createReviewFixture();

  await assert.rejects(
    () => createBulkCards(
      [
        {
          front: '犬',
          back: 'Con chó',
        },
      ],
      undefined,
      user._id,
    ),
    {
      name: 'AppError',
      message:
        'Hãy chọn học phần trước khi nhập thẻ',
    },
  );
});

test('không bulk import vào Deck của user khác', async () => {
  // Arrange
  const {
    user,
    otherDeck,
  } = await createReviewFixture();

  const countBefore = await Flashcard.countDocuments({
    deckId: otherDeck._id,
  });

  // Act + Assert
  await assert.rejects(
    () => createBulkCards(
      [
        {
          front: '犬',
          back: 'Con chó',
        },
      ],
      otherDeck._id,
      user._id,
    ),
    {
      name: 'AppError',
      message:
        'Không tìm thấy học phần hoặc bạn không có quyền sử dụng học phần này',
    },
  );

  const countAfter = await Flashcard.countDocuments({
    deckId: otherDeck._id,
  });

  assert.equal(countAfter, countBefore);
});

test('bulk import bỏ qua owner và tiến độ do client tự gửi', async () => {
  // Arrange
  const {
    user,
    deck,
    otherUser,
    otherDeck,
  } = await createReviewFixture();

  // Act
  const result = await createBulkCards(
    [
      {
        front: '犬',
        back: 'Con chó',

        // Payload giả mạo
        userId: otherUser._id,
        deckId: otherDeck._id,
        interval: 999,
        repetition: 999,
        easeFactor: 99,
        status: 'mastered',
        sameDayRetry: true,
      },
    ],
    deck._id,
    user._id,
  );

  assert.equal(result.count, 1);

  const savedCard = await Flashcard.findOne({
    front: '犬',
    userId: user._id,
    deckId: deck._id,
  });

  assert.ok(savedCard);

  // Owner/Deck lấy từ tham số server kiểm soát
  assert.equal(
    savedCard.userId.toString(),
    user._id.toString(),
  );

  assert.equal(
    savedCard.deckId.toString(),
    deck._id.toString(),
  );

  // Tiến độ lấy default
  assert.equal(savedCard.interval, 0);
  assert.equal(savedCard.repetition, 0);
  assert.equal(savedCard.easeFactor, 2.5);
  assert.equal(savedCard.status, 'new');
  assert.equal(savedCard.sameDayRetry, false);
  assert.equal(savedCard.introducedAt, null);
});


test('bulk import bỏ qua status không hợp lệ trong payload', async () => {
  // Arrange
  const { user, deck } =
    await createReviewFixture();

  // Act
  const result = await createBulkCards(
    [
      {
        front: '犬',
        back: 'Con chó',
        status: 'hacked',
      },
    ],
    deck._id,
    user._id,
  );

  assert.equal(result.count, 1);

  // Assert database
  const savedCard = await Flashcard.findOne({
    front: '犬',
    userId: user._id,
    deckId: deck._id,
  });

  assert.ok(savedCard);
  assert.equal(savedCard.status, 'new');
});
