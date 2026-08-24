import Flashcard from '../models/Flashcard.js';
import { updateStreak } from './userService.js';
import { getDayRangeInTimeZone, normalizeCardContent, parseValidDate, } from '../utils/utlils.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import Deck from '../models/Deck.js';

const MAX_BULK_CARDS = 500;
const MASTERED_INTERVAL_DAYS = 7;
const ALLOWED_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'front',
  'back',
  'status',
  'nextReview',
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateDeckAccess = async (
  deckId,
  currentUserId,
) => {
  if (!deckId) {
    throw new Error('Hãy chọn học phần');
  }

  if (!mongoose.isValidObjectId(deckId)) {
    throw new Error('Mã học phần không hợp lệ');
  }

  const deckExists = await Deck.exists({
    _id: deckId,
    userId: currentUserId,
  });

  if (!deckExists) {
    throw new Error(
      'Không tìm thấy học phần hoặc bạn không có quyền sử dụng học phần này',
    );
  }
};

const clearExpiredSameDayRetries = async (startOfDay, userId) => {
  await Flashcard.updateMany(
    {
      userId: userId,
      status: 'learning',
      sameDayRetry: true,
      lastReviewedAt: { $lt: startOfDay },
    },
    {
      $set: {
        status: 'active',
        sameDayRetry: false,
        sameDayRetryCount: 0,
      },
    }
  );
};

const getUserTimezone = async (userId) => {
  const user = await User.findById(userId).select('timezone');
  if (!user) {
    throw new Error('Không tìm thấy người dùng');
  }
  return user.timezone || 'Asia/Ho_Chi_Minh';
};

