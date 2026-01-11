import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/api';
import { Layout, Lock, Mail, User, ArrowRight, Loader } from 'lucide-react';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { token, user } = await authService.register(formData.name, formData.email, formData.password);

            // Save to local storage
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            // Redirect to dashboard
            navigate('/dashboard');
        } catch (err) {
            setError(err.formattedMessage || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-primary flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-8 animate-fade-in relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-primary-500 opacity-10 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 rounded-full bg-blue-500 opacity-10 blur-2xl"></div>

                <div className="text-center mb-8 relative z-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/20 text-primary-500 mb-4 shadow-lg border border-primary-500/10">
                        <Layout size={32} />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Create Account</h1>
                    <p className="text-text-secondary mt-2">Join KeWhats Platform today</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm flex items-center gap-2 animate-shake">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary ml-1">Full Name</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                name="name"
                                required
                                className="form-input w-full pl-12 py-3 bg-bg-primary/50 border-white/5 focus:border-primary-500/50 transition-all duration-300 rounded-xl"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary ml-1">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary-500 transition-colors w-5 h-5" />
                            <input
                                type="email"
                                name="email"
                                required
                                className="form-input w-full pl-12 py-3 bg-bg-primary/50 border-white/5 focus:border-primary-500/50 transition-all duration-300 rounded-xl"
                                placeholder="name@company.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-secondary ml-1">Password</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary-500 transition-colors w-5 h-5" />
                            <input
                                type="password"
                                name="password"
                                required
                                className="form-input w-full pl-12 py-3 bg-bg-primary/50 border-white/5 focus:border-primary-500/50 transition-all duration-300 rounded-xl"
                                placeholder="Create a strong password"
                                minLength={6}
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 group hover:scale-[1.02] transition-all duration-300 shadow-lg shadow-primary-500/20"
                    >
                        {loading ? (
                            <Loader className="animate-spin w-5 h-5" />
                        ) : (
                            <>
                                Sign Up
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>

                    <div className="text-center text-sm text-text-secondary">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-500 hover:text-primary-400 font-medium transition-colors hover:underline">
                            Sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Register;
