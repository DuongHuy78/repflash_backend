import * as userService from "../service/userService.js"

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
        res.status(500).json("Lỗi khi đăng ký");
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