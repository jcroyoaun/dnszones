/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      backgroundColor: {
        'zone-root': 'var(--zone-root)',
        'zone-tld': 'var(--zone-tld)',
        'zone-domain': 'var(--zone-domain)',
        'zone-subdomain': 'var(--zone-subdomain)',
      },
      borderColor: {
        'zone-root-border': 'var(--zone-root-light)',
        'zone-tld-border': 'var(--zone-tld-light)',
        'zone-domain-border': 'var(--zone-domain-light)',
        'zone-subdomain-border': 'var(--zone-subdomain-light)',
      }
    },
  },
  plugins: [],
};