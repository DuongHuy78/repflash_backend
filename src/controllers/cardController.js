import * as cardService from '../service/cardService.js';

export const getAllCards = async (req, res) => {
  try {
    const filters = req.query;
    const currentUserId = req.user._id;
    const result = await cardService.getAllCards(filters, currentUserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDueCards = async (req, res) => {
  try {
    const { deck = 'japanese' } = req.query;
    const currentUserId = req.user._id;
    const cards = await cardService.getDueCards(deck, currentUserId);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRetryCards = async (req, res) => {
  try {
    const { deck = 'japanese' } = req.query;
    const currentUserId = req.user._id;
    
    const cards = await cardService.getRetryCards(deck, currentUserId);
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCard = async (req, res) => {
  try {
    // Đóng dấu chủ quyền: nhét userId vào trước khi tạo thẻ
    const newCardData = { ...req.body, userId: req.user._id };
    const savedCard = await cardService.createCard(newCardData);
    res.status(201).json(savedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const editCard = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;
    const updatedCard = await cardService.editCard(id, req.body, currentUserId);
    res.json(updatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createBulkCards = async (req, res) => {
  try {
    const { cards, deck = 'japanese' } = req.body;
    const currentUserId = req.user._id;
    const result = await cardService.createBulkCards(cards, deck, currentUserId);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const reviewCard = async (req, res) => {
  try {
    const { id } = req.params;
    const qualityScore = Number(req.body.quality);
    const currentUserId = req.user._id;
    const result = await cardService.reviewCard(id, qualityScore, currentUserId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;
    const result = await cardService.deleteCard(id, currentUserId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
