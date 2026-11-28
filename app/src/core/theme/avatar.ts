const CUTE_GRANDPA_1 = require('../../../assets/images/avatars/cute-grandpa-1.png');
const CUTE_GRANDMA_1 = require('../../../assets/images/avatars/cute-grandma-1.png');
const CUTE_GRANDPA_2 = require('../../../assets/images/avatars/cute-grandpa-2.png');
const CUTE_GRANDMA_2 = require('../../../assets/images/avatars/cute-grandma-2.png');

const CUTE_CAREGIVER_WOMAN_1 = require('../../../assets/images/avatars/cute-caregiver-woman-1.png');
const CUTE_CAREGIVER_MAN_1 = require('../../../assets/images/avatars/cute-caregiver-man-1.png');
const CUTE_CAREGIVER_WOMAN_2 = require('../../../assets/images/avatars/cute-caregiver-woman-2.png');
const CUTE_CAREGIVER_MAN_2 = require('../../../assets/images/avatars/cute-caregiver-man-2.png');

export const AVATAR_PRESETS = [
  {
    id: 'grandfather',
    label: 'Cụ ông hiền hậu',
    desc: 'Cụ ông đeo kính ấm áp',
    source: CUTE_GRANDPA_1,
  },
  {
    id: 'grandmother',
    label: 'Cụ bà phúc hậu',
    desc: 'Cụ bà tóc búi cười tươi',
    source: CUTE_GRANDMA_1,
  },
  {
    id: 'grandpa_cheerful',
    label: 'Cụ ông vui vẻ',
    desc: 'Cụ ông áo gile xanh dương',
    source: CUTE_GRANDPA_2,
  },
  {
    id: 'grandma_gentle',
    label: 'Cụ bà dịu dàng',
    desc: 'Cụ bà đeo kính cầm hoa',
    source: CUTE_GRANDMA_2,
  },
];

export const CAREGIVER_AVATAR_PRESETS = [
  {
    id: 'caregiver_woman_1',
    label: 'Con gái hiền dịu',
    desc: 'Con gái áo len xanh ấm áp',
    source: CUTE_CAREGIVER_WOMAN_1,
  },
  {
    id: 'caregiver_man_1',
    label: 'Con trai điềm đạm',
    desc: 'Con trai áo gile xanh dương',
    source: CUTE_CAREGIVER_MAN_1,
  },
  {
    id: 'caregiver_woman_2',
    label: 'Cháu gái tươi tắn',
    desc: 'Cháu gái đeo kính buộc tóc cao',
    source: CUTE_CAREGIVER_WOMAN_2,
  },
  {
    id: 'caregiver_man_2',
    label: 'Cháu trai thân thiện',
    desc: 'Cháu trai đeo kính áo xanh mint',
    source: CUTE_CAREGIVER_MAN_2,
  },
];

export const getAvatarSource = (avatarUrl?: string | null, role?: string | null) => {
  if (avatarUrl === 'caregiver_woman_1') return CUTE_CAREGIVER_WOMAN_1;
  if (avatarUrl === 'caregiver_man_1') return CUTE_CAREGIVER_MAN_1;
  if (avatarUrl === 'caregiver_woman_2') return CUTE_CAREGIVER_WOMAN_2;
  if (avatarUrl === 'caregiver_man_2') return CUTE_CAREGIVER_MAN_2;

  if (avatarUrl === 'grandfather') return CUTE_GRANDPA_1;
  if (avatarUrl === 'grandmother') return CUTE_GRANDMA_1;
  if (avatarUrl === 'grandpa_cheerful') return CUTE_GRANDPA_2;
  if (avatarUrl === 'grandma_gentle' || avatarUrl === 'watering') return CUTE_GRANDMA_2;

  if (avatarUrl === 'leaf') {
    return role === 'CAREGIVER' ? CUTE_CAREGIVER_WOMAN_1 : CUTE_GRANDMA_1;
  }
  if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
    return { uri: avatarUrl };
  }
  if (role === 'CAREGIVER') {
    return CUTE_CAREGIVER_WOMAN_1;
  }
  return CUTE_GRANDPA_1;
};

