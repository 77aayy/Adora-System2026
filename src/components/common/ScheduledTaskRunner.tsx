/**
 * Scheduled Task Runner
 * Invisible component that checks for due scheduled tasks and converts them to active requests
 * Should be mounted in a high-level admin component
 */

import React, { useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { ScheduledTask } from '../../features/admin/ScheduledTasksManager';

export const ScheduledTaskRunner: React.FC = () => {
    const { user, branchId, tenantId } = useAuth(); // ✅ Use branchId and tenantId from context

    useEffect(() => {
        if (!branchId || !tenantId) return; // ✅ Require both branchId and tenantId

        const checkDueTasks = async () => {
            if (!db) return;
            try {
                // Query tasks that are due (nextRun <= now)
                const now = Timestamp.now();
                const q = query(
                    collection(db, 'scheduled_tasks'),
                    where('tenantId', '==', tenantId), // ✅ SaaS: Filter by tenantId
                    where('branchId', '==', branchId),
                    where('status', '==', 'active'),
                    where('nextRun', '<=', now)
                );

                const snapshot = await getDocs(q);

                if (snapshot.empty) return;

                console.log(`Found ${snapshot.size} due tasks. Processing...`);

                const batchPromises = snapshot.docs.map(async (taskDoc) => {
                    const task = { id: taskDoc.id, ...taskDoc.data() } as ScheduledTask;

                    // 1. Create the actual Request
                    const requestType = mapDeptToType(task.department);
                    const initialDepartment = task.department; // ✅ Map department correctly
                    
                    await addDoc(collection(db!, 'requests'), {
                        type: requestType,
                        status: 'PENDING_RECEPTION', // Start as PENDING_RECEPTION, will be routed to department
                        priority: 'normal',
                        source: 'SYSTEM' as any,
                        title: task.title,
                        description: task.description, // Mapped to notes or details
                        notes: task.description,
                        branch: task.branchId,
                        tenantId: tenantId, // ✅ SaaS: Add tenantId
                        roomNumber: task.targetId || 'GENERAL', // Default if no target
                        guestName: 'System Scheduled',
                        createdAt: serverTimestamp(),
                        createdBy: {
                            id: 'SYSTEM',
                            name: 'Auto Scheduler',
                            department: 'admin'
                        },
                        // ✅ Request Journey Tracking
                        currentDepartment: initialDepartment,
                        originDepartment: initialDepartment,
                        departmentHistory: [{
                            department: initialDepartment,
                            status: 'PENDING_RECEPTION',
                            enteredAt: serverTimestamp(),
                            handledBy: {
                                id: 'SYSTEM',
                                name: 'Auto Scheduler'
                            },
                            notes: 'تم إنشاؤه تلقائياً من الجدولة'
                        }]
                    });

                    // 2. Handle Recurring Logic
                    if (task.frequency === 'once') {
                        // Mark as completed
                        await updateDoc(doc(db!, 'scheduled_tasks', task.id), {
                            status: 'completed'
                        });
                    } else {
                        // Calculate next run
                        const nextRun = calculateNextRun(task.nextRun, task.frequency);
                        await updateDoc(doc(db!, 'scheduled_tasks', task.id), {
                            nextRun: nextRun
                        });
                    }
                });

                await Promise.all(batchPromises);
                console.log('Processed due tasks successfully.');

            } catch (err) {
                console.error('Error in ScheduledTaskRunner:', err);
            }
        };

        // Run check immediately and then every minute
        checkDueTasks();
        const interval = setInterval(checkDueTasks, 60000);

        return () => clearInterval(interval);
    }, [branchId, tenantId]); // ✅ Include tenantId in dependencies

    return null; // Invisible component
};

// Helpers
const mapDeptToType = (dept: string): string => {
    const map: Record<string, string> = {
        housekeeping: 'cleaning',
        maintenance: 'maintenance',
        reception: 'other', // Or specific reception type
        bellman: 'bellman',
        procurement: 'other' // Procurement usually separate flow
    };
    return map[dept] || 'other';
};

const calculateNextRun = (currentRun: Timestamp, freq: string): Timestamp => {
    const date = currentRun.toDate();
    if (freq === 'daily') date.setDate(date.getDate() + 1);
    else if (freq === 'weekly') date.setDate(date.getDate() + 7);
    else if (freq === 'monthly') date.setMonth(date.getMonth() + 1);

    return Timestamp.fromDate(date);
};
