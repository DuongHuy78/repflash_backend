import User from '../models/User.js'; 
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getLocalDateString, getDaysDifference } from '../utils/utlils.js';

export const signIn = async (username, password, timezone) => {
    console.log("Đã vào signin backendddd");
    // 1. Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
        throw new Error('Vui lòng nhập đầy đủ tài khoản và mật khẩu');
    }

    // 2. Tìm kiếm User trong Database
    const user = await User.findOne({ username });

    // 3. Nếu không tìm thấy User
    if (!user) {
        throw new Error('Tài khoản không tồn tại');
    }

    // 4. So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Mật khẩu không chính xác');
    }

    // 5. (Tùy chọn) Cập nhật thời gian lần cuối đăng nhập
    user.lastLoginAt = new Date();
    if (timezone) user.timezone = timezone;
    await updateStreak(user._id);
    await user.save();

    // 6. Trả về thông tin User (Lưu ý: TUYỆT ĐỐI không trả về mật khẩu cho Frontend)
    const { password: userPassword, ...userInfo } = user._doc;
    
    const token = jwt.sign(
        {_id: user.id, role: user.role},
        process.env.JWT_SECRET,
        {expiresIn: '7d'}
    );
    userInfo.token = token;
    
    return userInfo;
};


export const signUp = async (username, password, email, timezone) => {
    if (!username || !password || !email ) {
        throw new Error('Vui lòng nhập đầy đủ thông tin');
    }

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
    await newUser.save();
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