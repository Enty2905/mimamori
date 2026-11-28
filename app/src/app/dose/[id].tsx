import React from 'react';
import {Protected} from '../../core/auth/RoleGuard';
import {DoseScreen} from '../../features/medication/DoseScreen';
export default function DoseRoute() {return <Protected role="ELDERLY"><DoseScreen /></Protected>;}
