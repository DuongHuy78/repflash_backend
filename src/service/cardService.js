import Flashcard from '../models/Flashcard.js';
import { updateStreak } from './userService.js';

const MASTERED_INTERVAL_DAYS = 7;

const clearExpiredSameDayRetries = async (startOfDay) => {
  await Flashcard.updateMany(
    {
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

export const getAllCards = async (filters, currentUserId) => {
  const { status, search, dateFrom, dateTo, page = 1, limit = 50, sortBy = 'createdAt', order = 'desc', deck} = filters;

  // Đổi tên trường thành deckId để khớp với Model Flashcard.js
  let query = { userId: currentUserId, deckId: deck };

  // 1. Lọc theo trạng thái
  if (status) {
    query.status = status;
  }

  // 2. Tìm kiếm theo từ (mặt trước hoặc mặt sau)
  if (search) {
    query.$or = [
      { front: { $regex: search, $options: 'i' } },
      { back: { $regex: search, $options: 'i' } }
    ];
  }

  // 3. Lọc theo ngày tạo
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // 4. Phân trang
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // 5. Cấu hình sắp xếp
  const sortObject = {};
  sortObject[sortBy] = order === 'asc' ? 1 : -1;

  // Thực thi query lấy danh sách
  const cards = await Flashcard.find(query)
    .sort(sortObject)
    .skip(skip)
    .limit(parseInt(limit));
    
  // Đếm tổng số lượng thẻ
  const totalCards = await Flashcard.countDocuments(query);

  return {
    cards,
    totalPages: Math.ceil(totalCards / limit),
    currentPage: parseInt(page),
    totalCards
  };
};

export const getDueCards = async (deck, currentUserId, timeZone) => {
  const { startOfDay, endOfDay } = getDayRangeInTimeZone(new Date, timeZone);
  await clearExpiredSameDayRetries(startOfDay);

  const cards = await Flashcard.find({
    userId: currentUserId,
    deckId: deck, // Ánh xạ sang cột deckId
    nextReview: { $lte: endOfDay },
    status: { $ne: 'mastered' },
    sameDayRetry: { $ne: true },
  }).sort({ nextReview: 1 });
  
  return cards;
};

export const getRetryCards = async (deck, currentUserId) => {
  const { startOfDay } = getDayRangeInTimeZone(new Date, timeZone);
  await clearExpiredSameDayRetries(startOfDay);

  const cards = await Flashcard.find({
    userId: currentUserId,
    deckId: deck, // Ánh xạ sang cột deckId
    status: 'learning',
    sameDayRetry: true,
    lastReviewedAt: { $gte: startOfDay },
  }).sort({ sameDayRetryCount: -1, lastReviewedAt: 1 });

  return cards;
};

export const createCard = async (data) => {
  const { front, back, deck, userId } = data;
  // Lưu deck vào cột deckId
  const newCard = new Flashcard({ front, back, deckId: deck, userId });
  return await newCard.save();
};

export const editCard = async (id, data, currentUserId) => {
  const { front, back, status, nextReview, interval, repetition, easeFactor } = data;

  const card = await Flashcard.findOne({ _id: id, userId: currentUserId });
  if (!card) throw new Error('Không tìm thấy thẻ hoặc bạn không có quyền sửa');

  if (front !== undefined) card.front = front;
  if (back !== undefined) card.back = back;
  if (status !== undefined) card.status = status;
  if (nextReview !== undefined) card.nextReview = new Date(nextReview);
  if (interval !== undefined) card.interval = interval;
  if (repetition !== undefined) card.repetition = repetition;
  if (easeFactor !== undefined) card.easeFactor = easeFactor;
  
  if (status === 'mastered' && !card.masteredAt) {
    card.masteredAt = new Date();
  }
  
  return await card.save();
};

export const createBulkCards = async (cards, deck, currentUserId) => {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    throw new Error('Không có dữ liệu thẻ hợp lệ');
  }

  // Ánh xạ deck vào cột deckId
  const cardsWithDeck = cards.map(c => ({ ...c, deckId: c.deck || deck, userId: currentUserId }));
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