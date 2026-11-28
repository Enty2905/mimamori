import React from 'react';
import {Protected} from '../core/auth/RoleGuard';
import {MainShell} from '../features/navigation/MainShell';
export default function MedicationRoute(){return <Protected><MainShell initialElderlyTab="medication" initialCaregiverTab="medication" /></Protected>;}
