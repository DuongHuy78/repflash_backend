import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cardRouter from './routers/cardRouter.js';
import userRouter from './routers/userRouter.js';
import deckRouter from './routers/deckRouter.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // Load .env from parent folder

const app = express();
const PORT = process.env.PORT || 6000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// Routes
app.use('/api/cards', cardRouter);
app.use('/api/user', userRouter);
app.use('/api/decks', deckRouter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Mọi /api/... còn lại đều là API không tồn tại
app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'API không tồn tại',
  });
});

// File tĩnh của frontend
const frontendPath = path.resolve(
  __dirname,
  '../../frontend/dist',
);

app.use(express.static(frontendPath));

// Chỉ các URL frontend còn lại mới nhận index.html
app.use((req, res) => {
  res.sendFile(
    path.resolve(frontendPath, 'index.html'),
  );
});

// Database Connection
const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  console.error("Lỗi: MONGODB_URL không được tìm thấy trong file .env!");
  process.exit(1);
}

mongoose.connect(MONGODB_URL)
  .then(() => {
    console.log('Đã kết nối MongoDB thành công');
    app.listen(PORT, '0.0.0.0', () => console.log(`Server đang chạy trên cổng ${PORT} và lắng nghe mọi kết nối`));
  })
  .catch((err) => {
    console.error('Lỗi kết nối MongoDB:', err);
  });
