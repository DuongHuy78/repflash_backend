import * as deckService from "../service/deckService.js";

export const createDeck = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const savedDeck = await deckService.createDeck(req.body, currentUserId);
        res.status(201).json(savedDeck);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getAllDecks = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const decks = await deckService.getAllDecks(currentUserId);
        res.json(decks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const editDeck = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;
        const updatedDeck = await deckService.editDeck(id, currentUserId, req.body);
        res.json(updatedDeck);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteDeck = async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id;
        const result = await deckService.deleteDeck(id, currentUserId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};