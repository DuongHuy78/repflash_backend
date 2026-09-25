import * as cardService from '../service/cardService.js';

export const getAllCards = async (req, res) => {
  const filters = req.query;
  const currentUserId = req.user._id;
  const result = await cardService.getAllCards(filters, currentUserId);
  res.json(result);
};

export const getDueCards = async (req, res) => {
  const { deckId } = req.query;
  const currentUserId = req.user._id;
  const cards = await cardService.getDueCards(deckId, currentUserId);
  res.json(cards);
};

export const getRetryCards = async (req, res) => {
  const { deckId } = req.query;
  const currentUserId = req.user._id;
  const cards = await cardService.getRetryCards(deckId, currentUserId);
  res.json(cards);
};

export const getNewCards = async (req, res) => {
  const { deckId } = req.query;
  const currentUserId = req.user._id;
  const result = await cardService.getNewCards(deckId, currentUserId);
  res.json(result);
};

export const createCard = async (req, res) => {
  const { deckId, ...content } = req.body;
  // userId luôn lấy từ JWT; deckId chỉ xác định học phần cần tạo thẻ.
  const newCardData = {
    ...content,
    deckId,
    userId: req.user._id,
  };
  const savedCard = await cardService.createCard(newCardData);
  res.status(201).json(savedCard);
};

export const editCard = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;
  const updatedCard = await cardService.editCard(id, req.body, currentUserId);
  res.json(updatedCard);
};

export const createBulkCards = async (req, res) => {
  const { cards, deckId } = req.body;
  const currentUserId = req.user._id;
  const result = await cardService.createBulkCards(cards, deckId, currentUserId);
  res.status(201).json(result);
};

export const reviewCard = async (req, res) => {
  const { id } = req.params;
  const qualityScore = Number(req.body.quality);
  const currentUserId = req.user._id;
  const result = await cardService.reviewCard(id, qualityScore, currentUserId);
  res.json(result);
};

export const deleteCard = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;
  const result = await cardService.deleteCard(id, currentUserId);
  res.json(result);
};

export const resetCard = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;

  const result = await cardService.resetCard(id, currentUserId);
  res.json(result);
};
