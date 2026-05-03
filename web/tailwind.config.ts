import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      '#060f1c',
        panel:   '#0b1929',
        card:    '#0e1f35',
        card2:   '#0a1b30',
        border:  '#162c45',
        border2: '#1e3a56',
        teal: {
          DEFAULT: '#1fd4c4',
          dim:     '#0f7a72',
          bg:      '#0d2e2c',
        },
        green: {
          DEFAULT: '#aaff45',
          dim:     '#5c9020',
          bg:      '#0f2200',
        },
        amber: {
          DEFAULT: '#ffb84d',
          dim:     '#7a5000',
          bg:      '#1f1400',
        },
        red: {
          DEFAULT: '#ff5f5f',
          bg:      '#1f0a0a',
        },
        txt:  '#d8e8f5',
        txt2: '#6a8aaa',
        txt3: '#3a5a7a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
