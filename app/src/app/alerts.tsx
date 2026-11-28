import React from 'react';
import {Protected} from '../core/auth/RoleGuard';
import {CaregiverAlertsScreen} from '../features/caregiver/CaregiverAlertsScreen';
export default function AlertsRoute() {return <Protected role="CAREGIVER"><CaregiverAlertsScreen /></Protected>;}
