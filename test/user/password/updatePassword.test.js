import test, {
  before,
  beforeEach,
  after,
} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import User from '../../../src/models/User.js';
import Deck from '../../../src/models/Deck.js';
import Flashcard from '../../../src/models/Flashcard.js';
import bcrypt from 'bcryptjs';

import { 
    updatePassword 
 } from "../../../src/service/userService.js";
import { createReviewFixture } from '../../support/testData.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

dotenv.config({
    path: path.resolve(currentDirectory, '../../../../.env'),
});


before(async () => {
  const testUrl = process.env.MONGODB_TEST_URL;

  if (!testUrl || !testUrl.includes('test')) {
    throw new Error(
      'MONGODB_TEST_URL phải trỏ tới database dành riêng cho test',
    );
  }

  await mongoose.connect(testUrl);
});

beforeEach(async () => {
  await Promise.all([
    Flashcard.deleteMany({}),
    Deck.deleteMany({}),
    User.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
      await Promise.all([
        Flashcard.deleteMany({}),
        Deck.deleteMany({}),
        User.deleteMany({}),
      ]);
  }

  await mongoose.disconnect();
});


test('Nhập mật khẩu sai và trả lỗi', async () => {
    const { user, card } = await createReviewFixture();

    await assert.rejects(
    () => updatePassword(user._id, 'wrong_password', 'new_password'),
    {
        name: 'AppError',
        message: 'Mật khẩu hiện tại không đúng.',
        statusCode: 401,
    },
    );
});

test('Nhập mật khẩu mới < 8 và trả lỗi', async () => {
    const { user, card } = await createReviewFixture();


    await assert.rejects(
    () => updatePassword(user._id, user.password, "1234567"),
    {
        name: 'AppError',
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
        statusCode: 400,
    },
    );
});

const PLAIN_PASSWORD = 'test-password';

const createPasswordUser = async (overrides = {}) => {
  const uniqueId = new mongoose.Types.ObjectId().toString();
  const hashedPassword = await bcrypt.hash(
    PLAIN_PASSWORD,
    Number(process.env.SALT_ROUNDS),
  );

  return User.create({
    username: `password-user-${uniqueId}`,
    email: `password-${uniqueId}@example.com`,
    password: hashedPassword,
    timezone: 'Asia/Ho_Chi_Minh',
    tokenVersion: 0,
    ...overrides,
  });
};

test('mật khẩu mới trùng mật khẩu cũ thì 400', async () => {
  const user = await createPasswordUser();

  await assert.rejects(
    () => updatePassword(user._id, PLAIN_PASSWORD, PLAIN_PASSWORD),
    {
      name: 'AppError',
      message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      statusCode: 400,
    },
  );
});

test('đổi mật khẩu thành công: hash mới, tăng tokenVersion, xóa token reset', async () => {
  const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const user = await createPasswordUser({
    tokenVersion: 0,
    passwordResetTokenHash: 'pending-reset-hash',
    passwordResetExpiresAt: resetExpiresAt,
  });

  await updatePassword(user._id, PLAIN_PASSWORD, 'new_password1');

  const savedUser = await User.findById(user._id).select('+passwordResetTokenHash');

  assert.equal(savedUser.tokenVersion, 1);
  assert.equal(savedUser.passwordResetTokenHash, null);
  assert.equal(savedUser.passwordResetExpiresAt, null);
  assert.equal(await bcrypt.compare('new_password1', savedUser.password), true);
  assert.equal(await bcrypt.compare(PLAIN_PASSWORD, savedUser.password), false);
});
