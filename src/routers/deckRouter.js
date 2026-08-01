import express from 'express';
import * as deckController from '../controllers/deckController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Tất cả thao tác với Học phần (Deck) đều bắt buộc phải có Token (đã Đăng nhập)
router.use(verifyToken);

router.get('/', deckController.getAllDecks);
router.post('/', deckController.createDeck);
router.put('/:id', deckController.editDeck);
router.delete('/:id', deckController.deleteDeck);

export default router;
