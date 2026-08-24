import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
    // 1. Lấy chuỗi Token từ Header của Request (Frontend sẽ gửi kèm chữ 'Bearer ')
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Từ chối truy cập. Bạn chưa đăng nhập!" });
    }

    // Lọc bỏ chữ 'Bearer ' để lấy đúng mã token
    const token = authHeader.split(' ')[1];

    try {
        // 2. Dùng jwt để giải mã token xem có hợp lệ/hết hạn chưa
        // Cần truyền vào chữ ký bí mật giống hệt lúc tạo token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded._id).select('tokenVersion status');

        if (!user) {
        return res.status(401).json({
            message: 'Tài khoản không còn tồn tại.',
        });
        }
        // 3. Nếu version token thay đổi thi bắt người dùng đăng nhập lại
        if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({
            message: 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.',
        });
        }
        // 4. Nếu token xịn, lưu thông tin user (đã giải mã) vào req để các file khác dùng
        req.user = decoded;

        // 5. Nếu account bị ban thì không được sử dụng
        if (user.status === 'ban') {
            return res.status(403).json({ 
                message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!" 
            });
        }

        
        // 6. BẤM NÚT MỞ CỔNG cho Request đi tiếp vào Controller
        next(); 
    } catch (error) {
        return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};

export default verifyToken