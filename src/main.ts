import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import ToastService from 'primevue/toastservice'

// Custom preset aligned with SAP Fiori / UI5 visual style
// Reference: https://experience.sap.com/fiori-design-web/theming/
const FioriPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '4px',        // --sapElement_BorderCornerRadius (0.25rem)
      md: '8px',        // --sapField_BorderCornerRadius (0.5rem)
      lg: '12px',
      xl: '16px'
    }
  },
  semantic: {
    primary: {
      50: '#e8f1fd',
      100: '#c5dcfa',
      200: '#9ec5f7',
      300: '#74adf3',
      400: '#4f99f0',
      500: '#0070f2',   // --sapBrandColor / --sapHighlightColor
      600: '#0063d6',
      700: '#0054b8',
      800: '#00449a',
      900: '#003580',
      950: '#002562'
    },
    colorScheme: {
      light: {
        primary: {
          color: '#0070f2',
          contrastColor: '#ffffff',
          hoverColor: '#0063d6',
          activeColor: '#0054b8'
        },
        highlight: {
          background: '#ebf5fe',     // --sapSelectedColor light bg
          focusBackground: '#dcebfd',
          color: '#0070f2',
          focusColor: '#0054b8'
        },
        surface: {
          0: '#ffffff',              // --sapBaseColor
          50: '#f7f7f8',             // --sapBackgroundColor
          100: '#edeff0',            // --sapGroup_ContentBackground
          200: '#d9d9d9',            // --sapGroup_ContentBorderColor
          300: '#bfbfbf',
          400: '#a6a6a6',
          500: '#8c8c8c',
          600: '#6a6d70',            // --sapNeutralColor
          700: '#515559',
          800: '#32363a',            // --sapTextColor
          900: '#1d2d3e',
          950: '#12171c'
        }
      }
    },
    fontFamily: "'72', '72full', Arial, Helvetica, sans-serif",
    fontSize: '0.875rem',            // --sapFontSize (14px)
    fontWeight: '400',
    transitionDuration: '0.2s'
  },
  components: {
    toast: {
      success: {
        borderColor: '#256f3a',      // --sapPositiveColor
        color: '#256f3a',
      },
      warn: {
        borderColor: '#e76500',      // --sapCriticalColor
        color: '#e76500',
      },
      error: {
        borderColor: '#aa0808',      // --sapNegativeColor
        color: '#aa0808',
      },
      info: {
        borderColor: '#0070f2',      // --sapInformativeColor
        color: '#0070f2',
      }
    }
  }
})

const app = createApp(App)

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: FioriPreset,
    options: {
      darkModeSelector: false,   // no dark mode (Fiori is light-only)
    }
  }
})
app.use(ToastService)

app.mount('#app')
