/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * ReceptionContext - Centralized state management for Reception Dashboard
 * Reduces prop drilling and simplifies component structure
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ServiceRequest } from '../types/request';

type TabType = 'new' | 'in_progress' | 'completed';

interface ReceptionContextValue {
    // Request State
    requests: ServiceRequest[];
    setRequests: React.Dispatch<React.SetStateAction<ServiceRequest[]>>;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    
    // Tab & Filter State
    currentTab: TabType;
    setCurrentTab: (tab: TabType) => void;
    roomSearchQuery: string;
    setRoomSearchQuery: (query: string) => void;
    selectedType: ServiceRequest['type'] | null;
    setSelectedType: (type: ServiceRequest['type'] | null) => void;
    
    // Modal State
    showCreateModal: boolean;
    setShowCreateModal: (show: boolean) => void;
    selectedRequest: ServiceRequest | null;
    setSelectedRequest: (request: ServiceRequest | null) => void;
    
    // Transfer Modal State
    transferModalOpen: boolean;
    setTransferModalOpen: (open: boolean) => void;
    selectedTransferRequest: ServiceRequest | null;
    setSelectedTransferRequest: (request: ServiceRequest | null) => void;
    targetRoomNumber: string;
    setTargetRoomNumber: (room: string) => void;
    
    // UI State
    showShiftNotes: boolean;
    setShowShiftNotes: (show: boolean) => void;
    showProcurement: boolean;
    setShowProcurement: (show: boolean) => void;
    showSupportTicket: boolean;
    setShowSupportTicket: (show: boolean) => void;
    showLostFound: boolean;
    setShowLostFound: (show: boolean) => void;
    showGeneralInstructions: boolean;
    setShowGeneralInstructions: (show: boolean) => void;
    showWhatsAppModal: boolean;
    setShowWhatsAppModal: (show: boolean) => void;
    showChatInbox: boolean;
    setShowChatInbox: (show: boolean) => void;
    showTeam: boolean;
    setShowTeam: (show: boolean) => void;
    showHistory: boolean;
    setShowHistory: (show: boolean) => void;
    showMobileMenu: boolean;
    setShowMobileMenu: (show: boolean) => void;
    
    // Setup State
    showSetupPrompt: boolean;
    setShowSetupPrompt: (show: boolean) => void;
    hasCompletedSetup: boolean;
    setHasCompletedSetup: (completed: boolean) => void;
    
    // Room & Team State
    rooms: { floor: number; rooms: string[] }[];
    setRooms: React.Dispatch<React.SetStateAction<{ floor: number; rooms: string[] }[]>>;
    activeRoomDetails: Record<string, { guestId: string; guestName: string }>;
    setActiveRoomDetails: React.Dispatch<React.SetStateAction<Record<string, { guestId: string; guestName: string }>>>;
    activeRoomCards: any[]; // ✅ Room Cards from Bellman (for occupancy calculation)
    setActiveRoomCards: React.Dispatch<React.SetStateAction<any[]>>;
    teamMembers: any[];
    setTeamMembers: React.Dispatch<React.SetStateAction<any[]>>;
    roomHistoryRoom: string | null;
    setRoomHistoryRoom: (room: string | null) => void;
    
    // Notification State
    activeNotifications: Set<string>;
    setActiveNotifications: React.Dispatch<React.SetStateAction<Set<string>>>;
    notificationRequest: ServiceRequest | null;
    setNotificationRequest: (request: ServiceRequest | null) => void;
    
    // Location Warning State
    showLocationWarning: boolean;
    setShowLocationWarning: (show: boolean) => void;
    locationWarningData: any;
    setLocationWarningData: (data: any) => void;
    
    // Execution Times (for delayed logic)
    executionTimes: any;
    setExecutionTimes: (times: any) => void;
}

const ReceptionContext = createContext<ReceptionContextValue | undefined>(undefined);

