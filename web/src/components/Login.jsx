import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

const LOGIN_MUTATION = gql`
  mutation Login($email: String!) {
    login(email: $email) {
      id
      email
    }
  }
`;

const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!) {
    signup(email: $email) {
      id
      email
    }
  }
`;

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [login, { loading: loginLoading, error: loginError }] = useMutation(LOGIN_MUTATION);
  const [signup, { loading: signupLoading, error: signupError }] = useMutation(SIGNUP_MUTATION);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email) return;
    try {
      if (isLogin) {
        const { data } = await login({ variables: { email } });
        if (data?.login) {
          localStorage.setItem('userEmail', data.login.email);
          localStorage.setItem('userId', data.login.id);
          window.location.href = '/todos'; 
        }
      } else {
        const { data } = await signup({ variables: { email } });
        if (data?.signup) {
          localStorage.setItem('userEmail', data.signup.email);
          localStorage.setItem('userId', data.signup.id);
          window.location.href = '/todos'; 
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex justify-center bg-slate-50">
      {/* Professional subtle slate background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200"></div>

      {/* Seamless glass overlay */}
      <div className="absolute inset-0 bg-white/40 backdrop-blur-xl"></div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-[480px] flex flex-col h-full min-h-screen px-8">
        
        <div className="flex justify-between items-center mb-6 mt-4">
          <div className="h-11 w-11" /> {/* Spacer to maintain top padding */}
        </div>

        <div className="flex-1">
          <h1 className="text-[32px] font-bold text-gray-900 mb-3 tracking-tight">
            {isLogin ? 'Welcome Back!' : 'Create Account'}
          </h1>
          <p className="text-gray-500 text-[15px] mb-9 leading-relaxed max-w-[280px]">
            {isLogin 
              ? "Your tasks are waiting. Let's log in to keep up with your productive day."
              : "Join us and start organizing your tasks efficiently today."}
          </p>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-800">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#6236FF] focus:ring-1 focus:ring-[#6236FF] transition-all placeholder:text-gray-400 text-[15px]"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-800">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-4 pr-12 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-[#6236FF] focus:ring-1 focus:ring-[#6236FF] transition-all placeholder:text-gray-400 text-[15px]"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </button>
              </div>
            </div>

            {loginError && isLogin && <p className="text-red-500 text-sm font-medium text-center">{loginError.message.replace('ApolloError: ', '')}</p>}
            {signupError && !isLogin && <p className="text-red-500 text-sm font-medium text-center">{signupError.message.replace('ApolloError: ', '')}</p>}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loginLoading || signupLoading}
                className="w-full bg-[#6236FF] hover:bg-[#5225e5] text-white font-bold py-[18px] rounded-2xl transition-all shadow-lg shadow-[#6236FF]/30 active:scale-[0.98] disabled:opacity-70 text-base"
              >
                {(loginLoading || signupLoading)
                  ? (isLogin ? 'Signing in...' : 'Signing up...') 
                  : (isLogin ? 'Sign In' : 'Sign Up')}
              </button>
            </div>
          </form>

          <div className="flex justify-center mt-8 text-sm">
            <span className="text-gray-500">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#6236FF] font-bold hover:underline ml-1"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
