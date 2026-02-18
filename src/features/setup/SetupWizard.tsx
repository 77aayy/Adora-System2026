/**
 * Setup Wizard
 * Initial hotel configuration page
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building,
    Users,
    Bed,
    Package,
    CheckCircle,
    ArrowLeft,
    ArrowRight,
    Plus,
    Trash2,
    Save,
    RefreshCw,
} from 'lucide-react';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logger } from '../../services/loggerService';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';

// ============================================================
// TYPES
// ============================================================

interface SetupStep {
    id: string;
    title: string;
    icon: React.ReactNode;
    completed: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const SetupWizard: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [setupComplete, setSetupComplete] = useState(false);

    // Hotel info
    const [hotelName, setHotelName] = useState('');
    const [branchName, setBranchName] = useState('الفرع الرئيسي');

    // Floors & Rooms
    const [floors, setFloors] = useState<number[]>([1, 2, 3]);
    const [roomsPerFloor, setRoomsPerFloor] = useState(10);

    // Employees
    const [employees, setEmployees] = useState<Array<{
        name: string;
        code: string;
        department: string;
    }>>([
        { name: 'مدير النظام', code: '9999', department: 'admin' },
        { name: 'موظف الاستقبال', code: '1111', department: 'reception' },
        { name: 'موظف الهاوس كيبنج', code: '2222', department: 'housekeeping' },
        { name: 'موظف الصيانة', code: '3333', department: 'maintenance' },
        { name: 'موظف البيلمان', code: '4444', department: 'bellman' },
    ]);

    // Products
    const [products, setProducts] = useState<Array<{
        name: string;
        price: number;
        category: string;
    }>>([
        { name: 'ماء', price: 3, category: 'minibar' },
        { name: 'بيبسي', price: 5, category: 'minibar' },
        { name: 'سبرايت', price: 5, category: 'minibar' },
        { name: 'عصير برتقال', price: 6, category: 'minibar' },
        { name: 'شيبس', price: 7, category: 'minibar' },
        { name: 'شوكولاتة', price: 8, category: 'minibar' },
    ]);

    const steps: SetupStep[] = [
        { id: 'hotel', title: 'معلومات الفندق', icon: <Building className="w-5 h-5" />, completed: !!hotelName },
        { id: 'rooms', title: 'الغرف', icon: <Bed className="w-5 h-5" />, completed: floors.length > 0 },
        { id: 'employees', title: 'الموظفين', icon: <Users className="w-5 h-5" />, completed: employees.length > 0 },
        { id: 'products', title: 'المنتجات', icon: <Package className="w-5 h-5" />, completed: products.length > 0 },
    ];

    // Check if setup already done
    useEffect(() => {
        const checkSetup = async () => {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            if (usersSnapshot.docs.length > 0) {
                setSetupComplete(true);
            }
        };
        checkSetup();
    }, []);

    // Add employee
    const addEmployee = () => {
        setEmployees([...employees, { name: '', code: '', department: 'reception' }]);
    };

    // Remove employee
    const removeEmployee = (index: number) => {
        setEmployees(employees.filter((_, i) => i !== index));
    };

    // Add product
    const addProduct = () => {
        setProducts([...products, { name: '', price: 0, category: 'minibar' }]);
    };

    // Remove product
    const removeProduct = (index: number) => {
        setProducts(products.filter((_, i) => i !== index));
    };

    // Save setup
    const saveSetup = async () => {
        setIsLoading(true);
        try {
            // Save settings
            await addDoc(collection(db, 'settings'), {
                hotelName,
                branchName,
                createdAt: Timestamp.now(),
            });

            // Create rooms
            for (const floor of floors) {
                for (let i = 1; i <= roomsPerFloor; i++) {
                    const roomNumber = `${floor}${i.toString().padStart(2, '0')}`;
                    await addDoc(collection(db, 'rooms'), {
                        number: roomNumber,
                        floor: floor,
                        type: 'standard',
                        status: 'available',
                        currentGuestId: null,
                    });
                }
            }

            // Create employees
            for (const emp of employees) {
                if (emp.name && emp.code) {
                    await addDoc(collection(db, 'users'), {
                        name: emp.name,
                        code: emp.code,
                        department: emp.department,
                        role: emp.department === 'admin' ? 'manager' : 'staff',
                        points: 0,
                        status: 'active',
                    });
                }
            }

            // Create products
            for (const prod of products) {
                if (prod.name && prod.price > 0) {
                    await addDoc(collection(db, 'products'), {
                        name: prod.name,
                        price: prod.price,
                        category: prod.category,
                        stock: 100,
                    });
                }
            }

            setSetupComplete(true);
            navigate('/login');
        } catch (error) {
            logger.error('Setup failed:', error, 'SetupWizard');
        } finally {
            setIsLoading(false);
        }
    };

    // Render step content
    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Hotel Info
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/70 mb-2">اسم الفندق</label>
                            <input
                                type="text"
                                value={hotelName}
                                onChange={(e) => setHotelName(e.target.value)}
                                className="input"
                                placeholder="فندق أدورا"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">اسم الفرع</label>
                            <input
                                type="text"
                                value={branchName}
                                onChange={(e) => setBranchName(e.target.value)}
                                className="input"
                                placeholder="الفرع الرئيسي"
                            />
                        </div>
                    </div>
                );

            case 1: // Rooms
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-white/70 mb-2">عدد الأدوار</label>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setFloors(Array.from({ length: num }, (_, i) => i + 1))}
                                        className={`w-10 h-10 rounded-lg ${floors.length === num
                                                ? 'bg-primary-500 text-white'
                                                : 'glass text-white/60'
                                            }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-white/70 mb-2">عدد الغرف لكل دور</label>
                            <input
                                type="number"
                                value={roomsPerFloor}
                                onChange={(e) => setRoomsPerFloor(Number(e.target.value))}
                                className="input"
                                min={1}
                                max={50}
                            />
                        </div>
                        <div className="p-4 rounded-xl bg-primary-500/20">
                            <p className="text-white">
                                سيتم إنشاء <strong>{floors.length * roomsPerFloor}</strong> غرفة
                            </p>
                        </div>
                    </div>
                );

            case 2: // Employees
                return (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                        {employees.map((emp, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={emp.name}
                                    onChange={(e) => {
                                        const updated = [...employees];
                                        updated[idx].name = e.target.value;
                                        setEmployees(updated);
                                    }}
                                    className="input flex-1"
                                    placeholder="الاسم"
                                />
                                <input
                                    type="text"
                                    value={emp.code}
                                    onChange={(e) => {
                                        const updated = [...employees];
                                        updated[idx].code = e.target.value;
                                        setEmployees(updated);
                                    }}
                                    className="input w-20"
                                    placeholder="PIN"
                                    maxLength={4}
                                />
                                <select
                                    value={emp.department}
                                    onChange={(e) => {
                                        const updated = [...employees];
                                        updated[idx].department = e.target.value;
                                        setEmployees(updated);
                                    }}
                                    className="input w-32"
                                >
                                    <option value="admin">إدارة</option>
                                    <option value="reception">استقبال</option>
                                    <option value="housekeeping">هاوس كيبنج</option>
                                    <option value="maintenance">صيانة</option>
                                    <option value="bellman">بيلمان</option>
                                    <option value="procurement">مشتريات</option>
                                </select>
                                <button
                                    onClick={() => removeEmployee(idx)}
                                    className="w-10 h-10 rounded-lg glass text-red-400 hover:bg-red-500/20"
                                >
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                        ))}
                        <button onClick={addEmployee} className="btn-secondary w-full">
                            <Plus className="w-4 h-4" />
                            إضافة موظف
                        </button>
                    </div>
                );

            case 3: // Products
                return (
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                        {products.map((prod, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={prod.name}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[idx].name = e.target.value;
                                        setProducts(updated);
                                    }}
                                    className="input flex-1"
                                    placeholder="اسم المنتج"
                                />
                                <input
                                    type="number"
                                    value={prod.price}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[idx].price = Number(e.target.value);
                                        setProducts(updated);
                                    }}
                                    className="input w-20"
                                    placeholder="السعر"
                                />
                                <select
                                    value={prod.category}
                                    onChange={(e) => {
                                        const updated = [...products];
                                        updated[idx].category = e.target.value;
                                        setProducts(updated);
                                    }}
                                    className="input w-28"
                                >
                                    <option value="minibar">ميني بار</option>
                                    <option value="amenities">مستلزمات</option>
                                </select>
                                <button
                                    onClick={() => removeProduct(idx)}
                                    className="w-10 h-10 rounded-lg glass text-red-400 hover:bg-red-500/20"
                                >
                                    <Trash2 className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                        ))}
                        <button onClick={addProduct} className="btn-secondary w-full">
                            <Plus className="w-4 h-4" />
                            إضافة منتج
                        </button>
                    </div>
                );

            default:
                return null;
        }
    };

    if (setupComplete) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center p-4">
                <div className="glass rounded-3xl p-8 text-center max-w-md">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">تم الإعداد مسبقاً</h1>
                    <p className="text-white/60 mb-6">النظام جاهز للاستخدام</p>
                    <button onClick={() => navigate('/login')} className="btn-primary w-full">
                        الذهاب لتسجيل الدخول
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen theme-page flex items-center justify-center p-4">
            <div className="glass rounded-3xl p-6 w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-white mb-2">إعداد النظام</h1>
                    <p className="text-white/60">الخطوة {currentStep + 1} من {steps.length}</p>
                </div>

                {/* Steps indicator */}
                <div className="flex justify-center gap-2 mb-6">
                    {steps.map((step, idx) => (
                        <div
                            key={step.id}
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${idx === currentStep
                                    ? 'bg-primary-500 text-white'
                                    : idx < currentStep
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'glass text-white/40'
                                }`}
                        >
                            {idx < currentStep ? <CheckCircle className="w-5 h-5" /> : step.icon}
                        </div>
                    ))}
                </div>

                {/* Current step title */}
                <h2 className="text-xl font-bold text-white text-center mb-4">
                    {steps[currentStep].title}
                </h2>

                {/* Step content */}
                <div className="mb-6">
                    {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="flex gap-3">
                    {currentStep > 0 && (
                        <button
                            onClick={() => setCurrentStep(currentStep - 1)}
                            className="btn-secondary flex-1"
                        >
                            <ArrowRight className="w-5 h-5" />
                            السابق
                        </button>
                    )}
                    {currentStep < steps.length - 1 ? (
                        <button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="btn-primary flex-1"
                        >
                            التالي
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={saveSetup}
                            disabled={isLoading}
                            className="btn-primary flex-1"
                        >
                            {isLoading ? (
                                <AdoraLoaderInline size={20} />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    حفظ وبدء العمل
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SetupWizard;