export const getAllCards = async (filters, currentUserId) => {
  const { status, search, dateFrom, dateTo, page = 1, limit = 50, sortBy = 'createdAt', order = 'desc', deckId } = filters;

  const parsedLimit = Number(limit);
  const parsedPage = Number(page);

  const safePage = Number.isInteger(parsedPage)
    ? Math.max(1, parsedPage)
    : 1;

  const safeLimit =
    Number.isInteger(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 50;

  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy)
  ? sortBy : 'createdAt';
  let query = { userId: currentUserId, deckId };

  const safeOrder = order === 'asc' ? 1 : -1;

  const parsedDateFrom = parseValidDate(
    dateFrom,
    'Ngày bắt đầu',
  );

  const parsedDateTo = parseValidDate(
    dateTo,
    'Ngày kết thúc',
  );

  if (parsedDateFrom && parsedDateTo) {
    if (parsedDateFrom > parsedDateTo) {
      throw new Error(
        'Ngày bắt đầu không được sau ngày kết thúc',
      );
    }
  }

  // 1. Lọc theo trạng thái
  if (status) {
    query.status = status;
  }

  // 2. Tìm kiếm theo từ (mặt trước hoặc mặt sau)
  const normalizedSearch = typeof search === 'string'
    ? search.trim()
    : '';

  if (normalizedSearch) {
    const escapedSearch = escapeRegExp(normalizedSearch);
    query.$or = [
      { front: { $regex: escapedSearch, $options: 'i' } },
      { pronunciation: { $regex: escapedSearch, $options: 'i' } },
      { back: { $regex: escapedSearch, $options: 'i' } },
      { 'examples.text': { $regex: escapedSearch, $options: 'i' } },
      { 'examples.translation': { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  // 3. Lọc theo ngày tạo
  if (parsedDateFrom || parsedDateTo) {
    query.createdAt = {};
    if (parsedDateFrom) query.createdAt.$gte = new Date(parsedDateFrom);
    if (parsedDateTo) query.createdAt.$lte = new Date(parsedDateTo);
  }

  // 4. Phân trang
  const skip = (safePage - 1) * safeLimit;

  // 5. Cấu hình sắp xếp
  const sortObject = {
    [safeSortBy]: safeOrder,
  };

  // Thực thi query lấy danh sách
  const cards = await Flashcard.find(query)
    .sort(sortObject)
    .skip(skip)
    .limit(safeLimit);
    
  // Đếm tổng số lượng thẻ
  const totalCards = await Flashcard.countDocuments(query);

  return {
    cards,
    totalPages: Math.ceil(totalCards / safeLimit),
    currentPage: safePage,
    totalCards
  };
};

export const getDueCards = async (deckId, currentUserId) => {
  const timeZone = await getUserTimezone(currentUserId);
  const { startOfDay, endOfDay } = getDayRangeInTimeZone(new Date, timeZone);
  await clearExpiredSameDayRetries(startOfDay, currentUserId);

  const cards = await Flashcard.find({
    userId: currentUserId,
    deckId: deckId,
    nextReview: { $lte: endOfDay },
    status: { $ne: 'mastered' },
    sameDayRetry: { $ne: true },
  }).sort({ nextReview: 1 });
  
  return cards;
};

export const getRetryCards = async (deckId, currentUserId) => {
  const timeZone = await getUserTimezone(currentUserId);
  const { startOfDay } = getDayRangeInTimeZone(new Date, timeZone);
  await clearExpiredSameDayRetries(startOfDay, currentUserId);

  const cards = await Flashcard.find({
    userId: currentUserId,
    deckId: deckId,
    status: 'learning',
    sameDayRetry: true,
    lastReviewedAt: { $gte: startOfDay },
  }).sort({ sameDayRetryCount: -1, lastReviewedAt: 1 });

  return cards;
};

export const createCard = async (data) => {
  const { front, pronunciation, speechText, back, examples, deckId, userId } = data;

  await validateDeckAccess(deckId, userId);
  const normalizedContent = normalizeCardContent(
    { front, pronunciation, speechText, back, examples },
    { partial: false },
  );

  const newCard = new Flashcard({
    ...normalizedContent,
    deckId,
    userId,
  });
  return await newCard.save();
};

export const editCard = async (id, data, currentUserId) => {
 const { status, nextReview } = data;

  const card = await Flashcard.findOne({
    _id: id,
    userId: currentUserId,
  });

  if (!card) {
    throw new Error(
      'Không tìm thấy thẻ hoặc bạn không có quyền sửa',
    );
  }

  const contentChanges = normalizeCardContent(
    data,
    { partial: true },
  );

  Object.assign(card, contentChanges);

  if (status !== undefined) {
    card.status = status;
  }

  if (nextReview !== undefined) {
    const parsedNextReview = new Date(nextReview);

    if (Number.isNaN(parsedNextReview.getTime())) {
      throw new Error('Ngày ôn tiếp theo không hợp lệ');
    }

    card.nextReview = parsedNextReview;
  }

  if (status === 'mastered' && !card.masteredAt) {
    card.masteredAt = new Date();
  }

  return await card.save();
};

export const createBulkCards = async (cards, deckId, currentUserId) => {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    throw new Error('Không có dữ liệu thẻ hợp lệ');
  }

  if (cards.length > MAX_BULK_CARDS) {
    throw new Error(
      `Mỗi lần chỉ được nhập tối đa ${MAX_BULK_CARDS} thẻ`,
    );
  }

  if (!deckId) {
    throw new Error('Hãy chọn học phần trước khi nhập thẻ');
  }

  await validateDeckAccess(deckId, currentUserId);

  // Gắn học phần và chủ sở hữu do server kiểm soát vào từng thẻ.
  const cardsWithDeck = cards.map((card, index) => {
    try{
      const normalizedContent = normalizeCardContent(card);

      return {
        ...normalizedContent,
        deckId,
        userId: currentUserId,
      };
    } catch (error) {
      throw new Error(
        `Thẻ ở dòng ${index + 1}: ${error.message}`,
      );
    }
  });

  const savedCards = await Flashcard.insertMany(cardsWithDeck);
  return { message: `Đã nhập thành công ${savedCards.length} thẻ`, count: savedCards.length };
};

export const reviewCard = async (id, qualityScore, currentUserId) => {
  if (!Number.isInteger(qualityScore) || qualityScore < 1 || qualityScore > 4) {
    throw new Error('Điểm review không hợp lệ');
  }

  const card = await Flashcard.findOne({ _id: id, userId: currentUserId });
  if (!card) throw new Error('Không tìm thấy thẻ hoặc không thuộc quyền sở hữu');

  let { interval, easeFactor, repetition } = card;
  let newInterval;

  if (qualityScore === 4 && interval > MASTERED_INTERVAL_DAYS) {
    card.status = 'mastered';
    card.masteredAt = new Date();
    console.log('Thẻ đã đánh dấu thuộc '+ id);
    await card.save();
    const { user, newMilestone } = await updateStreak(currentUserId);

    return {
      mastered: true,
      cardId: id,
      message: 'Thẻ đã được đánh dấu là đã thuộc.',
      newMilestone: newMilestone || null,
      currentStreak: user?.currentStreak || 0
    };
  }
      
  // 1. Ánh xạ Quality của UI (1-4) sang SM-2 (0-5) để tránh lỗi "Ease Hell"
  let q;
  if (qualityScore === 4) q = 5;      // Dễ -> Hoàn hảo
  else if (qualityScore === 3) q = 4; // Tốt -> Nhớ được
  else if (qualityScore === 2) q = 3; // Khó -> Nhớ khó khăn
  else q = 1;                    // Lại -> Sai/Quên

  let newEase = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  // Thuật toán tối ưu cho lượng từ vựng lớn
  if (qualityScore < 2) {
    // 2. Chống Reset hoàn toàn (Lapse Multiplier)
    // Nếu thẻ đã học lâu (interval > 10 ngày), thay vì rớt xuống 1 ngày, ta giảm còn 30%
    if (interval > 10) {
      newInterval = Math.max(1, Math.round(interval * 0.3));
    } else {
      newInterval = 1; // Again
      repetition = 0; // Reset số lần nếu thẻ còn mới
    }
  } else {
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      if (qualityScore === 2) {
        newInterval = Math.max(1, Math.round(interval * 1.2)); // Hard
      } else if (qualityScore === 3) {
        newInterval = Math.max(1, Math.round(interval * newEase)); // Good
      } else {
        newInterval = Math.max(1, Math.round(interval * newEase * 1.3)); // Easy
      }
    }
    repetition += 1;
  }

  // Cập nhật thẻ
  card.interval = newInterval;
  card.easeFactor = Math.max(1.3, newEase); // easeFactor không nên nhỏ hơn 1.3
  card.repetition = repetition;
  card.lastReviewedAt = new Date();

  if (qualityScore === 1) {
    card.status = 'learning';
    card.sameDayRetry = true;
    card.sameDayRetryCount = (card.sameDayRetryCount || 0) + 1;
  } else {
    card.status = 'active';
    card.sameDayRetry = false;
  }

  // Tính toán ngày học tiếp theo
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
  card.nextReview = nextReviewDate;

  await card.save();
  const { user, newMilestone } = await updateStreak(currentUserId);
  return {
    card,
    newMilestone: newMilestone || null,
    currentStreak: user?.currentStreak || 0
  };
};

export const deleteCard = async (id, currentUserId) => {
  const deletedCard = await Flashcard.findOneAndDelete({ _id: id, userId: currentUserId });
  if (!deletedCard) throw new Error('Không tìm thấy thẻ hoặc không đủ quyền');
  return { message: 'Đã xoá thẻ thành công' };
};
