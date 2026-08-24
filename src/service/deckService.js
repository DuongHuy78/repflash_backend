import Deck from "../models/Deck.js";
import Flashcard from "../models/Flashcard.js";
import mongoose from 'mongoose';

export const createDeck = async (data, currentUserId) => {
    const { deckName, description, language } = data;
    const normalizedDeckName = deckName?.trim();

    if (!normalizedDeckName) {
    throw new Error(
        'Tên học phần không được để trống',
    );
    }
    const newDeck = new Deck({ deckName, userId: currentUserId, description, language: language || 'ja-JP' });
    return await newDeck.save();
}

export const getAllDecks = async (currentUserId) => {
    const decks = await Deck.find({ userId: currentUserId });
    return decks;
}

export const editDeck = async (deckId, currentUserId, data) => {
    const { deckName, description, language } = data;
    const deck = await Deck.findOne({ _id: deckId, userId: currentUserId });
    
    if (!deck) throw new Error('Không tìm thấy tập hoặc bạn không có quyền sửa');

    if (deckName !== undefined) deck.deckName = deckName;
    if (description !== undefined) deck.description = description;
    if (language !== undefined) deck.language = language;

    return await deck.save();
}

export const deleteDeck = async (
  deckId,
  currentUserId,
) => {
  return mongoose.connection.transaction(
    async (session) => {
      const deck = await Deck.findOne({
        _id: deckId,
        userId: currentUserId,
      }).session(session);

      if (!deck) {
        throw new Error(
          'Không tìm thấy học phần hoặc không có quyền xóa',
        );
      }

      await Flashcard.deleteMany(
        {
          deckId,
          userId: currentUserId,
        },
        { session },
      );

      await Deck.deleteOne(
        {
          _id: deckId,
          userId: currentUserId,
        },
        { session },
      );

      return {
        message:
          'Đã xóa học phần và toàn bộ thẻ liên quan',
      };
    },
  );
};