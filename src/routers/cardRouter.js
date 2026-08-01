import express from 'express';
import * as cardController from '../controllers/cardController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(verifyToken);

// Routes
router.get('/all', cardController.getAllCards);
router.get('/retry', cardController.getRetryCards);
router.get('/', cardController.getDueCards);
router.post('/', cardController.createCard);
router.post('/bulk', cardController.createBulkCards);
router.put('/:id', cardController.editCard);
router.put('/:id/review', cardController.reviewCard);
router.delete('/:id', cardController.deleteCard);

export default router;