interface ReceptionProviderProps {
    children: ReactNode;
}

export const ReceptionProvider: React.FC<ReceptionProviderProps> = ({ children }) => {
    // Request State
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tab & Filter State
    const [currentTab, setCurrentTab] = useState<TabType>('new');
    const [roomSearchQuery, setRoomSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<ServiceRequest['type'] | null>(null);
    
    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    
    // Transfer Modal State
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [selectedTransferRequest, setSelectedTransferRequest] = useState<ServiceRequest | null>(null);
    const [targetRoomNumber, setTargetRoomNumber] = useState('');
    
    // UI State
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    const [showSupportTicket, setShowSupportTicket] = useState(false);
    const [showLostFound, setShowLostFound] = useState(false);
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [showChatInbox, setShowChatInbox] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    // Setup State
    const [showSetupPrompt, setShowSetupPrompt] = useState(false);
    const [hasCompletedSetup, setHasCompletedSetup] = useState(true);
    
    // Room & Team State
    const [rooms, setRooms] = useState<{ floor: number; rooms: string[] }[]>([]);
    const [activeRoomDetails, setActiveRoomDetails] = useState<Record<string, { guestId: string; guestName: string }>>({});
    const [activeRoomCards, setActiveRoomCards] = useState<any[]>([]); // ✅ Room Cards from Bellman
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [roomHistoryRoom, setRoomHistoryRoom] = useState<string | null>(null);
    
    // Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationRequest, setNotificationRequest] = useState<ServiceRequest | null>(null);
    
    // Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);
    
    // Execution Times
    const [executionTimes, setExecutionTimes] = useState<any>(null);
    
    const value: ReceptionContextValue = {
        // Request State
        requests,
        setRequests,
        loading,
        setLoading,
        
        // Tab & Filter State
        currentTab,
        setCurrentTab,
        roomSearchQuery,
        setRoomSearchQuery,
        selectedType,
        setSelectedType,
        
        // Modal State
        showCreateModal,
        setShowCreateModal,
        selectedRequest,
        setSelectedRequest,
        
        // Transfer Modal State
        transferModalOpen,
        setTransferModalOpen,
        selectedTransferRequest,
        setSelectedTransferRequest,
        targetRoomNumber,
        setTargetRoomNumber,
        
        // UI State
        showShiftNotes,
        setShowShiftNotes,
        showProcurement,
        setShowProcurement,
        showSupportTicket,
        setShowSupportTicket,
        showLostFound,
        setShowLostFound,
        showGeneralInstructions,
        setShowGeneralInstructions,
        showWhatsAppModal,
        setShowWhatsAppModal,
        showChatInbox,
        setShowChatInbox,
        showTeam,
        setShowTeam,
        showHistory,
        setShowHistory,
        showMobileMenu,
        setShowMobileMenu,
        
        // Setup State
        showSetupPrompt,
        setShowSetupPrompt,
        hasCompletedSetup,
        setHasCompletedSetup,
        
        // Room & Team State
        rooms,
        setRooms,
        activeRoomDetails,
        setActiveRoomDetails,
        activeRoomCards,
        setActiveRoomCards,
        teamMembers,
        setTeamMembers,
        roomHistoryRoom,
        setRoomHistoryRoom,
        
        // Notification State
        activeNotifications,
        setActiveNotifications,
        notificationRequest,
        setNotificationRequest,
        
        // Location Warning State
        showLocationWarning,
        setShowLocationWarning,
        locationWarningData,
        setLocationWarningData,
        
        // Execution Times
        executionTimes,
        setExecutionTimes
    };
    
    return (
        <ReceptionContext.Provider value={value}>
            {children}
        </ReceptionContext.Provider>
    );
};

export const useReceptionContext = (): ReceptionContextValue => {
    const context = useContext(ReceptionContext);
    if (!context) {
        throw new Error('useReceptionContext must be used within a ReceptionProvider');
    }
    return context;
};
