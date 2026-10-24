import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const bluePrimary = {
  50: '{blue.50}',
  100: '{blue.100}',
  200: '{blue.200}',
  300: '{blue.300}',
  400: '{blue.400}',
  500: '{blue.500}',
  600: '{blue.600}',
  700: '{blue.700}',
  800: '{blue.800}',
  900: '{blue.900}',
  950: '{blue.950}',
  color: 'light-dark({blue.800}, {blue.400})',
  contrastColor: 'light-dark(#ffffff, {surface.950})',
  hoverColor: 'light-dark({blue.900}, {blue.300})',
  activeColor: 'light-dark({blue.950}, {blue.200})',
};

const redPrimary = {
  50: '{red.50}',
  100: '{red.100}',
  200: '{red.200}',
  300: '{red.300}',
  400: '{red.400}',
  500: '{red.500}',
  600: '{red.600}',
  700: '{red.700}',
  800: '{red.800}',
  900: '{red.900}',
  950: '{red.950}',
  color: 'light-dark({red.900}, {red.600})',
  contrastColor: 'light-dark(#ffffff, {surface.950})',
  hoverColor: 'light-dark({red.950}, {red.500})',
  activeColor: 'light-dark({red.950}, {red.700})',
};

export const archiveLightPreset = definePreset(Aura, {
  semantic: {
    primary: redPrimary,
  },
});

export const archiveBluePreset = definePreset(Aura, {
  semantic: {
    primary: bluePrimary,
    surface: {
      50: '{slate.50}',
      100: '{slate.100}',
      200: '{slate.200}',
      300: '{slate.300}',
      400: '{slate.400}',
      500: '{slate.500}',
      600: '{slate.600}',
      700: '{slate.700}',
      800: '{slate.800}',
      900: '{slate.900}',
      950: '{slate.950}',
    },
  },
});

export const archiveGreyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      ...redPrimary,
      color: 'light-dark({red.900}, {red.700})',
      contrastColor: '#ffffff',
      hoverColor: 'light-dark({red.950}, {red.600})',
      activeColor: 'light-dark({red.950}, {red.800})',
    },
    surface: {
      50: 'light-dark({slate.50}, {neutral.50})',
      100: 'light-dark({slate.100}, {neutral.100})',
      200: 'light-dark({slate.200}, {neutral.200})',
      300: 'light-dark({slate.300}, {neutral.300})',
      400: 'light-dark({slate.400}, {neutral.400})',
      500: 'light-dark({slate.500}, {neutral.500})',
      600: 'light-dark({slate.600}, {neutral.600})',
      700: 'light-dark({slate.700}, {neutral.700})',
      800: 'light-dark({slate.800}, {neutral.800})',
      900: 'light-dark({slate.900}, {neutral.900})',
      950: 'light-dark({slate.950}, {neutral.950})',
    },
  },
});
