import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
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
        
        // 3. Nếu token xịn, lưu thông tin user (đã giải mã) vào req để các file khác dùng
        req.user = decoded;
        
        // 4. BẤM NÚT MỞ CỔNG cho Request đi tiếp vào Controller
        next(); 
    } catch (error) {
        return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
};

export default verifyToken