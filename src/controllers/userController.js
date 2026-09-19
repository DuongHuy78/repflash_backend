import * as userService from "../service/userService.js"
import { AppError } from "../errors/AppError.js";
import { isPasswordValiable } from "../utils/utlils.js";

export const login = async (req , res) => {
    const { username, password } = req.body;
    const timezone = req.body.timezone || req.body.timeZone;
    const result = await userService.signIn(username, password, timezone);
    res.json(result);
}

export const register = async (req, res) => {
    const { username, password, email } = req.body;
    const timezone = req.body.timezone || req.body.timeZone;
    const result = await userService.signUp(username, password, email, timezone);
    res.json(result);
}

export const getProfile = async (req, res) => {
    const user = await userService.getProfile(req.user._id);
    res.json(user);
}

export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    await userService.requestPasswordReset(email);
    res.json({
        message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
    });
}

export const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (typeof token !== 'string' || !token) {
        throw new AppError('Link đặt lại mật khẩu không hợp lệ.', 400);
    }

    if (!isPasswordValiable(newPassword)) {
        throw new AppError('Mật khẩu mới phải có ít nhất 8 ký tự.', 400);
    }
    await userService.resetPassword(token, newPassword);
    return res.status(200).json({
        message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập lại.',
    });
}

export const updateProfile = async (req, res) => {
    const { username, email } = req.body;
    if(username == "" || email == "" ) {
        throw new AppError("Thông tin cập nhật không đầy đủ", 400);
    }

    const userId = req.user._id;
    const result = await userService.updateProfile(
        req.user._id,
        { username, email }
    );
    res.status(200).json({
        message: "Cập nhật thông tin thành công",
        user: result,
    })
}

export const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (
        typeof currentPassword !== 'string' || !currentPassword ||
        typeof newPassword !== 'string' || !newPassword
    ) {
        throw new AppError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.', 400);
    }

    await userService.updatePassword(
        req.user._id,
        currentPassword,
        newPassword
    );
    return res.status(200).json({
        message: 'Cập nhật mật khẩu thành công. Hãy đăng nhập lại.',
    });
}
