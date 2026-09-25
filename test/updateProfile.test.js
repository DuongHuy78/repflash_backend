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
import User from '../src/models/User.js';
import { updateProfile } from '../src/service/userService.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

dotenv.config({
  path: path.resolve(currentDirectory, '../../.env'),
});

const createProfileUser = async (overrides = {}) => {
  const uniqueId = new mongoose.Types.ObjectId().toString();

  return User.create({
    username: `profile-user-${uniqueId}`,
    email: `profile-${uniqueId}@example.com`,
    password: 'test-password',
    timezone: 'Asia/Ho_Chi_Minh',
    newCardsPerDay: 20,
    currentStreak: 4,
    tokenVersion: 2,
    ...overrides,
  });
};

const validUpdate = (user, overrides = {}) => ({
  username: user.username,
  email: user.email,
  newCardsPerDay: user.newCardsPerDay,
  ...overrides,
});

const assertUserUnchanged = async (user) => {
  const savedUser = await User.findById(user._id);

  assert.equal(savedUser.username, user.username);
  assert.equal(savedUser.email, user.email);
  assert.equal(savedUser.newCardsPerDay, user.newCardsPerDay);
  assert.equal(savedUser.password, user.password);
  assert.equal(savedUser.timezone, user.timezone);
  assert.equal(savedUser.currentStreak, user.currentStreak);
  assert.equal(savedUser.tokenVersion, user.tokenVersion);
};

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
  await User.deleteMany({});
});

after(async () => {
  if (mongoose.connection.readyState === 1) {
    await User.deleteMany({});
  }

  await mongoose.disconnect();
});

test('username không phải chuỗi thì 400', async () => {
  const user = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, { username: 1 })),
    {
      name: 'AppError',
      message: 'Dữ liệu cập nhật không hợp lệ.',
      statusCode: 400,
    },
  );

  await assertUserUnchanged(user);
});

test('username toàn khoảng trắng thì 400', async () => {
  const user = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, { username: '   ' })),
    {
      name: 'AppError',
      message: 'Thông tin cập nhật không đầy đủ.',
      statusCode: 400,
    },
  );

  await assertUserUnchanged(user);
});

test('email trùng user khác thì 409', async () => {
  const user = await createProfileUser();
  const otherUser = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, {
      email: otherUser.email.toUpperCase(),
    })),
    {
      name: 'AppError',
      message: 'Email đã tồn tại!',
      statusCode: 409,
    },
  );

  await assertUserUnchanged(user);
});

test('username trùng user khác thì 409', async () => {
  const user = await createProfileUser();
  const otherUser = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, {
      username: otherUser.username,
    })),
    {
      name: 'AppError',
      message: 'Username đã tồn tại!',
      statusCode: 409,
    },
  );

  await assertUserUnchanged(user);
});

test('cập nhật hợp lệ: trim, chữ thường, lưu N, không đụng field khác', async () => {
  const user = await createProfileUser();
  const nextUsername = `  profile-next-${user._id}  `;
  const nextEmail = `  Profile-Next-${user._id}@Example.com  `;

  const result = await updateProfile(user._id, {
    username: nextUsername,
    email: nextEmail,
    newCardsPerDay: '15',
  });

  assert.equal(result.username, nextUsername.trim());
  assert.equal(result.email, nextEmail.trim().toLowerCase());
  assert.equal(result.newCardsPerDay, 15);
  assert.equal(result.timezone, user.timezone);
  assert.equal(result.password, undefined);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.username, nextUsername.trim());
  assert.equal(savedUser.email, nextEmail.trim().toLowerCase());
  assert.equal(savedUser.newCardsPerDay, 15);
  assert.equal(savedUser.password, user.password);
  assert.equal(savedUser.timezone, user.timezone);
  assert.equal(savedUser.currentStreak, user.currentStreak);
  assert.equal(savedUser.tokenVersion, user.tokenVersion);

  const resubmitted = await updateProfile(user._id, {
    username: savedUser.username,
    email: savedUser.email,
    newCardsPerDay: 15,
  });

  assert.equal(resubmitted.username, savedUser.username);
  assert.equal(resubmitted.email, savedUser.email);
  assert.equal(resubmitted.newCardsPerDay, 15);
});

test('newCardsPerDay bằng 0 thì 400', async () => {
  const user = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, { newCardsPerDay: 0 })),
    {
      name: 'AppError',
      message: 'Số thẻ mới mỗi ngày phải từ 1 đến 100.',
      statusCode: 400,
    },
  );

  await assertUserUnchanged(user);
});

test('newCardsPerDay bằng 101 thì 400', async () => {
  const user = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, { newCardsPerDay: 101 })),
    {
      name: 'AppError',
      message: 'Số thẻ mới mỗi ngày phải từ 1 đến 100.',
      statusCode: 400,
    },
  );

  await assertUserUnchanged(user);
});

test('newCardsPerDay không phải số nguyên thì 400', async () => {
  const user = await createProfileUser();

  await assert.rejects(
    () => updateProfile(user._id, validUpdate(user, { newCardsPerDay: 1.5 })),
    {
      name: 'AppError',
      message: 'Số thẻ mới mỗi ngày phải từ 1 đến 100.',
      statusCode: 400,
    },
  );

  await assertUserUnchanged(user);
});

test('newCardsPerDay bằng 1 thì lưu được', async () => {
  const user = await createProfileUser();

  const result = await updateProfile(user._id, validUpdate(user, {
    newCardsPerDay: 1,
  }));

  assert.equal(result.newCardsPerDay, 1);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.newCardsPerDay, 1);
  assert.equal(savedUser.username, user.username);
  assert.equal(savedUser.email, user.email);
});

test('newCardsPerDay bằng 100 thì lưu được', async () => {
  const user = await createProfileUser();

  const result = await updateProfile(user._id, validUpdate(user, {
    newCardsPerDay: 100,
  }));

  assert.equal(result.newCardsPerDay, 100);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.newCardsPerDay, 100);
  assert.equal(savedUser.username, user.username);
  assert.equal(savedUser.email, user.email);
});
