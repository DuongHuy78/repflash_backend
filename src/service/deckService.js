import Deck from "../models/Deck.js";
import Flashcard from "../models/Flashcard.js";

export const createDeck = async (data, currentUserId) => {
    const { deckName, description, language } = data;
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

export const deleteDeck = async (deckId, currentUserId) => {
    const deletedDeck = await Deck.findOneAndDelete({ _id: deckId, userId: currentUserId });
    
    if (!deletedDeck) throw new Error('Không tìm thấy tập hoặc bạn không có quyền xóa');

    // Xóa toàn bộ các thẻ thuộc học phần này
    await Flashcard.deleteMany({ deckId: deckId, userId: currentUserId });

    return { message: 'Đã xoá học phần và toàn bộ các thẻ liên quan' };
}
