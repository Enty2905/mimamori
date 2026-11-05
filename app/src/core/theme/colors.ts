export const colors = {
  // Eldora-inspired Warm Minimalism & Japanese Senior Care Palette
  background: '#F8F5EF',      // Warm cream / soft beige background
  surface: '#FFFEFC',         // Crisp warm white card surface
  surfaceWarm: '#F0ECE1',     // Soft sand / warm neutral container
  surfaceMuted: '#EAE5D9',    // Gentle neutral divider/chip background

  primary: '#456B58',         // Deep Sage Green - Natural, calm, trustworthy
  primaryDark: '#2F4B3C',     // Dark forest sage for pressed/focus states
  primaryLight: '#E6EEE7',    // Soft sage container / active pill background

  secondary: '#8DA896',       // Medium sage accent
  secondaryDark: '#3A5C4A',
  secondaryLight: '#EEF4EF',  // Light herbal cream tint

  accent: '#E6C994',          // Warm Amber / Kohaku sand
  accentDark: '#8F6624',
  accentLight: '#FDF7EB',

  textPrimary: '#26332D',     // Dark Charcoal - High contrast & warm readability
  textSecondary: '#727C75',   // Muted sage-gray metadata
  textMuted: '#9BA39D',       // Soft caption / hint text
  textInverse: '#FFFFFF',

  border: '#E3DDD2',          // Subtle warm cream border
  borderLight: '#EFEBE2',

  // Soft semantic status containers with high-contrast text
  success: '#EDF6F0',         // Soft herbal mint container
  successText: '#326847',     // Deep herbal green
  successBorder: '#C9E5D4',

  warning: '#FEF6EC',         // Soft warm amber container
  warningText: '#995C17',     // Deep amber text
  warningBorder: '#F9DDBE',

  danger: '#FDF0F0',          // Soft rose/crimson container
  dangerText: '#B83232',      // Clear accessible red
  dangerBorder: '#F6C8C8',

  divider: '#EBE6DC',

  // Backward compatibility aliases for existing screens
  cardBorder: '#E3DDD2',
  dangerLight: '#FDF0F0',
  successLight: '#EDF6F0',
  warningLight: '#FEF6EC',
};

export const typography = {
  h1: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: colors.textPrimary,
    lineHeight: 34,
  },
  h2: {
    fontSize: 21,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  bodyLarge: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: colors.textPrimary,
    lineHeight: 25,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    lineHeight: 18,
  },
};

export const shadows = {
  subtle: {
    shadowColor: '#26332D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: '#26332D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#26332D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
};
