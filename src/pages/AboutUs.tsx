/**
 * About Us Page
 * Professional About page for Adora Hotel Management System
 * 
 * Features:
 * - Modern design with Adora Turquoise branding
 * - Clean sections highlighting system features
 * - Adora-specific features (Data Doctor, Tenant Isolation, Physics-based Logic)
 * - Responsive mobile-first design
 * 
 * Adora Hotel Management System V3
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Sparkles,
    Shield,
    Zap,
    Database,
    Brain,
    Lock,
    Users,
    BarChart3,
    TrendingUp,
    Award,
    Globe,
    Heart,
    ArrowRight,
    Home,
    LogIn,
    CheckCircle2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ============================================================
// SECTION COMPONENTS
// ============================================================

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => (
    <section className={`py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 ${className}`}>
        {children}
    </section>
);

const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`max-w-7xl mx-auto ${className}`}>
        {children}
    </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AboutUs: React.FC = () => {
    const { isDark } = useTheme();
    const navigate = useNavigate();

    const turquoise = '#20B2AA';
    const turquoiseLight = 'rgba(32, 178, 170, 0.1)';
    const turquoiseDark = 'rgba(32, 178, 170, 0.2)';

    return (
        <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50'}`}>
            {/* Navigation Bar */}
            <nav className={`sticky top-0 z-50 ${isDark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur-lg border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <Container>
                    <div className="flex items-center justify-between h-16">
                        <Link to="/" className="flex items-center gap-3 group">
                            <img
                                src="/adora-logo.png"
                                alt="Adora"
                                className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                                style={{ filter: `drop-shadow(0 2px 8px ${turquoiseDark})` }}
                            />
                            <span className={`text-xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                                Adora
                            </span>
                        </Link>
                        <div className="flex items-center gap-4">
                            <Link
                                to="/login"
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                                    isDark
                                        ? 'text-slate-300 hover:text-teal-400 hover:bg-slate-800'
                                        : 'text-slate-700 hover:text-teal-600 hover:bg-teal-50'
                                }`}
                            >
                                <LogIn className="w-4 h-4" />
                                تسجيل الدخول
                            </Link>
                            <Link
                                to="/"
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                                    isDark
                                        ? 'bg-teal-600 text-white hover:bg-teal-500'
                                        : 'bg-teal-600 text-white hover:bg-teal-500'
                                }`}
                            >
                                <Home className="w-4 h-4" />
                                الصفحة الرئيسية
                            </Link>
                        </div>
                    </div>
                </Container>
            </nav>

            {/* Hero Section */}
            <Section className={`${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50'}`}>
                <Container>
                    <div className="text-center space-y-6">
                        <div className="inline-block p-4 rounded-2xl mb-4" style={{ backgroundColor: turquoiseLight }}>
                            <Sparkles className="w-12 h-12" style={{ color: turquoise }} />
                        </div>
                        <h1 className={`text-4xl sm:text-5xl md:text-6xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            نظام <span style={{ color: turquoise }}>أدورا</span> لإدارة الفنادق
                        </h1>
                        <p className={`text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            نظام ذكي ومتكامل لإدارة الفنادق مبني على أحدث التقنيات
                            <br />
                            مع <span style={{ color: turquoise, fontWeight: '600' }}>Physics-based Logic</span> لضمان السرعة والدقة
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 flex items-center gap-2 hover:scale-105 shadow-lg"
                                style={{ backgroundColor: turquoise }}
                            >
                                ابدأ الآن
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate('/demo')}
                                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 border-2 ${
                                    isDark
                                        ? 'border-teal-600 text-teal-400 hover:bg-slate-800'
                                        : 'border-teal-600 text-teal-600 hover:bg-teal-50'
                                }`}
                            >
                                تجربة العرض
                            </button>
                        </div>
                    </div>
                </Container>
            </Section>

            {/* Features Section */}
            <Section className={isDark ? 'bg-slate-900' : 'bg-white'}>
                <Container>
                    <div className="text-center mb-12">
                        <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            مميزات <span style={{ color: turquoise }}>أدورا</span>
                        </h2>
                        <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            نظام شامل لإدارة جميع جوانب الفندق بكفاءة عالية
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Feature 1: Data Doctor */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Brain className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Data Doctor 🏥
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                نظام ذكي للتحقق التلقائي من سلامة البيانات وإصلاحها تلقائياً مع تحليل Trends للتنبؤ بالمشاكل قبل حدوثها
                            </p>
                        </div>

                        {/* Feature 2: Tenant Isolation */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Shield className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Tenant Isolation 🔒
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                عزل كامل للبيانات لكل مستأجر مع Role-based Access Control (RBAC) لضمان أقصى مستوى من الأمان
                            </p>
                        </div>

                        {/* Feature 3: Physics-based Logic */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Zap className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Physics-based Logic ⚡
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                منطق مبني على معادلات فيزيائية لحساب السرعة والدقة والتنبؤ بالأداء مع كشف الأنماط المشبوهة
                            </p>
                        </div>

                        {/* Feature 4: Real-time Updates */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Zap className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                تحديثات لحظية ⚡
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                جميع التحديثات تظهر لحظياً على جميع الأجهزة بدون الحاجة لعمل Refresh
                            </p>
                        </div>

                        {/* Feature 5: Atomic Transactions */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Database className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Atomic Transactions 🔐
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                جميع العمليات الحرجة محمية بـ Transactions لمنع Race Conditions وضمان سلامة البيانات
                            </p>
                        </div>

                        {/* Feature 6: Analytics & Insights */}
                        <div
                            className={`p-6 rounded-xl transition-all duration-300 hover:scale-105 ${
                                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-lg'
                            }`}
                        >
                            <div className="w-12 h-12 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <BarChart3 className="w-6 h-6" style={{ color: turquoise }} />
                            </div>
                            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                تحليلات ذكية 📊
                            </h3>
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                تقارير شاملة مع Trends وتحليلات للتنبؤ بالأداء واتخاذ القرارات المستنيرة
                            </p>
                        </div>
                    </div>
                </Container>
            </Section>

            {/* Tech Stack Section */}
            <Section className={isDark ? 'bg-slate-800' : 'bg-slate-50'}>
                <Container>
                    <div className="text-center mb-12">
                        <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            التقنيات المستخدمة
                        </h2>
                        <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            مبني بأحدث التقنيات لضمان الأداء والأمان
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { name: 'React 18', icon: '⚛️' },
                            { name: 'TypeScript', icon: '📘' },
                            { name: 'Firebase v10', icon: '🔥' },
                            { name: 'Tailwind CSS', icon: '🎨' },
                            { name: 'Vite', icon: '⚡' },
                            { name: 'PWA Ready', icon: '📱' },
                            { name: 'Real-time', icon: '🔄' },
                            { name: 'Multi-tenant', icon: '🌐' }
                        ].map((tech, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded-lg text-center transition-all duration-300 hover:scale-105 ${
                                    isDark ? 'bg-slate-700' : 'bg-white shadow-md'
                                }`}
                            >
                                <div className="text-3xl mb-2">{tech.icon}</div>
                                <div className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {tech.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </Container>
            </Section>

            {/* Security Section */}
            <Section className={isDark ? 'bg-slate-900' : 'bg-white'}>
                <Container>
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12">
                            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: turquoiseLight }}>
                                <Lock className="w-8 h-8" style={{ color: turquoise }} />
                            </div>
                            <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                الأمان أولاً 🔐
                            </h2>
                            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                نظام محمي بأقصى معايير الأمان
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { title: 'Tenant Isolation', desc: 'عزل كامل للبيانات لكل مستأجر' },
                                { title: 'RBAC', desc: 'Role-based Access Control في كل المستويات' },
                                { title: 'Encrypted Tokens', desc: 'QR Tokens مشفرة وآمنة للضيوف' },
                                { title: 'Atomic Operations', desc: 'جميع العمليات الحرجة محمية بـ Transactions' },
                                { title: 'Audit Logs', desc: 'سجلات شاملة لكل العمليات الحساسة' },
                                { title: 'Real-time Monitoring', desc: 'مراقبة فورية لكشف أي نشاط مشبوه' }
                            ].map((item, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-lg flex items-start gap-3 ${
                                        isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                                    }`}
                                >
                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: turquoise }} />
                                    <div>
                                        <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {item.title}
                                        </h3>
                                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </Container>
            </Section>

            {/* CTA Section */}
            <Section className={`${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-teal-600 via-cyan-600 to-teal-500'}`}>
                <Container>
                    <div className="text-center space-y-6 max-w-3xl mx-auto">
                        <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-white'}`}>
                            جاهز للبدء؟
                        </h2>
                        <p className={`text-lg sm:text-xl ${isDark ? 'text-slate-300' : 'text-white/90'}`}>
                            انضم إلى الفنادق التي تثق بنظام أدورا لإدارة عملياتها
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                            <button
                                onClick={() => navigate('/login')}
                                className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 shadow-xl ${
                                    isDark
                                        ? 'bg-white text-teal-600 hover:bg-teal-50'
                                        : 'bg-white text-teal-600 hover:bg-teal-50'
                                }`}
                            >
                                ابدأ الآن
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate('/demo')}
                                className="px-8 py-4 rounded-lg font-semibold text-lg text-white border-2 border-white/30 hover:bg-white/10 transition-all duration-300 flex items-center gap-2"
                            >
                                تجربة العرض
                            </button>
                        </div>
                    </div>
                </Container>
            </Section>

            {/* Footer */}
            <footer className={`py-8 px-4 ${isDark ? 'bg-slate-950 border-t border-slate-800' : 'bg-slate-100 border-t border-slate-200'}`}>
                <Container>
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                            <Heart className="w-5 h-5" style={{ color: turquoise }} />
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                بني بـ ❤️ لتحسين تجربة إدارة الفنادق
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-sm">
                            <Link
                                to="/"
                                className={isDark ? 'text-slate-400 hover:text-teal-400' : 'text-slate-600 hover:text-teal-600'}
                            >
                                الصفحة الرئيسية
                            </Link>
                            <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                            <Link
                                to="/about"
                                className={isDark ? 'text-teal-400' : 'text-teal-600'}
                            >
                                من نحن
                            </Link>
                            <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                            <Link
                                to="/demo"
                                className={isDark ? 'text-slate-400 hover:text-teal-400' : 'text-slate-600 hover:text-teal-600'}
                            >
                                تجربة العرض
                            </Link>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            © {new Date().getFullYear()} Adora Hotel Management System. جميع الحقوق محفوظة.
                        </p>
                    </div>
                </Container>
            </footer>
        </div>
    );
};

export default AboutUs;
