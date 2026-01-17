# Adora Color Replacement Guide
**Target:** Replace all yellow/gold colors with Adora Turquoise (#40E0D0)

---

## 🎨 COLOR MAPPING TABLE

| Reference Color | Hex Code | Adora Replacement | Usage Context |
|----------------|----------|-------------------|---------------|
| Gold/Yellow Primary | `#FFD700` | `#40E0D0` | Primary buttons, highlights |
| Amber/Orange | `#FFA500` | `#40E0D0` | Secondary accents |
| Light Yellow | `#FFEB3B` | `#40E0D0` | Backgrounds, subtle highlights |
| Dark Gold | `#B8860B` | `#2EC4B6` | Darker variant (if needed) |
| Yellow-50 | `#FFFBEB` | `#E6FFFA` | Light backgrounds |
| Yellow-100 | `#FEF3C7` | `#B2F5EA` | Very light backgrounds |
| Yellow-200 | `#FDE68A` | `#81E6D9` | Light accents |
| Yellow-300 | `#FCD34D` | `#4FD1C7` | Medium accents |
| Yellow-400 | `#FBBF24` | `#40E0D0` | Standard accent |
| Yellow-500 | `#F59E0B` | `#38B2AC` | Primary color |
| Yellow-600 | `#D97706` | `#319795` | Hover states |
| Yellow-700 | `#B45309` | `#2C7A7B` | Active states |
| Yellow-800 | `#92400E` | `#285E61` | Dark variants |
| Yellow-900 | `#78350F` | `#234E52` | Darkest variants |

---

## 🔍 SEARCH PATTERNS

### CSS/Tailwind Classes to Replace
```css
/* Yellow variants */
.yellow-50 → .cyan-50
.yellow-100 → .cyan-100
.yellow-200 → .cyan-200
.yellow-300 → .cyan-300
.yellow-400 → .cyan-400 (or custom turquoise)
.yellow-500 → .cyan-500
.yellow-600 → .cyan-600
.yellow-700 → .cyan-700
.yellow-800 → .cyan-800
.yellow-900 → .cyan-900

/* Gold variants */
.gold → .turquoise
.text-gold → .text-turquoise
.bg-gold → .bg-turquoise
.border-gold → .border-turquoise
```

### Hex Code Replacements
```javascript
// Direct hex replacements
'#FFD700' → '#40E0D0'  // Gold
'#FFA500' → '#40E0D0'  // Orange
'#FFEB3B' → '#40E0D0'  // Light Yellow
'#FBBF24' → '#40E0D0'  // Yellow-400
'#F59E0B' → '#38B2AC'  // Yellow-500
'#D97706' → '#319795'  // Yellow-600
```

### RGB/RGBA Replacements
```css
/* RGB */
rgb(255, 215, 0) → rgb(64, 224, 208)
rgba(255, 215, 0, 0.5) → rgba(64, 224, 208, 0.5)

/* HSL */
hsl(51, 100%, 50%) → hsl(174, 72%, 56%)
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Identify All Yellow Instances
```bash
# Search for yellow color references
grep -r "yellow" src/ --include="*.tsx" --include="*.ts" --include="*.css"
grep -r "#FFD700\|#FFA500\|#FFEB3B\|#FBBF24\|#F59E0B" src/
grep -r "rgb(255, 215, 0)" src/
```

### Step 2: Update Tailwind Config
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        turquoise: {
          50: '#E6FFFA',
          100: '#B2F5EA',
          200: '#81E6D9',
          300: '#4FD1C7',
          400: '#40E0D0', // Primary Adora Turquoise
          500: '#38B2AC',
          600: '#319795',
          700: '#2C7A7B',
          800: '#285E61',
          900: '#234E52',
        },
      },
    },
  },
}
```

### Step 3: Update CSS Variables
```css
/* src/index.css or theme file */
:root {
  --color-turquoise: #40E0D0;
  --color-turquoise-light: #81E6D9;
  --color-turquoise-dark: #2C7A7B;
  
  /* Replace yellow variables */
  --color-primary: var(--color-turquoise);
  --color-accent: var(--color-turquoise);
}
```

### Step 4: Component-by-Component Replacement
1. **Buttons**
   - Primary buttons: `bg-yellow-400` → `bg-turquoise-400`
   - Hover states: `hover:bg-yellow-500` → `hover:bg-turquoise-500`

2. **Icons**
   - Icon colors: `text-yellow-400` → `text-turquoise-400`

3. **Cards**
   - Borders: `border-yellow-200` → `border-turquoise-200`
   - Backgrounds: `bg-yellow-50` → `bg-turquoise-50`

4. **Charts/Graphs**
   - Chart colors: Update chart color arrays
   - Legend colors: Match turquoise palette

5. **Status Indicators**
   - Active states: Use turquoise
   - Highlight states: Use turquoise

---

## ✅ VERIFICATION CHECKLIST

### Visual Verification
- [ ] No yellow colors visible in UI
- [ ] All accents use turquoise
- [ ] Hover states use turquoise variants
- [ ] Active states use turquoise variants
- [ ] Charts/graphs use turquoise palette

### Code Verification
- [ ] No `yellow-*` classes in components
- [ ] No yellow hex codes in code
- [ ] Tailwind config updated
- [ ] CSS variables updated
- [ ] Theme files updated

### Accessibility Verification
- [ ] Contrast ratios meet WCAG AA (4.5:1 for text)
- [ ] Color is not the only indicator (add icons/text)
- [ ] Focus states are visible
- [ ] Colorblind-friendly (test with tools)

---

## 🎯 SPECIFIC COMPONENT UPDATES

### StatCard Component
```tsx
// Before
<div className="bg-yellow-50 border-yellow-200">
  <Icon className="text-yellow-400" />
</div>

// After
<div className="bg-turquoise-50 border-turquoise-200">
  <Icon className="text-turquoise-400" />
</div>
```

### Button Component
```tsx
// Before
<button className="bg-yellow-400 hover:bg-yellow-500">
  Click Me
</button>

// After
<button className="bg-turquoise-400 hover:bg-turquoise-500">
  Click Me
</button>
```

### Chart Colors
```typescript
// Before
const chartColors = ['#FFD700', '#FFA500', '#FFEB3B'];

// After
const chartColors = ['#40E0D0', '#38B2AC', '#81E6D9'];
```

---

## 🔧 AUTOMATED REPLACEMENT SCRIPT

```bash
#!/bin/bash
# replace-yellow-colors.sh

# Replace hex codes
find src/ -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) \
  -exec sed -i 's/#FFD700/#40E0D0/g' {} \;
find src/ -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) \
  -exec sed -i 's/#FFA500/#40E0D0/g' {} \;
find src/ -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) \
  -exec sed -i 's/#FFEB3B/#40E0D0/g' {} \;

# Replace Tailwind classes (be careful with this)
# Manual review recommended after automated replacement
```

---

## 📊 COLOR USAGE MATRIX

| Component | Current Yellow | Turquoise Replacement | Priority |
|-----------|---------------|----------------------|----------|
| Primary Buttons | `yellow-400` | `turquoise-400` | High |
| Icons | `yellow-400` | `turquoise-400` | High |
| Accents | `yellow-300` | `turquoise-300` | High |
| Backgrounds | `yellow-50` | `turquoise-50` | Medium |
| Borders | `yellow-200` | `turquoise-200` | Medium |
| Hover States | `yellow-500` | `turquoise-500` | High |
| Active States | `yellow-600` | `turquoise-600` | High |
| Charts | Various | Turquoise palette | High |

---

**Note:** Always test visual appearance after color replacement to ensure design integrity and accessibility.
