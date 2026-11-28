import {z} from 'zod';
export const registrationFields=z.object({username:z.string().trim().min(1).max(50),password:z.string().min(6).max(128),fullName:z.string().trim().min(1).max(100),email:z.email(),role:z.enum(['ELDERLY','CAREGIVER']),phone:z.string().max(30)});
export const loginFields=z.object({username:z.string().trim().min(1),password:z.string().min(1)});
export const profileFields=z.object({fullName:z.string().trim().min(1).max(100),phone:z.string().max(30),emergencyPhone:z.string().max(30),selectedAvatarId:z.string().max(2048)});
