import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useToast();
  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Register form
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  // Registration OTP
  const [otp, setOtp] = useState('');
  // Password reset form
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const redirect = searchParams.get('redirect') || '/';
  // =========================
  // NORMAL EMAIL LOGIN
  // =========================
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const user = res.loggedInUser || res.data?.user || res.data;
      setUser(user);
      showToast('Login successful!', 'success');
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // GOOGLE LOGIN
  // =========================
  const handleGoogleLogin = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const idToken = credentialResponse.credential;
      if (!idToken) {
        throw new Error('Google did not return an ID token');
      }
      const res = await authApi.googleAuth(idToken);
      const user = res.loggedInUser || res.data?.user || res.data;
      setUser(user);
      showToast('Google login successful!', 'success');
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // REGISTER
  // =========================
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (regData.password !== regData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOtp(regData);
      showToast('OTP sent to your email!', 'success');
      setTab('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // VERIFY REGISTRATION OTP
  // =========================
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.verifyOtp(otp);
      showToast('Email verified! Please log in.', 'success');
      setEmail(regData.email);
      setPassword('');
      setOtp('');
      setTab('login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // REQUEST PASSWORD RESET OTP
  // =========================
  const handleRequestPasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const normalizedEmail = resetEmail.trim();
      await authApi.requestPasswordReset(normalizedEmail);
      setResetEmail(normalizedEmail);
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(
        'If an account exists, a password reset OTP has been sent.',
        'success'
      );
      setTab('reset');
    } catch (err) {
      setError(err.message || 'Unable to request password reset');
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // RESET PASSWORD
  // =========================
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must contain at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        email: resetEmail,
        otp: resetOtp,
        newPassword,
        confirmPassword: confirmNewPassword,
      });
      showToast(
        'Password reset successfully! Please log in.',
        'success'
      );
      setEmail(resetEmail);
      setPassword('');
      setResetOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTab('login');
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };
  // =========================
  // OPEN FORGOT PASSWORD
  // =========================
  const openForgotPassword = () => {
    setResetEmail(email);
    setResetOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError('');
    setTab('forgot');
  };
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-900">
            Welcome to IRCTC
          </h1>
          <p className="text-gray-500 mt-2">
            Book train tickets seamlessly
          </p>
        </div>
        <div className="card">
          {/* Tabs */}
          {!['otp', 'forgot', 'reset'].includes(tab) && (
            <div className="flex mb-6 border-b">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'login'
                    ? 'border-primary-900 text-primary-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'register'
                    ? 'border-primary-900 text-primary-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Register
              </button>
            </div>
          )}
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          {/* ================= LOGIN FORM ================= */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <div className="text-right">
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-sm text-primary-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Sign In
              </Button>
              {/* OR Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-sm text-gray-400">
                  OR
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
              {/* Google Login */}
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleLogin}
                  onError={() => {
                    setError('Google login failed. Please try again.');
                  }}
                />
              </div>
            </form>
          )}
          {/* ================= REGISTER FORM ================= */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  value={regData.firstName}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      firstName: e.target.value,
                    })
                  }
                  required
                />
                <Input
                  label="Last Name"
                  value={regData.lastName}
                  onChange={(e) =>
                    setRegData({
                      ...regData,
                      lastName: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={regData.email}
                onChange={(e) =>
                  setRegData({
                    ...regData,
                    email: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Password"
                type="password"
                value={regData.password}
                onChange={(e) =>
                  setRegData({
                    ...regData,
                    password: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                value={regData.confirmPassword}
                onChange={(e) =>
                  setRegData({
                    ...regData,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Create Account
              </Button>
            </form>
          )}
          {/* ================= REGISTRATION OTP ================= */}
          {tab === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-gray-600 mb-2">
                We've sent a verification code to{' '}
                <strong>{regData.email}</strong>
              </p>
              <Input
                label="OTP Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
              />
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Verify OTP
              </Button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className="text-sm text-primary-700 hover:underline w-full text-center"
              >
                Back to register
              </button>
            </form>
          )}
          {/* ================= FORGOT PASSWORD ================= */}
          {tab === 'forgot' && (
            <form
              onSubmit={handleRequestPasswordReset}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-primary-900">
                Forgot Password
              </h2>
              <p className="text-sm text-gray-600">
                Enter your registered email address. If an account exists,
                we'll send you a password reset OTP.
              </p>
              <Input
                label="Registered Email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Send Reset OTP
              </Button>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className="text-sm text-primary-700 hover:underline w-full text-center"
              >
                Back to Login
              </button>
            </form>
          )}
          {/* ================= RESET PASSWORD ================= */}
          {tab === 'reset' && (
            <form
              onSubmit={handleResetPassword}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-primary-900">
                Set New Password
              </h2>
              <p className="text-sm text-gray-600">
                Enter the OTP sent to{' '}
                <strong>{resetEmail}</strong>, then choose your new password.
              </p>
              <Input
                label="OTP Code"
                type="text"
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                required
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <Button
                type="submit"
                loading={loading}
                className="w-full"
              >
                Reset Password
              </Button>
              <button
                type="button"
                onClick={() => {
                  setTab('forgot');
                  setError('');
                }}
                className="text-sm text-primary-700 hover:underline w-full text-center"
              >
                Request a new OTP
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
