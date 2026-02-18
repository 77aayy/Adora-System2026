/**
 * Scheduled Task Runner
 * Invisible component that checks for due scheduled tasks and converts them to active requests
 * Should be mounted in a high-level admin component
 */

import React, { useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { ScheduledTask } from '../../features/admin/ScheduledTasksManager';
import { logger } from '../../services/loggerService';

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
                    const taskRef = doc(db!, 'scheduled_tasks', task.id);

                    // 1. Claim task (transaction: only if still active — avoids duplicate from second tab/run)
                    let claimed = false;
                    try {
                        await runTransaction(db!, async (tx) => {
                            const snap = await tx.get(taskRef);
                            if (snap.data()?.status !== 'active') return;
                            tx.update(taskRef, {
                                status: 'processing',
                                processingStartedAt: serverTimestamp()
                            });
                            claimed = true;
                        });
                    } catch (e) {
                        logger.warn('ScheduledTaskRunner: claim failed for task ' + task.id, e, 'ScheduledTaskRunner');
                        return;
                    }
                    if (!claimed) return;

                    try {
                        // 2. Create the actual Request
                        const requestType = mapDeptToType(task.department);
                        const initialDepartment = task.department;
                        await addDoc(collection(db!, `tenants/${tenantId}/requests`), {
                            type: requestType,
                            status: 'NEW',
                            priority: 'normal',
                            source: 'SYSTEM' as any,
                            title: task.title,
                            description: task.description,
                            notes: task.description,
                            branch: task.branchId,
                            tenantId: tenantId,
                            roomNumber: task.targetId || 'GENERAL',
                            guestName: 'System Scheduled',
                            createdAt: serverTimestamp(),
                            createdBy: {
                                id: 'SYSTEM',
                                name: 'Auto Scheduler',
                                department: 'admin'
                            },
                            currentDepartment: initialDepartment,
                            originDepartment: initialDepartment,
                            departmentHistory: [{
                                department: initialDepartment,
                                status: 'NEW',
                                enteredAt: serverTimestamp(),
                                handledBy: { id: 'SYSTEM', name: 'Auto Scheduler' },
                                notes: 'تم إنشاؤه تلقائياً من الجدولة'
                            }]
                        });

                        // 3. Mark task completed or set next run (so it no longer appears in "active" due query)
                        if (task.frequency === 'once') {
                            await updateDoc(taskRef, { status: 'completed' });
                        } else {
                            const nextRun = calculateNextRun(task.nextRun, task.frequency);
                            await updateDoc(taskRef, { nextRun, status: 'active' });
                        }
                    } catch (err) {
                        logger.error('ScheduledTaskRunner: create/update failed for task ' + task.id + ', reverting to active', err, 'ScheduledTaskRunner');
                        try {
                            await updateDoc(taskRef, { status: 'active' });
                        } catch (revertErr) {
                            logger.warn('ScheduledTaskRunner: failed to revert task to active', revertErr, 'ScheduledTaskRunner');
                        }
                        throw err;
                    }
                });

                await Promise.all(batchPromises);
                logger.info('Processed due tasks successfully.', undefined, 'ScheduledTaskRunner');

            } catch (err) {
                logger.error('Error in ScheduledTaskRunner:', err, 'ScheduledTaskRunner');
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
