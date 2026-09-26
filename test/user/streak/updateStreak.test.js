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
import { updateStreak } from '../../../src/service/userService.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

dotenv.config({
  path: path.resolve(currentDirectory, '../../../../.env'),
});

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const createStreakUser = async (overrides = {}) => {
  const uniqueId = new mongoose.Types.ObjectId().toString();

  return User.create({
    username: `streak-user-${uniqueId}`,
    email: `streak-${uniqueId}@example.com`,
    password: 'test-password',
    timezone: 'Asia/Ho_Chi_Minh',
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    unlockedMilestones: [],
    ...overrides,
  });
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

test('lần đầu học đặt streak = 1 và chưa có mốc', async () => {
  const user = await createStreakUser();

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 1);
  assert.equal(result.user.longestStreak, 1);
  assert.equal(result.newMilestone, null);
  assert.ok(result.user.lastStudyDate);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 1);
  assert.equal(savedUser.longestStreak, 1);
  assert.deepEqual([...savedUser.unlockedMilestones], []);
  assert.ok(savedUser.lastStudyDate);
});

test('học lại trong cùng ngày không tăng streak', async () => {
  const lastStudyDate = new Date();
  const user = await createStreakUser({
    currentStreak: 3,
    longestStreak: 3,
    lastStudyDate,
    unlockedMilestones: [3],
  });

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 3);
  assert.equal(result.newMilestone, null);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 3);
  assert.equal(savedUser.longestStreak, 3);
  assert.equal(
    savedUser.lastStudyDate.getTime(),
    lastStudyDate.getTime(),
  );
  assert.deepEqual([...savedUser.unlockedMilestones], [3]);
});

test('học ngày kế từ streak 1 tăng thành 2, không mở mốc', async () => {
  const user = await createStreakUser({
    currentStreak: 1,
    longestStreak: 1,
    lastStudyDate: daysAgo(1),
  });

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 2);
  assert.equal(result.user.longestStreak, 2);
  assert.equal(result.newMilestone, null);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 2);
  assert.equal(savedUser.longestStreak, 2);
  assert.deepEqual([...savedUser.unlockedMilestones], []);
});

test('học ngày kế từ streak 2 tăng thành 3 và mở mốc 3', async () => {
  const user = await createStreakUser({
    currentStreak: 2,
    longestStreak: 2,
    lastStudyDate: daysAgo(1),
  });

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 3);
  assert.equal(result.user.longestStreak, 3);
  assert.equal(result.newMilestone, 3);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 3);
  assert.equal(savedUser.longestStreak, 3);
  assert.deepEqual([...savedUser.unlockedMilestones], [3]);
});

test('học ngày kế khi đã có mốc 3 không mở lại mốc', async () => {
  const user = await createStreakUser({
    currentStreak: 3,
    longestStreak: 3,
    lastStudyDate: daysAgo(1),
    unlockedMilestones: [3],
  });

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 4);
  assert.equal(result.user.longestStreak, 4);
  assert.equal(result.newMilestone, null);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 4);
  assert.equal(savedUser.longestStreak, 4);
  assert.deepEqual([...savedUser.unlockedMilestones], [3]);
});

test('bỏ bẵng hơn 1 ngày reset streak về 1, giữ longest', async () => {
  const user = await createStreakUser({
    currentStreak: 5,
    longestStreak: 5,
    lastStudyDate: daysAgo(3),
    unlockedMilestones: [3],
  });

  const result = await updateStreak(user._id);

  assert.equal(result.user.currentStreak, 1);
  assert.equal(result.user.longestStreak, 5);
  assert.equal(result.newMilestone, null);

  const savedUser = await User.findById(user._id);
  assert.equal(savedUser.currentStreak, 1);
  assert.equal(savedUser.longestStreak, 5);
  assert.deepEqual([...savedUser.unlockedMilestones], [3]);
});
