const {
    ConflictError,
    BadRequestError,
    ForbiddenError,
    UnauthorizedError
} = require("../utils/error");
const {
    generateAndStoreOtp,
    verifyOtp,
    generatePasswordResetOtp,
    verifyPasswordResetOtp
} = require("../utils/otp");
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require("../utils/auth");
const emailService = require("../services/email.service");
const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");
const { redis } = require("../config/redis");
const { config } = require("../config");
const logger = require("../config/logger");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);
const normalizeEmail = (email) => email.trim().toLowerCase();
const findUserByEmail = async (email) => {
    return prisma.user.findFirst({
        where: {
            email: {
                equals: normalizeEmail(email),
                mode: "insensitive"
            }
        }
    });
};
// =========================
// REGISTRATION OTP
// =========================
const sendOTP = async (firstName, lastName, email, password) => {
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
        throw new ConflictError("user already exists");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const meta = {
        firstName,
        lastName,
        email: normalizedEmail,
        hashedPassword
    };
    const { otp, otpSessionId } = await generateAndStoreOtp(meta);
    await emailService.sendOtpEmail(
        normalizedEmail,
        otp,
        config.OTP_TTL / 60
    );
    logger.info("Registration OTP email queued");
    return { otpSessionId };
};
const verifyOTP = async (otp, otpSessionId) => {
    const meta = await verifyOtp(otp, otpSessionId);
    if (meta === null) {
        throw new BadRequestError(
            "Invalid or expired OTP",
            "OTP_INVALID"
        );
    }
    const user = await prisma.user.create({
        data: {
            firstName: meta.firstName,
            lastName: meta.lastName,
            email: meta.email,
            password: meta.hashedPassword,
            emailVerified: true
        }
    });
    await emailService.sendWelcomeEmail(
        meta.email,
        meta.firstName
    );
    logger.info("Welcome email queued");
    const { password: _password, ...safeUser } = user;
    return safeUser;
};
// =========================
// EMAIL + PASSWORD LOGIN
// =========================
const login = async (email, password, deviceId) => {
    const existingUser = await findUserByEmail(email);
    if (!existingUser) {
        throw new UnauthorizedError(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
        );
    }
    if (!existingUser.password) {
        throw new BadRequestError(
            "This account has no password set. Please sign in with Google or reset your password.",
            "OAUTH_ONLY_ACCOUNT"
        );
    }
    const doesPasswordMatch = await bcrypt.compare(
        password,
        existingUser.password
    );
    if (!doesPasswordMatch) {
        throw new UnauthorizedError(
            "Invalid email or password",
            "INVALID_CREDENTIALS"
        );
    }
    const accessToken = generateAccessToken(existingUser.id);
    const refreshToken = generateRefreshToken(existingUser.id);
    const { jti } = jwt.decode(refreshToken);
    await redis.set(
        `refresh:${existingUser.id}:${deviceId}`,
        jti,
        "EX",
        config.REFRESH_TOKEN_EXP_SEC
    );
    const { password: _password, ...safeUser } = existingUser;
    await redis.set(
        `user:${existingUser.id}`,
        JSON.stringify(safeUser),
        "EX",
        config.REDIS_USER_TTL
    );
    return {
        accessToken,
        refreshToken,
        loggedInUser: safeUser
    };
};
// =========================
// REQUEST PASSWORD RESET
// =========================
const requestPasswordReset = async (email) => {
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByEmail(normalizedEmail);
    // Do not generate OTP for unknown or unverified accounts.
    // The controller will still return a generic response.
    if (!user || !user.emailVerified) {
        return { sessionId: null };
    }
    const { otp, sessionId } =
        await generatePasswordResetOtp(normalizedEmail);
    await emailService.sendPasswordResetOtpEmail(
        normalizedEmail,
        otp,
        config.OTP_TTL / 60
    );
    logger.info("Password reset email queued");
    return { sessionId };
};
// =========================
// RESET PASSWORD
// =========================
const resetPassword = async (
    email,
    otp,
    newPassword,
    sessionId
) => {
    if (
        typeof newPassword !== "string" ||
        newPassword.length < 8 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        throw new BadRequestError(
            "Password must contain at least 8 characters and cannot exceed 72 bytes.",
            "INVALID_PASSWORD"
        );
    }
    if (!sessionId) {
        throw new BadRequestError(
            "Password reset session is missing or expired.",
            "PASSWORD_RESET_SESSION_INVALID"
        );
    }
    const verified = await verifyPasswordResetOtp(
        otp,
        sessionId,
        normalizeEmail(email)
    );
    if (!verified) {
        throw new BadRequestError(
            "Invalid or expired password reset OTP.",
            "PASSWORD_RESET_OTP_INVALID"
        );
    }
    if (normalizeEmail(email) !== verified.email) {
        throw new BadRequestError(
            "Invalid password reset request.",
            "PASSWORD_RESET_EMAIL_MISMATCH"
        );
    }
    const user = await findUserByEmail(verified.email);
    if (!user || !user.emailVerified) {
        throw new BadRequestError(
            "Unable to reset password for this account.",
            "PASSWORD_RESET_FAILED"
        );
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
    });
    // Invalidate all refresh-token sessions for this user.
    let cursor = "0";
    const pattern = `refresh:${user.id}:*`;
    do {
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } while (cursor !== "0");
    // Invalidate cached user profile.
    await redis.del(`user:${user.id}`);
    logger.info("User password reset completed");
    return { success: true };
};
// =========================
// REFRESH TOKEN
// =========================
const rotateRefreshToken = async (refreshToken, deviceId) => {
    const payload = verifyRefreshToken(refreshToken);
    const { id: userId, jti } = payload;
    const storedJti = await redis.get(
        `refresh:${userId}:${deviceId}`
    );
    if (!storedJti) {
        throw new ForbiddenError(
            "Session Expired",
            "LOGIN AGAIN"
        );
    }
    if (storedJti !== jti) {
        await redis.del(`refresh:${userId}:${deviceId}`);
        throw new ForbiddenError(
            "Refresh token reused",
            "LOGIN AGAIN"
        );
    }
    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken(userId);
    const { jti: newJti } = jwt.decode(newRefreshToken);
    await redis.set(
        `refresh:${userId}:${deviceId}`,
        newJti,
        "EX",
        config.REFRESH_TOKEN_EXP_SEC
    );
    return {
        newAccessToken,
        newRefreshToken
    };
};
// =========================
// GOOGLE LOGIN
// =========================
const verifyGoogleIdToken = async (idToken, deviceId) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload.sub || !payload.email) {
        throw new UnauthorizedError(
            "Invalid Google Token Payload"
        );
    }
    const googleUser = {
        provider: "google",
        providerId: payload.sub,
        email: normalizeEmail(payload.email),
        firstName: payload.given_name || "User",
        lastName: payload.family_name || "",
        emailVerified: payload.email_verified || false
    };
    const user = await prisma.$transaction(async (tx) => {
        const googleAuth = await tx.authProvider.findUnique({
            where: {
                provider_providerId: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId
                }
            },
            include: { user: true }
        });
        if (googleAuth) {
            return googleAuth.user;
        }
        const existingUser = await tx.user.findFirst({
            where: {
                email: {
                    equals: googleUser.email,
                    mode: "insensitive"
                }
            }
        });
        if (existingUser) {
            await tx.authProvider.create({
                data: {
                    provider: googleUser.provider,
                    providerId: googleUser.providerId,
                    userId: existingUser.id
                }
            });
            return existingUser;
        }
        return tx.user.create({
            data: {
                email: googleUser.email,
                firstName: googleUser.firstName,
                lastName: googleUser.lastName,
                emailVerified: googleUser.emailVerified,
                AuthProviders: {
                    create: {
                        provider: googleUser.provider,
                        providerId: googleUser.providerId
                    }
                }
            }
        });
    });
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    const { jti } = jwt.decode(refreshToken);
    await redis.set(
        `refresh:${user.id}:${deviceId}`,
        jti,
        "EX",
        config.REFRESH_TOKEN_EXP_SEC
    );
    const { password: _password, ...safeUser } = user;
    await redis.set(
        `user:${user.id}`,
        JSON.stringify(safeUser),
        "EX",
        config.REDIS_USER_TTL
    );
    return {
        accessToken,
        refreshToken,
        loggedInUser: safeUser
    };
};
module.exports = {
    sendOTP,
    verifyOTP,
    login,
    rotateRefreshToken,
    verifyGoogleIdToken,
    requestPasswordReset,
    resetPassword
};
