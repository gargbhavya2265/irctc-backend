const { TooManyRequestsError } = require("./error");
const { config } = require("../config");
const { redis } = require("../config/redis");
const otpGenerator = require("otp-generator");
const crypto = require("crypto");
const RATE_MAX = parseInt(config.OTP_RATE_MAX_PER_HOUR || "5", 10);
const ATTEMPT_MAX = parseInt(config.OTP_MAX_VERIFY_ATTEMPTS || "5", 10);
const OTP_TTL = parseInt(config.OTP_TTL || "300", 10);
const HMAC_SECRET = config.OTP_HMAC_SECRET;
// Atomically checks and reserves an OTP send request.
const RESERVE_SEND_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
    return -1
end
local newCount = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return newCount
`;
// Atomically reserves one verification attempt and reads the OTP session.
const RESERVE_ATTEMPT_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
    return {0}
end
local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
if attempts >= tonumber(ARGV[1]) then
    return {-1}
end
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
return {1, raw}
`;
// Atomically consumes a session only if it has not already been consumed.
const CONSUME_SESSION_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then
    return 0
end
redis.call('DEL', KEYS[1], KEYS[2])
return 1
`;
function hmacFor(email, otp) {
    return crypto
        .createHmac("sha256", HMAC_SECRET)
        .update(email + ":" + otp)
        .digest("hex");
}
function generateOtp() {
    return otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false
    });
}
async function reserveOtpSend(rateKey, message, errorCode) {
    const result = await redis.eval(
        RESERVE_SEND_SCRIPT,
        1,
        rateKey,
        RATE_MAX,
        3600
    );
    if (Number(result) === -1) {
        throw new TooManyRequestsError(message, errorCode);
    }
}
async function reserveOtpAttempt(sessionKey, attemptsKey) {
    const result = await redis.eval(
        RESERVE_ATTEMPT_SCRIPT,
        2,
        sessionKey,
        attemptsKey,
        ATTEMPT_MAX,
        OTP_TTL
    );
    if (Number(result[0]) === 0) {
        return null;
    }
    if (Number(result[0]) === -1) {
        throw new TooManyRequestsError(
            "Too many attempts to verify OTP"
        );
    }
    return result[1];
}
async function consumeOtpSession(sessionKey, attemptsKey, rawData) {
    const consumed = await redis.eval(
        CONSUME_SESSION_SCRIPT,
        2,
        sessionKey,
        attemptsKey,
        rawData
    );
    return Number(consumed) === 1;
}
function safeHashMatch(submittedHash, storedHash) {
    const submittedBuffer = Buffer.from(submittedHash, "hex");
    const storedBuffer = Buffer.from(storedHash || "", "hex");
    if (
        submittedBuffer.length === 0 ||
        submittedBuffer.length !== storedBuffer.length
    ) {
        return false;
    }
    return crypto.timingSafeEqual(submittedBuffer, storedBuffer);
}
// Existing registration OTP generation flow.
async function generateAndStoreOtp(meta) {
    const rateKey = `otp:rate:${meta.email}`;
    await reserveOtpSend(
        rateKey,
        "Too many OTP requests. Try again later.",
        "OTP_RATE_LIMIT"
    );
    const otp = generateOtp();
    const otpSessionId = crypto.randomUUID();
    const hashed = hmacFor(meta.email, otp);
    await redis.set(
        `otp:session:${otpSessionId}`,
        JSON.stringify({ hashedOtp: hashed, meta }),
        "EX",
        OTP_TTL
    );
    return { otp, otpSessionId };
}
async function verifyOtp(otp, otpSessionId) {
    const sessionKey = `otp:session:${otpSessionId}`;
    const rawData = await reserveOtpAttempt(
        sessionKey,
        `otp:attempts:${JSON.parse(
            await redis.get(sessionKey) || "{}"
        ).meta?.email || ""}`
    );
    if (!rawData) return null;
    const { hashedOtp: storedOtp, meta } = JSON.parse(rawData);
    const hashedOtp = hmacFor(meta.email, otp);
    if (!safeHashMatch(hashedOtp, storedOtp)) {
        return null;
    }
    const consumed = await consumeOtpSession(
        sessionKey,
        `otp:attempts:${meta.email}`,
        rawData
    );
    return consumed ? meta : null;
}
// Password-reset OTP generation flow.
async function generatePasswordResetOtp(email) {
    const rateKey = `password-reset:rate:${email}`;
    await reserveOtpSend(
        rateKey,
        "Too many password reset requests. Try again later.",
        "PASSWORD_RESET_RATE_LIMIT"
    );
    const otp = generateOtp();
    const sessionId = crypto.randomUUID();
    const hashedOtp = hmacFor(`password-reset:${email}`, otp);
    await redis.set(
        `password-reset:session:${sessionId}`,
        JSON.stringify({ email, hashedOtp }),
        "EX",
        OTP_TTL
    );
    return { otp, sessionId };
}
async function verifyPasswordResetOtp(otp, sessionId, expectedEmail) {
    const sessionKey = `password-reset:session:${sessionId}`;
    const rawData = await redis.get(sessionKey);
    if (!rawData) return null;
    const { email } = JSON.parse(rawData);
    if (email !== expectedEmail) return null;
    const reservedData = await reserveOtpAttempt(
        sessionKey,
        `password-reset:attempts:${email}`
    );
    if (!reservedData) return null;
    const { hashedOtp: storedOtp } = JSON.parse(reservedData);
    const submittedHash = hmacFor(`password-reset:${email}`, otp);
    if (!safeHashMatch(submittedHash, storedOtp)) {
        return null;
    }
    const consumed = await consumeOtpSession(
        sessionKey,
        `password-reset:attempts:${email}`,
        reservedData
    );
    return consumed ? { email } : null;
}
module.exports = {
    generateAndStoreOtp,
    verifyOtp,
    generatePasswordResetOtp,
    verifyPasswordResetOtp
};
