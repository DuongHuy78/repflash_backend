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
import User from '../src/models/User.js';
import Deck from '../src/models/Deck.js';
import Flashcard from '../src/models/Flashcard.js';

import {
  createBulkCards,
  createCard,
  deleteCard,
  editCard,
  getAllCards,
  getDueCards,
  getNewCards,
  reviewCard,
} from '../src/service/cardService.js';
import { createReviewFixture } from './testData.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

dotenv.config({
    path: path.resolve(currentDirectory, '../../.env'),
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
      message: 'Không tìm thấy thẻ hoặc không thuộc quyền sở hữu',
    },
  );
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
      name: 'Error',
      message: 'Không tìm thấy thẻ hoặc bạn không có quyền sửa',
    },
  );

  // Assert dữ liệu trong DB không bị thay đổi
  const unchangedCard = await Flashcard.findById(card._id);
  assert.ok(unchangedCard);
  assert.equal(unchangedCard.front, originalFront);
});

test('deleteCard từ chối xóa thẻ của user khác', async () => {
  // Arrange
  const { card, otherUser } = await createReviewFixture();

  // Act + assert lỗi quyền sở hữu
  await assert.rejects(
    () => deleteCard(card._id, otherUser._id),
    {
      name: 'Error',
      message: 'Không tìm thấy thẻ hoặc không đủ quyền',
    },
  );

  // Assert thẻ vẫn còn trong DB
  const existingCard = await Flashcard.findById(card._id);
  assert.ok(existingCard);
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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
        name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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
      name: 'Error',
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

test('editCard từ chối status không thuộc enum', async () => {
  // Arrange
  const { user, card } =
    await createReviewFixture({
      cardOverrides: {
        status: 'active',
      },
    });

  // Act + Assert lỗi Mongoose
  await assert.rejects(
    () => editCard(
      card._id,
      {
        status: 'hacked',
      },
      user._id,
    ),
    (error) => {
      assert.equal(
        error.name,
        'ValidationError',
      );

      assert.ok(error.errors.status);

      assert.equal(
        error.errors.status.kind,
        'enum',
      );

      assert.equal(
        error.errors.status.value,
        'hacked',
      );

      return true;
    },
  );

  // Assert database không thay đổi
  const unchangedCard =
    await Flashcard.findById(card._id);

  assert.ok(unchangedCard);
  assert.equal(unchangedCard.status, 'active');
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

test('getNewCards đếm suất theo từng học phần', async () => {
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

  const deckBNew = await Flashcard.create({
    front: 'deck B mới',
    back: 'b',
    userId: user._id,
    deckId: otherDeck._id,
    status: 'new',
  });

  const result = await getNewCards(otherDeck._id, user._id);

  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0]._id.toString(), deckBNew._id.toString());
  assert.equal(result.limit, 1);
  assert.equal(result.usedToday, 0);
  assert.equal(result.remainingQuota, 1);
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