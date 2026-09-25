import * as userService from "../service/userService.js"

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

    await userService.resetPassword(token, newPassword);
    return res.status(200).json({
        message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập lại.',
    });
}

export const updateProfile = async (req, res) => {
    const { username, email, newCardsPerDay } = req.body;

    const userId = req.user._id;
    const result = await userService.updateProfile(
        userId,
        { username, email, newCardsPerDay }
    );
    res.status(200).json({
        message: "Cập nhật thông tin thành công",
        user: result,
    })
}

export const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await userService.updatePassword(
        req.user._id,
        currentPassword,
        newPassword
    );
    return res.status(200).json({
        message: 'Cập nhật mật khẩu thành công. Hãy đăng nhập lại.',
    });
}
