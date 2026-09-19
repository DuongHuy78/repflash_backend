import * as deckService from "../service/deckService.js";

export const createDeck = async (req, res) => {
    const currentUserId = req.user._id;
    const savedDeck = await deckService.createDeck(req.body, currentUserId);
    res.status(201).json(savedDeck);
};

export const getAllDecks = async (req, res) => {
    const currentUserId = req.user._id;
    const decks = await deckService.getAllDecks(currentUserId);
    res.json(decks);
};

export const editDeck = async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user._id;
    const updatedDeck = await deckService.editDeck(id, currentUserId, req.body);
    res.json(updatedDeck);
};

export const deleteDeck = async (req, res) => {
    const { id } = req.params;
    const currentUserId = req.user._id;
    const result = await deckService.deleteDeck(id, currentUserId);
    res.json(result);
};
