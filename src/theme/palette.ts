export type Theme = {
  name: 'light' | 'dark';
  colors: {
    accent: string;
    accentSoft: string;
    backdrop: string;
    background: string;
    border: string;
    input: string;
    mutedText: string;
    onAccent: string;
    placeholder: string;
    preview: string;
    success: string;
    surface: string;
    surfaceSubtle: string;
    text: string;
    warning: string;
  };
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    accent: '#0D7C66',
    accentSoft: '#DDF3EC',
    backdrop: 'rgba(19, 27, 24, 0.42)',
    background: '#F7F9F8',
    border: '#DDE5E1',
    input: '#FFFFFF',
    mutedText: '#6B7772',
    onAccent: '#FFFFFF',
    placeholder: '#93A09A',
    preview: '#EAF0EE',
    success: '#188456',
    surface: '#FFFFFF',
    surfaceSubtle: '#EEF6F2',
    text: '#17201C',
    warning: '#B65E23',
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    accent: '#4FD2B0',
    accentSoft: '#153D35',
    backdrop: 'rgba(0, 0, 0, 0.62)',
    background: '#0D1110',
    border: '#24302C',
    input: '#121918',
    mutedText: '#A0ADA8',
    onAccent: '#061412',
    placeholder: '#76847F',
    preview: '#151F1D',
    success: '#60D294',
    surface: '#151B1A',
    surfaceSubtle: '#111916',
    text: '#EDF4F1',
    warning: '#E7A15F',
  },
};
