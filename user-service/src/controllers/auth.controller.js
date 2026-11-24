const { BadRequestError, UnauthorizedError } = require("../utils/error");
const asyncHandler = require("../utils/asyncHandler");
const { config } = require("../config");
const authService = require("../services/auth.service");
const getDeviceFingerprint = require("../utils/deviceFingerprint");
const isProd = process.env.NODE_ENV === "production";
const cookieOptions = (maxAge) => ({
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge
});
const clearCookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/"
};
// =========================
// REGISTRATION
// =========================
exports.sendOTP = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword
    } = req.body;
    if (
        !firstName ||
        !lastName ||
        !email ||
        !password ||
        !confirmPassword
    ) {
        throw new BadRequestError("All fields are mandatory");
    }
    if (password !== confirmPassword) {
        throw new BadRequestError("Password mismatch");
    }
    if (
        Buffer.byteLength(password, "utf8") < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw new BadRequestError(
            "Password must contain at least 8 characters and cannot exceed 72 bytes."
        );
    }
    const { otpSessionId } = await authService.sendOTP(
        firstName,
        lastName,
        email,
        password
    );
    res.cookie(
        "otp_session",
        otpSessionId,
        cookieOptions(config.OTP_TTL * 1000)
    ).status(200).json({
        success: true,
        message: "OTP sent successfully"
    });
});
exports.verifyOTP = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const otpSessionId = req.cookies.otp_session;
    if (!otp || !otpSessionId) {
        throw new BadRequestError("OTP or OTPSession is missing");
    }
    const user = await authService.verifyOTP(otp, otpSessionId);
    res.clearCookie("otp_session", clearCookieOptions);
    return res.status(201).json({
        success: true,
        message: "User Account created successfully",
        data: user
    });
});
// =========================
// LOGIN
// =========================
exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new BadRequestError("Email and Password are required");
    }
    const deviceId = getDeviceFingerprint(req);
    const {
        accessToken,
        refreshToken,
        loggedInUser
    } = await authService.login(email, password, deviceId);
    res.cookie(
        "accessToken",
        accessToken,
        cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000)
    );
    res.cookie(
        "refreshToken",
        refreshToken,
        cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000)
    );
    return res.status(200).json({
        success: true,
        message: "Logged in successfully",
        loggedInUser
    });
});
// =========================
// FORGOT PASSWORD
// =========================
exports.requestPasswordReset = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
        throw new BadRequestError("Email is required");
    }
    res.clearCookie("password_reset_session", clearCookieOptions);
    const { sessionId } = await authService.requestPasswordReset(email);
    if (sessionId) {
        res.cookie(
            "password_reset_session",
            sessionId,
            cookieOptions(config.OTP_TTL * 1000)
        );
    }
    return res.status(200).json({
        success: true,
        message: "If an account exists for this email, a password reset OTP has been sent."
    });
});
// =========================
// RESET PASSWORD
// =========================
exports.resetPassword = asyncHandler(async (req, res) => {
    const {
        email,
        otp,
        newPassword,
        confirmPassword
    } = req.body;
    const sessionId = req.cookies.password_reset_session;
    if (!email || !otp || !newPassword || !confirmPassword) {
        throw new BadRequestError("All fields are required");
    }
    if (newPassword !== confirmPassword) {
        throw new BadRequestError("Password mismatch");
    }
    if (
        Buffer.byteLength(newPassword, "utf8") < 8 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        throw new BadRequestError(
            "Password must contain at least 8 characters and cannot exceed 72 bytes."
        );
    }
    if (!sessionId) {
        throw new BadRequestError(
            "Password reset session is missing or expired. Request a new OTP."
        );
    }
    await authService.resetPassword(
        email,
        otp,
        newPassword,
        sessionId
    );
    res.clearCookie(
        "password_reset_session",
        clearCookieOptions
    );
    res.clearCookie("accessToken", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);
    return res.status(200).json({
        success: true,
        message: "Password reset successfully. Please sign in with your new password."
    });
});
// =========================
// REFRESH TOKEN
// =========================
exports.rotateRefreshToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new UnauthorizedError(
            "Refresh token is missing",
            "LOGIN AGAIN"
        );
    }
    const deviceId = getDeviceFingerprint(req);
    const {
        newAccessToken,
        newRefreshToken
    } = await authService.rotateRefreshToken(
        refreshToken,
        deviceId
    );
    res.cookie(
        "accessToken",
        newAccessToken,
        cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000)
    );
    res.cookie(
        "refreshToken",
        newRefreshToken,
        cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000)
    );
    return res.status(200).json({
        success: true,
        message: "Access and Refresh token reissued"
    });
});
// =========================
// GOOGLE LOGIN
// =========================
exports.verifyGoogleIdToken = asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) {
        throw new BadRequestError(
            "Invalid Google ID Token",
            "INVALID TOKEN"
        );
    }
    const deviceId = getDeviceFingerprint(req);
    const {
        accessToken,
        refreshToken,
        loggedInUser
    } = await authService.verifyGoogleIdToken(
        idToken,
        deviceId
    );
    res.cookie(
        "accessToken",
        accessToken,
        cookieOptions(config.ACCESS_TOKEN_EXP_SEC * 1000)
    );
    res.cookie(
        "refreshToken",
        refreshToken,
        cookieOptions(config.REFRESH_TOKEN_EXP_SEC * 1000)
    );
    return res.status(200).json({
        success: true,
        message: "Logged in successfully",
        loggedInUser
    });
});
