import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getLocalDateString, getDaysDifference, isPasswordValiable } from '../utils/utlils.js';

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 phút


const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('Thiếu RESEND_API_KEY hoặc MAIL_FROM.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Đặt lại mật khẩu Flashcard App',
      text: [
        'Bạn đã yêu cầu đặt lại mật khẩu Flashcard App.',
        '',
        'Mở liên kết sau để tạo mật khẩu mới:',
        resetUrl,
        '',
        'Liên kết có hiệu lực trong 15 phút và chỉ dùng được một lần.',
        'Nếu không phải bạn yêu cầu, hãy bỏ qua email này.',
      ].join('\n'),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Resend HTTP ${response.status}`);
    error.code = response.status;
    error.responseBody = detail;
    throw error;
  }
};

export const signIn = async (username, password, timezone) => {
    // 1. Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
        throw new Error('Vui lòng nhập đầy đủ tài khoản và mật khẩu!');
    }

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' 
    ) {
      throw new Error('Dữ liệu đăng ký không hợp lệ.');
    }

    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      throw new Error(
        'Vui lòng nhập đầy đủ tài khoản và mật khẩu.',
      );
    }

    // 2. Tìm kiếm User trong Database
    const user = await User.findOne({ username });

    // 3. Nếu không tìm thấy User
    if (!user) {
        throw new Error('Tài khoản không tồn tại!');
    }

    // 4. So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Mật khẩu không chính xác!');
    }

    if (user.status === 'ban') {
        throw new Error("Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ!");
    }

    // 5. (Tùy chọn) Cập nhật thời gian lần cuối đăng nhập
    user.lastLoginAt = new Date();
    if (timezone) user.timezone = timezone;
    await user.save();

    // 6. Trả về thông tin User (Lưu ý: TUYỆT ĐỐI không trả về mật khẩu cho Frontend)
    const { password: userPassword, ...userInfo } = user._doc;
    
    const token = jwt.sign(
        {_id: user.id, role: user.role, tokenVersion: user.tokenVersion ?? 0},
        process.env.JWT_SECRET,
        {expiresIn: '7d'}
    );
    userInfo.token = token;
    
    return userInfo;
};


export const signUp = async (username, password, email, timezone) => {
    if (!username || !password || !email ) {
        throw new Error('Vui lòng nhập đầy đủ thông tin!');
    }

    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      typeof email !== 'string'
    ) {
      throw new Error('Dữ liệu đăng ký không hợp lệ.');
    }

    username = username.trim();

    if(password.length < 8) 
      throw new Error("Mật khẩu không đủ 8 ký tự vui lòng nhập lại!");

    // LƯU Ý: Phải có chữ 'await' vì tìm kiếm trong Database cần thời gian chờ (bất đồng bộ)
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
        throw new Error("Username đã tồn tại. Vui lòng chọn username khác!");
    }    

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
        throw new Error("Email đã tồn tại. Vui lòng chọn Email khác!");
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS));

    const newUser = await User.create({
        username: username,
        password: hashedPassword,
        email: email
    });
    if (timezone) newUser.timezone = timezone;
    await updateStreak(newUser._id);

    // Trả về thông tin user (loại bỏ trường password để bảo mật)
    const { password: userPassword, ...userInfo } = newUser._doc;
    
    return userInfo;
};

/**
 * Lưu ý:
 * Tất nhiên ở các hệ thống tài chính lớn, 
 * người ta vẫn viết API Logout trên Server để nhét cái Token đó 
 * vào một danh sách đen "Blacklist" trong Database. 
 * Nhưng với quy mô app Flashcard, 
 * việc Frontend tự xóa Token đã là quá đủ bảo mật rồi
 */

export const updateStreak = async (userId) => {
  const MILESTONES = [3, 7, 14, 30, 60, 200];

  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  const timeZone = user.timezone || 'Asia/Ho_Chi_Minh';

  // Lấy chuỗi ngày "YYYY-MM-DD" của hôm nay và ngày học gần nhất theo múi giờ của user
  const todayStr = getLocalDateString(now, timeZone);
  const lastStudyStr = getLocalDateString(user.lastStudyDate, timeZone);

  if (!lastStudyStr) {
    // Lần đầu tiên học
    user.currentStreak = 1;
  } else {
    const diffDays = getDaysDifference(lastStudyStr, todayStr);

    if (diffDays === 0) {
      // Hôm nay đã học rồi -> Không tăng streak nữa
      return {
        user,
        newMilestone: null,
      };
    } else if (diffDays === 1) {
      // Học ngày liên tiếp kế tiếp -> Tăng chuỗi
      user.currentStreak += 1;
    } else if (diffDays > 1) {
      // Bị đứt chuỗi (bỏ bẵng > 1 ngày) -> Reset về 1
      user.currentStreak = 1;
    }
  }

  // Cập nhật Kỷ lục chuỗi dài nhất
  if (user.currentStreak > user.longestStreak) {
    user.longestStreak = user.currentStreak;
  }

  // Cập nhật các cột mốc Streak
  let newMilestoneUnlocked = null;

  if(MILESTONES.includes(user.currentStreak)) {
    // Kiểm tra mốc này đã mở khóa trong quá khứ chưa
    if (!user.unlockedMilestones.includes(user.currentStreak)) {
      user.unlockedMilestones.push(user.currentStreak);
      newMilestoneUnlocked = user.currentStreak; // Ghi nhận để báo cho Frontend
    }
  }

  user.lastStudyDate = now;
  await user.save();
  return {
    user,
    newMilestone: newMilestoneUnlocked // Trả về null nếu không đạt mốc mới
  };
};

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-password');
  return user;
};

export const updateProfile = async (userId, updateData) => {

  const username = updateData.username?.trim();
  const email = updateData.email?.trim().toLowerCase();

  const user = await User.findById(userId);

  if(!user) {
    throw new Error("Tài khoản không tồn tại!");
  }

  if(await User.findOne({
    email: email,
    _id: { $ne: userId },
  })) {
    throw new Error("Email đã tồn tại!");
  }

  if(await User.findOne({
    username: username,
    _id: { $ne: userId },
  })) {
    throw new Error("Username đã tồn tại!");
  }

  user.username = username;
  user.email = email;

  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("Username hoặc email đã tồn tại!");
    }
    throw error;
  }
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    timezone: user.timezone,
    updatedAt: user.updatedAt,
  };
}

export const updatePassword = async (userId, currentPassword, newPassword) => {
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new Error('Vui lòng nhập mật khẩu hiện tại.');
  }

  if (!isPasswordValiable(newPassword)) {
    throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error('Tài khoản không tồn tại.');
  }

  const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordCorrect) {
    throw new Error('Mật khẩu hiện tại không đúng.');
  }

  const isReusingCurrentPassword = await bcrypt.compare(newPassword, user.password);
  if (isReusingCurrentPassword) {
    throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_ROUNDS)
  );

  user.password = hashedPassword;
  user.passwordResetExpiresAt = null;
  user.passwordResetTokenHash = null;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;

  try {
    await user.save();
  } catch (error) {
    console.log('UserService: Cập nhật password lỗi', error.message);
    throw new Error('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
  }
};

const createPasswordResetToken = () => {
  // Mỗi byte được biểu diễn bằng hai ký tự hex để dùng an toàn trong URL.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  return {
    rawToken,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
};

export const requestPasswordReset = async (email) => {
  const normalizedEmail = email?.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return;

  const { rawToken, tokenHash, expiresAt } = createPasswordResetToken();


  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();
  

  const resetUrl =
    `${process.env.FRONTEND_URL}/reset-password?token=` +
    encodeURIComponent(rawToken);

  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
    });
  } catch (error) {
    console.error('Reset email failed:', {
      name: error.name,
      code: error.code,
      message: error.message,
      responseBody: error.responseBody,
    });
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    throw new Error('Không thể gửi email đặt lại mật khẩu.');
  }

};

export const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_ROUNDS)
  );

  const user = await User.findOneAndUpdate(
    {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    },
    {
      $set: { password: hashedPassword },
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetExpiresAt: 1,
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );

  if (!user) {
    throw new Error('Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  }

  return user;
};
