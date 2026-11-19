const GRANDFATHER_AVATAR_URI =
  'https://images.unsplash.com/photo-1501797362492-608847952c4d?auto=format&fit=crop&w=400&q=80';
const GRANDMOTHER_AVATAR_URI =
  'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=400&q=80';

export const AVATAR_PRESETS = [
  {
    id: 'watering',
    label: 'Cụ bà làm vườn',
    desc: 'Hình cụ bà tưới hoa',
    source: require('../../../assets/images/hero-senior-watering.jpg'),
  },
  {
    id: 'grandfather',
    label: 'Cụ ông phúc hậu',
    desc: 'Hình cụ ông cười ấm áp',
    source: { uri: GRANDFATHER_AVATAR_URI },
  },
  {
    id: 'grandmother',
    label: 'Cụ bà hiền từ',
    desc: 'Hình cụ bà phúc hậu',
    source: { uri: GRANDMOTHER_AVATAR_URI },
  },
  {
    id: 'leaf',
    label: 'Lá Mimamori AI',
    desc: 'Biểu tượng thương hiệu',
    source: require('../../../assets/images/mimamori-leaf-icon.png'),
  },
];

export const getAvatarSource = (avatarUrl?: string | null) => {
  if (!avatarUrl || avatarUrl === 'watering') {
    return require('../../../assets/images/hero-senior-watering.jpg');
  }
  if (avatarUrl === 'leaf') {
    return require('../../../assets/images/mimamori-leaf-icon.png');
  }
  if (avatarUrl === 'grandfather') {
    return { uri: GRANDFATHER_AVATAR_URI };
  }
  if (avatarUrl === 'grandmother') {
    return { uri: GRANDMOTHER_AVATAR_URI };
  }
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return { uri: avatarUrl };
  }
  return require('../../../assets/images/hero-senior-watering.jpg');
};

