import * as userService from "../service/userService.js"
import { isPasswordValiable } from "../utils/utlils.js";

export const login = async (req , res) => {
    try {
        const { username, password } = req.body;
        const timezone = req.body.timezone || req.body.timeZone;
        const result = await userService.signIn(username, password, timezone);
        res.json(result);
    } catch (error) {
        res.status(500).json("Lỗi khi đăng nhập");
        console.log(error.message);
    }
}

export const register = async (req, res) => {
    try {
        const { username, password, email } = req.body;
        const timezone = req.body.timezone || req.body.timeZone;
        const result = await userService.signUp(username, password, email, timezone);
        res.json(result);
    } catch (error) {
        res.status(500).json("error.message");
        console.log(error.message);
    }
}

export const getProfile = async (req, res) => {
    try {
        const user = await userService.getProfile(req.user._id);
        res.json(user);
    } catch (error) {
        res.status(500).json("Lỗi khi lấy thông tin cá nhân");
        console.log(error.message);
    }
}

export const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        await userService.requestPasswordReset(email);
        res.json({
            message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
        });
    } catch (error) {
        res.status(500).json('Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.');
        console.log(error.message);
    }
}

export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (typeof token !== 'string' || !token) {
            return res.status(400).json({
                message: 'Link đặt lại mật khẩu không hợp lệ.',
            });
        }

        if (!isPasswordValiable(newPassword)) {
            return res.status(400).json({
                message: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
            });
        }
        await userService.resetPassword(token, newPassword);
        return res.status(200).json({
            message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập lại.',
        });
    } catch (error) {
        res.status(400).json('Không thể đặt lại mật khẩu. Vui lòng thử lại sau.');
        console.log(error.message);
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        if(username == "" || email == "" ) {
            throw new Error("Thông tin cập nhật không đầy đủ");
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
    } catch (error) {
        res.status(400).json('Không thể cập nhật thông tin cá nhân. Vui lòng thử lại sau.');
        console.log(error.message);
    }
}

export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (
            typeof currentPassword !== 'string' || !currentPassword ||
            typeof newPassword !== 'string' || !newPassword
        ) {
            return res.status(400).json({
                message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.',
            });
        }

        await userService.updatePassword(
            req.user._id,
            currentPassword,
            newPassword
        );
        return res.status(200).json({
            message: 'Cập nhật mật khẩu thành công. Hãy đăng nhập lại.',
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
        console.log(error.message);
    }
}
