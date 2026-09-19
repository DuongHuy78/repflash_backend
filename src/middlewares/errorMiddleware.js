import { AppError } from "../errors/AppError.js";

export const errorMiddleware = (err, req, res, next) => {
    if(res.headersSent) {
        return next(err);
    }

    // TODO: log đọc
    console.error({
        userId: req.user?._id ?? null,
        path: req.path,
        method: req.method,
        name: err.name,
        statusCode: err.statusCode,
        message: err.message,
    });

    if (err.name === 'CastError') {
        return res.status(400).json({  message: 'Mã không hợp lệ' })
    }

    // gắn mess
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }

    // lỗi của mongo
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
    }

    // cũng lỗi mongo như do trùng unique
    if (err.code === 11000) {
        return res.status(409).json({
        message: 'Username hoặc email đã tồn tại!',
        });
    }

    // Còn lại là hệ thống
    return res.status(500).json({ message: 'Lỗi hệ thống' });
}