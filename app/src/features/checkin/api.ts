import { careApi } from '../../core/api/careApi';
import { queryClient } from '../../core/api/queryClient';

const codes: Record<string, string> = {
  'Rất vui': 'HAPPY', 'Vui vẻ': 'HAPPY', 'Bình thường': 'NORMAL', 'Hơi mệt': 'TIRED',
  'Buồn': 'SAD', 'Buồn bã': 'SAD', 'Khỏe mạnh': 'GOOD', 'Rất khỏe': 'GOOD',
  'Đau nhức': 'PAIN', 'Chóng mặt': 'DIZZY', 'Ngủ rất ngon': 'GOOD',
  'Ngủ ngon': 'GOOD', 'Khó ngủ': 'POOR', 'Mất ngủ': 'INSOMNIA',
  'Ăn rất ngon': 'GOOD', 'Ăn ngon': 'GOOD', 'Chán ăn': 'POOR',
};
export async function submitCheckin(values: {mood: string; physicalHealth: string; sleepQuality: string; appetite: string; notes?: string}) {
  const data = await careApi.submitCheckin({ ...values,
    mood: codes[values.mood] || values.mood,
    physicalHealth: codes[values.physicalHealth] || values.physicalHealth,
    sleepQuality: codes[values.sleepQuality] || values.sleepQuality,
    appetite: codes[values.appetite] || values.appetite,
  });
  await queryClient.invalidateQueries({ queryKey: ['checkin'] });
  await queryClient.invalidateQueries({ queryKey: ['overview'] });
  return { success: true, data };
}
