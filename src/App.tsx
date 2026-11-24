import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Home,
  BookOpen,
  Plus,
  Lock,
  Unlock,
  Wallet,
  Smartphone,
  ArrowLeftRight,
  Sparkles,
  Copy,
  Check,
  Download,
  Upload,
  Trash2,
  ChevronDown,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  ShoppingBag,
  HeartHandshake,
  RefreshCw,
  X,
  PlusCircle,
  FileSpreadsheet,
  RotateCcw,
  Info,
  History,
  Filter,
  Settings,
  Sun,
  Moon,
  User,
  Bell,
  Database
} from 'lucide-react';

/**
 * ============================================================================
 * SANTRIFLOW LOCAL - 100% OFFLINE-FIRST & NOTEBOOK-FRIENDLY MA'HAD BUDGETING
 * ============================================================================
 * Architecture Overview:
 * 1. Design Tokens & GPU-Only 60fps Animations (injected Google Fonts + Keyframes)
 * 2. Lightweight Inline SVG Loopy Mascot Component (6 dynamic expressions, <5KB)
 * 3. Local-First IndexedDB Engine (SantriFlowDB with reactive subscriptions)
 * 4. Offline Local AI Engine:
 *    - Layer 1: Rule-based weighting + student context checklist + Rp1000/Rp500 rounding
 *    - Layer 2: On-device Exponential Moving Average (EMA) historical learner
 *    - Layer 3: Indonesian NLP Quick-Parser ("15rb bakso kantin cash")
 * 5. Screens & Interactive Modals:
 *    - Boot Splash Screen (~1.2s GPU scaleX + waving Loopy)
 *    - Initial Setup & Smart AI Allocator Screen (auto-shown if no active cycle)
 *    - Tab 1: Beranda / Pos & Saldo (Hero Card, Inline NLP Bar, 2x2 Buckets)
 *    - Tab 2: Salin Buku / Notebook Sync (Batch Multi-Row Input + Lined Paper Summary)
 *    - Tab 3: Riwayat & Arsip Siklus (Date-grouped ledger, filters & EMA history)
 */

const DB_NAME = 'SantriFlowLocalDB';
const DB_VERSION = 1;
const SETTINGS_STORAGE_KEY = 'santriflow_user_settings_v1';

const DEFAULT_USER_SETTINGS = {
  userName: '',
  theme: 'light', // 'light' | 'dark'
  lowJajanThreshold: 20, // 10 | 20 | 30 (%)
  defaultRounding: 1000 // 1000 | 500
};

function loadSavedSettings() {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_USER_SETTINGS };
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_SETTINGS };
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_USER_SETTINGS };
  }
}

const BUCKET_META = {
  MANDATORY: {
    label: 'Wajib Pondok & Sekolah',
    subtitle: 'jariyah, galon, sabun, kas, dll',
    shortLabel: 'Wajib',
    icon: ShieldCheck,
    bgSoft: '#FFEFF4',
    accent: '#F45B84'
  },
  ACADEMIC: {
    label: 'Sekolah',
    subtitle: 'print, kerja kelompok, iuran, alat tulis, dll',
    shortLabel: 'Akademik',
    icon: GraduationCap,
    bgSoft: '#EEF4FF',
    accent: '#4F7DF3'
  },
  EMERGENCY: {
    label: 'Dana Darurat',
    subtitle: 'cadangan mendesak',
    shortLabel: 'Darurat',
    icon: HeartHandshake,
    bgSoft: '#F3E8FF',
    accent: '#9D4EDD'
  },
  LIFESTYLE: {
    label: 'Makanan dan Gaya Hidup',
    subtitle: 'jajan, kantin, susu, checkout shopee, dll',
    shortLabel: 'Gaya Hidup',
    icon: ShoppingBag,
    bgSoft: '#FFF4E6',
    accent: '#F59E0B'
  }
};

const CONTEXT_OPTIONS = [
  {
    id: 'stok_aman',
    iconName: 'soap',
    label: 'stok kebutuhan pondok (sabun, shampoo, dll) aman?',
    hint: 'Kurangi sedikit jatah Wajib Pondok & Sekolah',
    deltas: { MANDATORY: -0.10, LIFESTYLE: 0.05, EMERGENCY: 0.05 }
  },
  {
    id: 'tugas_sekolah',
    iconName: 'book',
    label: 'ada iuran? print? beli alat tulis? atau yg lainnya?',
    hint: 'Tambahkan jatah Sekolah',
    deltas: { ACADEMIC: 0.10, LIFESTYLE: -0.06, MANDATORY: -0.04 }
  },
  {
    id: 'darurat_lebih',
    iconName: 'shield',
    label: 'perlu pegangan darurat lebih banyak?',
    hint: 'Perbesar simpanan Dana Darurat',
    deltas: { EMERGENCY: 0.10, LIFESTYLE: -0.07, MANDATORY: -0.03 }
  },
  {
    id: 'mode_hemat',
    iconName: 'bento',
    label: 'lagi mau hemat jajan atau puasa ngga?',
    hint: 'Kurangi jajan, amankan tabungan & wajib',
    deltas: { EMERGENCY: 0.08, MANDATORY: 0.04, LIFESTYLE: -0.12 }
  }
];

/**
 * Format integer Rupiah cleanly (e.g., 45000 -> "Rp45.000")
 */
function formatRupiah(amount) {
  const num = Math.round(Number(amount) || 0);
  const absFormatted = Math.abs(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return num < 0 ? `-Rp${absFormatted}` : `Rp${absFormatted}`;
}

/**
 * Format compact Rupiah for dense tables/pills (e.g., 45000 -> "45.000")
 */
function formatNumberID(amount) {
  const num = Math.round(Number(amount) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Get YYYY-MM-DD in local timezone with optional day offset (0 = today, -1 = yesterday)
 */
function getDateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format YYYY-MM-DD to short Indonesian notebook date (e.g., "23 Nov")
 */
function formatShortDateID(dateStr) {
  if (!dateStr) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${day} ${months[monthIdx] || parts[1]}`;
}

// ============================================================================
// 1B. COHESIVE PASTEL STATIONERY SVG ICONS (ZERO EMOJIS)
// ============================================================================

function CuteIcon({ name, className = 'w-4 h-4' }) {
  switch (name) {
    case 'sakura':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 3C13.8 3 15 4.8 14.3 6.8C16.3 6.1 18.2 7.3 18.2 9.1C18.2 10.9 16.5 12 14.8 11.8C16.2 13.3 15.8 15.6 14.1 16.5C12.5 17.4 10.7 16.3 10.5 14.6C9.5 16.1 7.3 16.5 6 15.1C4.7 13.7 5.2 11.5 6.9 10.8C5.2 10.2 4.5 8.1 5.6 6.6C6.7 5.1 8.9 5.3 9.9 6.8C9.2 4.8 10.3 3 12 3Z"
            fill="#FF9EB5"
            stroke="#F45B84"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="11.5" cy="10.5" r="2.1" fill="#FFE066" stroke="#F45B84" strokeWidth="1.2" />
        </svg>
      );
    case 'cash':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" fill="#E8F8F0" stroke="#2EB872" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="2.8" fill="#A7F3D0" stroke="#2EB872" strokeWidth="1.5" />
          <circle cx="6" cy="12" r="1" fill="#2EB872" />
          <circle cx="18" cy="12" r="1" fill="#2EB872" />
        </svg>
      );
    case 'digital':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="2.5" width="12" height="19" rx="3.5" fill="#EEF4FF" stroke="#4F7DF3" strokeWidth="1.7" />
          <path d="M10 5.5H14" stroke="#4F7DF3" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="9" y="8.5" width="6" height="6" rx="1.5" fill="#BFDBFE" stroke="#4F7DF3" strokeWidth="1.3" />
          <circle cx="12" cy="18" r="1.1" fill="#4F7DF3" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path
            d="M12 2.5L13.9 8.6L20 10.5L13.9 12.4L12 18.5L10.1 12.4L4 10.5L10.1 8.6L12 2.5Z"
            fill="#FFE066"
            stroke="#F45B84"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 15.5L19.2 17.8L21.5 18.5L19.2 19.2L18.5 21.5L17.8 19.2L15.5 18.5L17.8 17.8L18.5 15.5Z"
            fill="#FF9EB5"
          />
        </svg>
      );
    case 'ribbon':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M11 11C7 6 3 8 4 12C5 16 9 14 11 11Z" fill="#FF9EB5" stroke="#F45B84" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13 11C17 6 21 8 20 12C19 16 15 14 13 11Z" fill="#FF9EB5" stroke="#F45B84" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 13L7.5 19.5M14 13L16.5 19.5" stroke="#F45B84" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="11.5" r="2.2" fill="#F45B84" />
        </svg>
      );
    case 'notebook':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="3" fill="#FFEFF4" stroke="#F45B84" strokeWidth="1.7" />
          <path d="M9 7.5H15M9 11.5H15M9 15.5H13" stroke="#F45B84" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M3.5 7H6M3.5 12H6M3.5 17H6" stroke="#F45B84" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case 'coin':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="#FFF3BF" stroke="#F59F00" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="5.5" stroke="#F59F00" strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M12 8.5V15.5M10.2 10.2C10.2 9.4 11 9 12 9C13 9 13.8 9.5 13.8 10.3C13.8 11.2 12.8 11.6 12 11.8C11.1 12 10.2 12.4 10.2 13.4C10.2 14.3 11 14.8 12 14.8C13.1 14.8 13.8 14.3 13.8 13.5" stroke="#D97706" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'soap':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="10" width="16" height="9" rx="4.5" fill="#FFEFF4" stroke="#F45B84" strokeWidth="1.7" />
          <circle cx="8" cy="6" r="2" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.4" />
          <circle cx="14.5" cy="5" r="2.5" fill="#FFEFF4" stroke="#F45B84" strokeWidth="1.4" />
          <circle cx="18" cy="7.5" r="1.3" fill="#38BDF8" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M4.5 5.5C4.5 4.4 5.4 3.5 6.5 3.5H18.5V18.5H6.5C5.4 18.5 4.5 19.4 4.5 20.5V5.5Z" fill="#EEF4FF" stroke="#4F7DF3" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M4.5 18.5H18.5V20.5H6.5C5.4 20.5 4.5 19.6 4.5 18.5Z" fill="#BFDBFE" />
          <path d="M8.5 7.5H14.5M8.5 11H13" stroke="#4F7DF3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3L19 6V11.5C19 16.2 16 19.8 12 21C8 19.8 5 16.2 5 11.5V6L12 3Z" fill="#F3E8FF" stroke="#9D4EDD" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M12 9.2C11.3 8.3 9.8 8.4 9.3 9.5C8.8 10.6 9.8 12 12 13.6C14.2 12 15.2 10.6 14.7 9.5C14.2 8.4 12.7 8.3 12 9.2Z" fill="#C77DFF" />
        </svg>
      );
    case 'bento':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="7" width="16" height="11" rx="4" fill="#FFF4E6" stroke="#F59E0B" strokeWidth="1.7" />
          <path d="M8 7V5.5C8 4.7 8.7 4 9.5 4H14.5C15.3 4 16 4.7 16 5.5V7" stroke="#F59F0B" strokeWidth="1.6" />
          <path d="M4 12.5H20" stroke="#F59F0B" strokeWidth="1.5" />
        </svg>
      );
    case 'cool':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#FFF3BF" stroke="#F59F00" strokeWidth="1.6" />
          <path d="M7.5 10.5H10.8L10.2 12.5H8.1L7.5 10.5ZM13.2 10.5H16.5L15.9 12.5H13.8L13.2 10.5Z" fill="#2D1E24" />
          <path d="M9 15.2C10.2 16.5 13.8 16.5 15 15.2" stroke="#2D1E24" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'sweat':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M12 3.5C12 3.5 6.5 10.2 6.5 14.2C6.5 17.2 9 19.7 12 19.7C15 19.7 17.5 17.2 17.5 14.2C17.5 10.2 12 3.5 12 3.5Z" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9.8 14.5C9.8 15.8 10.7 16.8 12 16.8" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'bolt':
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <path d="M13 2.5L5.5 13.5H12L11 21.5L18.5 10.5H12L13 2.5Z" fill="#FFE066" stroke="#F45B84" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="8" fill="#FFEFF4" stroke="#F45B84" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="3" fill="#F45B84" />
        </svg>
      );
  }
}

// ============================================================================
// 2. LIGHTWEIGHT INLINE SVG LOOPY MASCOT (<5KB, CUTE MOCHI-CHEEK REDESIGN)
// ============================================================================

function LoopyMascot({ mood = 'happy', className = 'w-24 h-24' }) {
  const clipId = `loopyMouthClip-${mood}`;

  return (
    <svg
      viewBox="0 0 140 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-loopy-float ${className}`}
      aria-label={`Maskot Loopy (${mood})`}
    >
      <defs>
        {/* 3D Soft Mochi-Pink Skin Shading */}
        <radialGradient id="loopyHeadGrad" cx="44%" cy="34%" r="64%">
          <stop offset="0%" stopColor="#FFC8D9" />
          <stop offset="55%" stopColor="#F892AE" />
          <stop offset="100%" stopColor="#E4698B" />
        </radialGradient>

        {/* Soft Rosy Cheek Blush */}
        <radialGradient id="loopyCheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF5283" stopOpacity="0.62" />
          <stop offset="70%" stopColor="#FF7597" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FF7597" stopOpacity="0" />
        </radialGradient>

        {/* Glossy Nose Highlight */}
        <radialGradient id="loopyNoseGrad" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#9E2A52" />
          <stop offset="60%" stopColor="#641632" />
          <stop offset="100%" stopColor="#450D21" />
        </radialGradient>

        <linearGradient id="goldCoinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE875" />
          <stop offset="100%" stopColor="#F59F00" />
        </linearGradient>

        {/* Clip Path for Cheerful Open Mouth so Bucktooth sits naturally under Upper Lip */}
        <clipPath id={clipId}>
          <path d="M 56 80 Q 70 76 84 80 C 85 91 79 97 70 97 C 61 97 55 91 56 80 Z" />
        </clipPath>
      </defs>

      {/* Cute Double Hair Sprouts on Top */}
      <g className="animate-loopy-sprout" style={{ transformOrigin: '70px 25px' }}>
        <path
          d="M67 25 C63 14, 57 10, 54 13 C57 17, 62 21, 65 26"
          stroke="#D44A70"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M71 24 C73 12, 80 9, 83 12 C79 16, 75 20, 73 25"
          stroke="#D44A70"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </g>

      {/* Cute Round Ears */}
      <circle cx="38" cy="40" r="10.5" fill="#F489A6" stroke="#D95379" strokeWidth="1.4" />
      <circle cx="38" cy="40" r="5.8" fill="#FFE6EE" />
      <circle cx="102" cy="40" r="10.5" fill="#F489A6" stroke="#D95379" strokeWidth="1.4" />
      <circle cx="102" cy="40" r="5.8" fill="#FFE6EE" />

      {/* Chubby Pear-Shaped Loopy Head (Squishy Wide Cheeks!) */}
      <path
        d="M 70 23
           C 93 23, 108 38, 111 58
           C 116 74, 117 92, 102 103
           C 91 110, 80 111, 70 111
           C 60 111, 49 110, 38 103
           C 23 92, 24 74, 29 58
           C 32 38, 47 23, 70 23 Z"
        fill="url(#loopyHeadGrad)"
      />

      {/* Soft Forehead Highlight */}
      <ellipse cx="64" cy="36" rx="18" ry="7" fill="#FFFFFF" opacity="0.22" />

      {/* Plump Rosy Cheeks */}
      <ellipse cx="40" cy="77" rx="15.5" ry="11" fill="url(#loopyCheek)" />
      <ellipse cx="100" cy="77" rx="15.5" ry="11" fill="url(#loopyCheek)" />

      {/* Cute Pink Ribbon Bow on Head (Notebook Mode) */}
      {mood === 'notebook' && (
        <g transform="translate(86, 20) rotate(18)">
          <path d="M12 10 C2 1, 0 19, 12 12 Z" fill="#FF4D7D" stroke="#C92A58" strokeWidth="1.3" />
          <path d="M14 10 C24 1, 26 19, 14 12 Z" fill="#FF4D7D" stroke="#C92A58" strokeWidth="1.3" />
          <circle cx="13" cy="11" r="3.6" fill="#FF85A6" stroke="#C92A58" strokeWidth="1.3" />
        </g>
      )}

      {/* Eyes or Heart Sunglasses */}
      {mood === 'cool' ? (
        <g>
          {/* Heart-Shaped Pastel Red Sunglasses */}
          <path
            d="M53 56 C53 50, 44 48, 41 54 C38 48, 29 50, 29 56 C29 64, 41 72, 41 72 C41 72, 53 64, 53 56 Z"
            fill="#C9184A"
            stroke="#FFE5EC"
            strokeWidth="2.2"
          />
          <path
            d="M111 56 C111 50, 102 48, 99 54 C96 48, 87 50, 87 56 C87 64, 99 72, 99 72 C99 72, 111 64, 111 56 Z"
            fill="#C9184A"
            stroke="#FFE5EC"
            strokeWidth="2.2"
          />
          <path d="M53 57 Q70 54 87 57" stroke="#FFE5EC" strokeWidth="2.5" fill="none" />
          <path d="M34 55 L38 53" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M92 55 L96 53" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          {/* Sparkling Berry Eyes with Dual Catchlights */}
          <circle cx="51" cy="59" r="5" fill="#2A1820" />
          <circle cx="49.2" cy="57.2" r="1.8" fill="#FFFFFF" />
          <circle cx="52.4" cy="60.4" r="0.9" fill="#FFFFFF" opacity="0.85" />

          <circle cx="89" cy="59" r="5" fill="#2A1820" />
          <circle cx="87.2" cy="57.2" r="1.8" fill="#FFFFFF" />
          <circle cx="90.4" cy="60.4" r="0.9" fill="#FFFFFF" opacity="0.85" />
        </g>
      )}

      {/* Sweat Drop for Warning State */}
      {mood === 'warning' && (
        <path
          d="M108 46 C108 46, 114.5 54.5, 114.5 58.8 C114.5 62.3, 111.6 65, 108 65 C104.4 65, 101.5 62.3, 101.5 58.8 C101.5 54.5, 108 46, 108 46 Z"
          fill="#60A5FA"
          stroke="#FFFFFF"
          strokeWidth="1.4"
        />
      )}

      {/* Cute Plump Glossy Berry Nose */}
      <ellipse cx="70" cy="68.5" rx="8.2" ry="6" fill="url(#loopyNoseGrad)" />
      <ellipse cx="67.5" cy="66.6" rx="3" ry="1.6" fill="#FFC2D4" opacity="0.78" />

      {/* Mouth & Properly Tucked Single Bucktooth UNDER Upper Lip */}
      {mood === 'warning' ? (
        <g>
          {/* Surprised Open Mouth */}
          <ellipse cx="70" cy="86.5" rx="9" ry="10.2" fill="#7A1C3B" />
          {/* Tooth tucked neatly at the top inside of mouth */}
          <path d="M66.2 76.8 H73.8 V81.5 C73.8 82.8 72.7 83.6 70 83.6 C67.3 83.6 66.2 82.8 66.2 81.5 Z" fill="#FFFFFF" />
          {/* Cute Pink Tongue */}
          <path d="M63.5 91.5 Q70 86.5 76.5 91.5 Q74.5 96.2 70 96.2 Q65.5 96.2 63.5 91.5 Z" fill="#FF7597" />
          {/* Soft Upper Lip Outline */}
          <path d="M61 82 Q70 74.5 79 82" stroke="#B83B60" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          {/* Cheerful Open Mouth Interior (Clipped so Tooth is Inside Mouth, Below Upper Lip!) */}
          <g clipPath={`url(#${clipId})`}>
            {/* Mouth Cavity */}
            <rect x="52" y="74" width="36" height="26" fill="#7A1C3B" />
            {/* Cute Pink Tongue at Bottom */}
            <ellipse cx="70" cy="94" rx="10" ry="6.5" fill="#FF7597" />
            {/* Single Rounded White Bucktooth Peeking from Upper Gum */}
            <rect x="66.2" y="76.5" width="7.6" height="7.5" rx="2.2" fill="#FFFFFF" />
          </g>
          {/* Gentle Upper Lip Arch Over the Tooth */}
          <path
            d="M 56 80 Q 70 76 84 80"
            stroke="#C44369"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}

      {/* Chubby Little Paws & Props by State */}
      {mood === 'happy' && (
        <g>
          {/* Left Chubby Paw */}
          <ellipse cx="44" cy="105" rx="8.5" ry="6.5" transform="rotate(-14 44 105)" fill="#F99BB4" stroke="#D95379" strokeWidth="1.3" />
          {/* Shiny Gold Coin held on Right */}
          <g transform="translate(83, 89)">
            <circle cx="16" cy="16" r="14.5" fill="url(#goldCoinGrad)" stroke="#FFF9DB" strokeWidth="2.2" />
            <text
              x="16"
              y="20.5"
              textAnchor="middle"
              fill="#8F5400"
              fontSize="11.5"
              fontWeight="900"
              fontFamily="Nunito, sans-serif"
            >
              Rp
            </text>
            {/* Right Paw hugging Coin */}
            <ellipse cx="4" cy="16" rx="7" ry="5.5" fill="#F99BB4" stroke="#D95379" strokeWidth="1.3" />
          </g>
        </g>
      )}

      {mood === 'locked' && (
        <g transform="translate(48, 92)">
          <path
            d="M14 11 V6 C14 2, 30 2, 30 6 V11"
            stroke="#9D4EDD"
            strokeWidth="3.6"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="8" y="10" width="28" height="21" rx="7" fill="#C77DFF" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle cx="22" cy="19.5" r="2.6" fill="#FFFFFF" />
          <path d="M22 21 V25" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" />
          <ellipse cx="7" cy="20" rx="6.5" ry="5" fill="#F99BB4" stroke="#D95379" strokeWidth="1.2" />
          <ellipse cx="37" cy="20" rx="6.5" ry="5" fill="#F99BB4" stroke="#D95379" strokeWidth="1.2" />
        </g>
      )}

      {mood === 'notebook' && (
        <g transform="translate(36, 92)">
          <path d="M6 8 L34 13 L34 32 L6 26 Z" fill="#F45B84" stroke="#FFFFFF" strokeWidth="1.4" />
          <path d="M62 8 L34 13 L34 32 L62 26 Z" fill="#FF7597" stroke="#FFFFFF" strokeWidth="1.4" />
          <path d="M9 6 L34 11 L34 28 L9 23 Z" fill="#FFF8FA" />
          <path d="M59 6 L34 11 L34 28 L59 23 Z" fill="#FFFFFF" />
          <circle cx="7" cy="18" r="5.5" fill="#F99BB4" stroke="#D95379" strokeWidth="1.2" />
          <circle cx="61" cy="18" r="5.5" fill="#F99BB4" stroke="#D95379" strokeWidth="1.2" />
        </g>
      )}

      {mood === 'cool' && (
        <g>
          <ellipse cx="44" cy="105" rx="8.5" ry="6.5" transform="rotate(-14 44 105)" fill="#F99BB4" stroke="#D95379" strokeWidth="1.3" />
          <g transform="translate(88, 91)">
            <path
              d="M18 11 C18 6.5, 11.5 4.5, 9 9 C6.5 4.5, 0 6.5, 0 11 C0 17.5, 9 24, 9 24 C9 24, 18 17.5, 18 11 Z"
              fill="#FF4D6D"
              stroke="#FFFFFF"
              strokeWidth="1.8"
            />
          </g>
        </g>
      )}

      {mood === 'loading' && (
        <g>
          <ellipse
            cx="21"
            cy="78"
            rx="8.5"
            ry="6.8"
            transform="rotate(-28 21 78)"
            fill="#F99BB4"
            stroke="#D95379"
            strokeWidth="1.4"
          />
          <path d="M9 66 Q6 72 9 78" stroke="#F45B84" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <ellipse
            cx="114"
            cy="90"
            rx="7.5"
            ry="6"
            transform="rotate(20 114 90)"
            fill="#F99BB4"
            stroke="#D95379"
            strokeWidth="1.4"
          />
        </g>
      )}
    </svg>
  );
}

// ============================================================================
// 3. LOCAL-FIRST INDEXEDDB ENGINE (SantriFlowDB + Reactive Hooks)
// ============================================================================

class SantriFlowDatabase {
  constructor() {
    this.db = null;
    this.listeners = new Set();
    this.initPromise = this._open();
  }

  _open() {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB tidak didukung di browser ini.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('cycles')) {
          const cycleStore = db.createObjectStore('cycles', { keyPath: 'id', autoIncrement: true });
          cycleStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('buckets')) {
          const bucketStore = db.createObjectStore('buckets', { keyPath: 'id', autoIncrement: true });
          bucketStore.createIndex('cycleId', 'cycleId', { unique: false });
        }

        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          txStore.createIndex('cycleId', 'cycleId', { unique: false });
          txStore.createIndex('date', 'date', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  async getAll(storeName) {
    const db = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, item) {
    const db = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => this.notify();
    });
  }

  async put(storeName, item) {
    const db = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => this.notify();
    });
  }

  async delete(storeName, id) {
    const db = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => this.notify();
    });
  }

  async clearAll() {
    const db = await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['cycles', 'buckets', 'transactions'], 'readwrite');
      tx.objectStore('cycles').clear();
      tx.objectStore('buckets').clear();
      tx.objectStore('transactions').clear();
      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Optional demo simulation loader triggered manually by user if desired.
   * By default, first boot starts clean at the Initial Setup AI Screen.
   */
  async loadDemoSimulation() {
    await this.clearAll();

    // Historical Closed Cycle #1 (for EMA adaptive learning)
    const c1Id = await this.add('cycles', {
      cycleNumber: 1,
      title: 'Kiriman #1 (01 Nov)',
      initialCash: 70000,
      initialDigital: 110000,
      status: 'CLOSED',
      contextFlags: ['mode_hemat'],
      aiNote: 'Alokasi awal standar dengan mode hemat ekstra.',
      startedAt: new Date(Date.now() - 22 * 86400000).toISOString(),
      closedAt: new Date(Date.now() - 12 * 86400000).toISOString()
    });
    await this.add('buckets', { cycleId: c1Id, name: 'Wajib Pondok', type: 'MANDATORY', allocatedAmount: 55000, spentAmount: 52000, isLocked: false });
    await this.add('buckets', { cycleId: c1Id, name: 'Sekolah & Kitab', type: 'ACADEMIC', allocatedAmount: 50000, spentAmount: 48000, isLocked: false });
    await this.add('buckets', { cycleId: c1Id, name: 'Dana Darurat', type: 'EMERGENCY', allocatedAmount: 40000, spentAmount: 0, isLocked: true });
    await this.add('buckets', { cycleId: c1Id, name: 'Jajan & Kantin', type: 'LIFESTYLE', allocatedAmount: 35000, spentAmount: 35000, isLocked: false });

    // Historical Closed Cycle #2 (for EMA adaptive learning)
    const c2Id = await this.add('cycles', {
      cycleNumber: 2,
      title: 'Kiriman #2 (12 Nov)',
      initialCash: 90000,
      initialDigital: 110000,
      status: 'CLOSED',
      contextFlags: ['tugas_sekolah'],
      aiNote: 'Porsi Sekolah & Kitab ditambah untuk persiapan ujian.',
      startedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
      closedAt: new Date(Date.now() - 3 * 86400000).toISOString()
    });
    await this.add('buckets', { cycleId: c2Id, name: 'Wajib Pondok', type: 'MANDATORY', allocatedAmount: 55000, spentAmount: 50000, isLocked: false });
    await this.add('buckets', { cycleId: c2Id, name: 'Sekolah & Kitab', type: 'ACADEMIC', allocatedAmount: 65000, spentAmount: 60000, isLocked: false });
    await this.add('buckets', { cycleId: c2Id, name: 'Dana Darurat', type: 'EMERGENCY', allocatedAmount: 35000, spentAmount: 10000, isLocked: true });
    await this.add('buckets', { cycleId: c2Id, name: 'Jajan & Kantin', type: 'LIFESTYLE', allocatedAmount: 45000, spentAmount: 45000, isLocked: false });

    // Active Cycle #3: Kiriman #3 (23 Nov)
    // Initial: Cash Rp80.000 + Digital Rp120.000 = Rp200.000
    // Spent: Cash Rp35.000 + Digital Rp40.000 = Rp75.000
    // Remaining: Cash Rp45.000 + Digital Rp80.000 = Rp125.000
    const c3Id = await this.add('cycles', {
      cycleNumber: 3,
      title: 'Kiriman #3 (23 Nov)',
      initialCash: 80000,
      initialDigital: 120000,
      status: 'ACTIVE',
      contextFlags: ['tugas_sekolah'],
      aiNote: 'Pembagian jatah sudah disesuaikan dengan kebutuhan sekolah dan catatan kiriman sebelumnya, dibulatkan ke Rp1.000 agar mudah dicatat.',
      startedAt: new Date(Date.now() - 2 * 86400000).toISOString()
    });

    const bMandatory = await this.add('buckets', {
      cycleId: c3Id,
      name: 'Wajib Pondok',
      type: 'MANDATORY',
      allocatedAmount: 60000,
      spentAmount: 25000,
      isLocked: false
    });
    const bAcademic = await this.add('buckets', {
      cycleId: c3Id,
      name: 'Sekolah & Kitab',
      type: 'ACADEMIC',
      allocatedAmount: 50000,
      spentAmount: 20000,
      isLocked: false
    });
    await this.add('buckets', {
      cycleId: c3Id,
      name: 'Dana Darurat',
      type: 'EMERGENCY',
      allocatedAmount: 40000,
      spentAmount: 0,
      isLocked: true
    });
    const bLifestyle = await this.add('buckets', {
      cycleId: c3Id,
      name: 'Jajan & Kantin',
      type: 'LIFESTYLE',
      allocatedAmount: 50000,
      spentAmount: 30000,
      isLocked: false
    });

    const twoDaysAgo = getDateISO(-2);
    const yesterday = getDateISO(-1);
    const today = getDateISO(0);

    await this.add('transactions', {
      cycleId: c3Id,
      bucketId: bMandatory,
      type: 'EXPENSE',
      walletSource: 'CASH',
      amount: 15000,
      description: 'Laundry kiloan & pewangi',
      date: twoDaysAgo,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    });
    await this.add('transactions', {
      cycleId: c3Id,
      bucketId: bMandatory,
      type: 'EXPENSE',
      walletSource: 'CASH',
      amount: 10000,
      description: 'Iuran galon & kas kamar',
      date: twoDaysAgo,
      createdAt: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString()
    });
    await this.add('transactions', {
      cycleId: c3Id,
      bucketId: bAcademic,
      type: 'EXPENSE',
      walletSource: 'DIGITAL',
      amount: 20000,
      description: 'Fotokopi modul nahwu & pulpen',
      date: yesterday,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    });
    await this.add('transactions', {
      cycleId: c3Id,
      bucketId: bLifestyle,
      type: 'EXPENSE',
      walletSource: 'CASH',
      amount: 10000,
      description: 'Bakso & es teh kantin',
      date: yesterday,
      createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString()
    });
    await this.add('transactions', {
      cycleId: c3Id,
      bucketId: bLifestyle,
      type: 'EXPENSE',
      walletSource: 'DIGITAL',
      amount: 20000,
      description: 'Jajan koperasi & roti malam',
      date: today,
      createdAt: new Date().toISOString()
    });
  }
}

const santriDB = new SantriFlowDatabase();

// ============================================================================
// 4. LOCAL AI ENGINE (Rule-Based + EMA Learner + Indonesian NLP Quick-Parser)
// ============================================================================

/**
 * Layer 1 + Layer 2: Hybrid Smart Local Allocator
 * Combines rule-based context weights with Exponential Moving Average (EMA)
 * from closed cycles, rounding cleanly to user-selected step (Rp1.000 or Rp500).
 */
function calculateSmartAllocation(
  totalFunds,
  contextFlags = [],
  closedCyclesData = [],
  roundingStep = 1000
) {
  const safeTotal = Math.max(0, Math.round(Number(totalFunds) || 0));
  if (safeTotal === 0) {
    return {
      allocations: { MANDATORY: 0, ACADEMIC: 0, EMERGENCY: 0, LIFESTYLE: 0 },
      aiNote: 'Masukkan nominal dana Cash atau Digital untuk menghitung pembagian pos otomatis.'
    };
  }

  // Base weights
  const weights = {
    MANDATORY: 0.30,
    ACADEMIC: 0.25,
    EMERGENCY: 0.20,
    LIFESTYLE: 0.25
  };

  // Apply Layer 1: Context Checkboxes
  contextFlags.forEach((flagId) => {
    const opt = CONTEXT_OPTIONS.find((c) => c.id === flagId);
    if (opt && opt.deltas) {
      Object.entries(opt.deltas).forEach(([key, delta]) => {
        weights[key] = Math.max(0.05, (weights[key] || 0) + delta);
      });
    }
  });

  // Normalize rule weights
  const ruleSum = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach((k) => {
    weights[k] /= ruleSum;
  });

  // Apply Layer 2: Exponential Moving Average (EMA) from historical closed cycles
  let usedHistoryCount = 0;
  if (closedCyclesData.length > 0) {
    const emaShares = { MANDATORY: 0.30, ACADEMIC: 0.25, EMERGENCY: 0.20, LIFESTYLE: 0.25 };
    const alpha = 0.4;

    closedCyclesData.forEach((cycleEntry) => {
      const totalSpent = cycleEntry.buckets.reduce((acc, b) => acc + (b.spentAmount || 0), 0);
      if (totalSpent > 0) {
        usedHistoryCount += 1;
        cycleEntry.buckets.forEach((b) => {
          if (emaShares[b.type] !== undefined) {
            const actualShare = (b.spentAmount || 0) / totalSpent;
            emaShares[b.type] = alpha * actualShare + (1 - alpha) * emaShares[b.type];
          }
        });
      }
    });

    if (usedHistoryCount > 0) {
      // Blend 75% Rule-based + 25% Historical EMA
      Object.keys(weights).forEach((k) => {
        weights[k] = 0.75 * weights[k] + 0.25 * emaShares[k];
      });
    }
  }

  // Re-normalize final weights
  const finalSum = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach((k) => {
    weights[k] /= finalSum;
  });

  // Round cleanly to chosen step (Rp1.000 or Rp500)
  const step = roundingStep === 500 ? 500 : 1000;
  const allocations = {};
  let allocatedRunning = 0;

  const keys = ['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'];
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      // Assign exact remainder to LIFESTYLE so total matches 100%
      allocations[key] = Math.max(0, safeTotal - allocatedRunning);
    } else {
      const raw = safeTotal * weights[key];
      const rounded = Math.round(raw / step) * step;
      allocations[key] = rounded;
      allocatedRunning += rounded;
    }
  });

  // Adjust if rounding pushed allocatedRunning over safeTotal
  if (allocatedRunning > safeTotal) {
    const diff = allocatedRunning - safeTotal;
    if (allocations.MANDATORY >= diff) {
      allocations.MANDATORY -= diff;
    } else if (allocations.ACADEMIC >= diff) {
      allocations.ACADEMIC -= diff;
    }
    allocations.LIFESTYLE = Math.max(
      0,
      safeTotal - (allocations.MANDATORY + allocations.ACADEMIC + allocations.EMERGENCY)
    );
  }

  const parts = [];
  if (usedHistoryCount > 0) {
    parts.push(`catatan ${usedHistoryCount} kiriman sebelumnya`);
  }
  if (contextFlags.length > 0) {
    parts.push(`${contextFlags.length} keadaan yang kamu pilih`);
  }
  const basisText = parts.length > 0 ? `menyesuaikan ${parts.join(' dan ')}` : 'mengikuti pembagian standar santri';
  const aiNote = `Pembagian jatah dihitung ${basisText}, lalu dibulatkan ke kelipatan ${formatRupiah(step)} supaya rapi disalin ke buku kas.`;

  return { allocations, aiNote };
}

/**
 * Layer 3: Indonesian Natural Language Quick-Parser
 * Parses casual phrases like:
 * - "15rb bakso kantin cash"
 * - "20000 print tugas digital"
 * - "12.5k laundry kiloan tunai"
 */
function parseQuickExpense(rawInput) {
  const text = (rawInput || '').trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // 1. Extract Amount (supports: 15rb, 15ribu, 15k, 12.5rb, 12,5rb, 20000, 20.000, rp 15000)
  let amount = 0;
  let cleanedText = text;

  const suffixRegex = /(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(rb|ribu|k)\b/i;
  const plainRegex = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,7})\b/i;

  const suffixMatch = text.match(suffixRegex);
  if (suffixMatch) {
    const numStr = suffixMatch[1].replace(',', '.');
    amount = Math.round(parseFloat(numStr) * 1000);
    cleanedText = cleanedText.replace(suffixMatch[0], ' ');
  } else {
    const plainMatch = text.match(plainRegex);
    if (plainMatch) {
      const digitsOnly = plainMatch[1].replace(/[.,]/g, '');
      amount = parseInt(digitsOnly, 10) || 0;
      cleanedText = cleanedText.replace(plainMatch[0], ' ');
    }
  }

  // 2. Extract Wallet Source
  let walletSource = null;
  const cashKeywords = ['cash', 'tunai', 'kontan', 'dompet', 'fisik', 'lemari'];
  const digitalKeywords = ['digital', 'qris', 'dana', 'gopay', 'ovo', 'shopeepay', 'spay', 'transfer', 'tf', 'bank', 'bsi', 'bri', 'bca', 'mandiri', 'ewallet'];

  for (const kw of cashKeywords) {
    const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
    if (kwRegex.test(lower)) {
      walletSource = 'CASH';
      cleanedText = cleanedText.replace(kwRegex, ' ');
      break;
    }
  }
  if (!walletSource) {
    for (const kw of digitalKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
      if (kwRegex.test(lower)) {
        walletSource = 'DIGITAL';
        cleanedText = cleanedText.replace(kwRegex, ' ');
        break;
      }
    }
  }

  // 3. Detect Bucket Type via Keyword Dictionary
  const dictionary = {
    MANDATORY: [
      'laundry', 'londri', 'sabun', 'sampo', 'shampoo', 'odol', 'sikat', 'galon',
      'air', 'kas', 'iuran', 'detergen', 'pewangi', 'mandi', 'cuci', 'tisu', 'tisue', 'pondok', 'kamar'
    ],
    ACADEMIC: [
      'print', 'fotokopi', 'fc', 'buku', 'kitab', 'pulpen', 'pensil', 'tugas',
      'sekolah', 'ongkos', 'bensin', 'ojek', 'angkot', 'kertas', 'map', 'ujian', 'lks', 'spidol'
    ],
    EMERGENCY: [
      'obat', 'sakit', 'dokter', 'klinik', 'darurat', 'perban', 'demam',
      'pusing', 'tolak angin', 'minyak kayu putih', 'tambal', 'rusak', 'mendesak'
    ],
    LIFESTYLE: [
      'bakso', 'mie', 'jajan', 'kantin', 'koperasi', 'kopi', 'es', 'teh',
      'roti', 'nasi', 'ayam', 'gorengan', 'snack', 'minum', 'makan', 'cilok', 'siomay', 'soto', 'geprek', 'susu'
    ]
  };

  let bucketType = null;
  for (const [type, keywords] of Object.entries(dictionary)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      bucketType = type;
      break;
    }
  }

  // 4. Clean Description & Capitalize First Letter
  const descRaw = cleanedText.replace(/\s+/g, ' ').trim();
  const description = descRaw ? descRaw.charAt(0).toUpperCase() + descRaw.slice(1) : '';

  if (amount === 0 && !walletSource && !bucketType) return null;

  return {
    amount,
    description,
    bucketType,
    walletSource
  };
}

// ============================================================================
// 5. MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // Navigation & Boot UI State
  const [activeTab, setActiveTab] = useState('HOME'); // 'HOME' | 'NOTEBOOK' | 'HISTORY' | 'SETTINGS'
  const [notebookMode, setNotebookMode] = useState('BATCH'); // 'BATCH' | 'SUMMARY'
  const [bootLoading, setBootLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Persistent User Settings (LocalStorage - survives closing app & background clear)
  const [userSettings, setUserSettings] = useState(loadSavedSettings);

  const updateUserSettings = useCallback((patch) => {
    setUserSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Gagal menyimpan pengaturan:', err);
      }
      return next;
    });
  }, []);

  // Database State
  const [cycles, setCycles] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState(null);

  // Modals State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expensePreselectBucketId, setExpensePreselectBucketId] = useState(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [padlockWiggle, setPadlockWiggle] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [cycleModalDefaultTab, setCycleModalDefaultTab] = useState('NEW_CYCLE');
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Inject Google Fonts once
  useEffect(() => {
    const fontId = 'santriflow-google-fonts';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // Load & subscribe to IndexedDB (Zero auto-seed so first boot enters Setup Screen)
  const loadDatabase = useCallback(async () => {
    try {
      const [allCycles, allBuckets, allTxs] = await Promise.all([
        santriDB.getAll('cycles'),
        santriDB.getAll('buckets'),
        santriDB.getAll('transactions')
      ]);

      const sortedCycles = [...allCycles].sort((a, b) => b.cycleNumber - a.cycleNumber);
      setCycles(sortedCycles);
      setBuckets(allBuckets);
      setTransactions(allTxs);

      setSelectedCycleId((prev) => {
        if (prev && sortedCycles.some((c) => c.id === prev)) return prev;
        const active = sortedCycles.find((c) => c.status === 'ACTIVE') || sortedCycles[0];
        return active ? active.id : null;
      });
    } catch (err) {
      console.error('Failed to load IndexedDB:', err);
    } finally {
      setDbReady(true);
    }
  }, []);

  // Boot Sequence (~1.2s minimum splash screen while IndexedDB initializes)
  useEffect(() => {
    let mounted = true;
    const minBootTimer = new Promise((resolve) => setTimeout(resolve, 1200));
    Promise.all([loadDatabase(), minBootTimer]).then(() => {
      if (mounted) setBootLoading(false);
    });

    const unsub = santriDB.subscribe(() => {
      loadDatabase();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [loadDatabase]);

  // Toast helper
  const toastTimerRef = useRef(null);
  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Derived Active Cycle Data (Check if there is an active cycle)
  const hasAnyActiveCycle = useMemo(() => {
    return cycles.some((c) => c.status === 'ACTIVE');
  }, [cycles]);

  const activeCycle = useMemo(() => {
    if (!hasAnyActiveCycle && cycles.length === 0) return null;
    return (
      cycles.find((c) => c.id === selectedCycleId) ||
      cycles.find((c) => c.status === 'ACTIVE') ||
      cycles[0] ||
      null
    );
  }, [cycles, selectedCycleId, hasAnyActiveCycle]);

  const activeBuckets = useMemo(() => {
    if (!activeCycle) return [];
    const order = ['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'];
    return buckets
      .filter((b) => b.cycleId === activeCycle.id)
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }, [buckets, activeCycle]);

  const activeTransactions = useMemo(() => {
    if (!activeCycle) return [];
    return transactions
      .filter((t) => t.cycleId === activeCycle.id)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [transactions, activeCycle]);

  // Compute Cash vs Digital Wallets & Total Remaining
  const walletSummary = useMemo(() => {
    if (!activeCycle) {
      return { cash: 0, digital: 0, total: 0, initialTotal: 0, surplusRatio: 0 };
    }

    let cash = Number(activeCycle.initialCash) || 0;
    let digital = Number(activeCycle.initialDigital) || 0;
    const initialTotal = cash + digital;

    activeTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'EXPENSE') {
        if (tx.walletSource === 'CASH') cash -= amt;
        else if (tx.walletSource === 'DIGITAL') digital -= amt;
      } else if (tx.type === 'CONVERT_WALLET') {
        // walletSource indicates destination wallet receiving funds
        if (tx.walletSource === 'CASH') {
          // Tarik Tunai: Digital -> Cash
          digital -= amt;
          cash += amt;
        } else if (tx.walletSource === 'DIGITAL') {
          // Top-Up Digital: Cash -> Digital
          cash -= amt;
          digital += amt;
        }
      }
    });

    const total = cash + digital;
    const surplusRatio = initialTotal > 0 ? total / initialTotal : 0;
    return { cash, digital, total, initialTotal, surplusRatio };
  }, [activeCycle, activeTransactions]);

  // Determine Dynamic Loopy Mood on Hero Card
  const heroLoopyMood = useMemo(() => {
    const jajanBucket = activeBuckets.find((b) => b.type === 'LIFESTYLE');
    const warnRatio = (Number(userSettings.lowJajanThreshold) || 20) / 100;
    if (jajanBucket && jajanBucket.allocatedAmount > 0) {
      const jajanRemaining = jajanBucket.allocatedAmount - jajanBucket.spentAmount;
      if (jajanRemaining / jajanBucket.allocatedAmount < warnRatio) {
        return 'warning';
      }
    }
    if (walletSummary.surplusRatio > 0.5) {
      return 'cool';
    }
    return 'happy';
  }, [activeBuckets, walletSummary.surplusRatio, userSettings.lowJajanThreshold]);

  // Closed cycles structured for EMA Learning
  const closedCyclesHistory = useMemo(() => {
    return cycles
      .filter((c) => c.status === 'CLOSED')
      .map((c) => ({
        ...c,
        buckets: buckets.filter((b) => b.cycleId === c.id)
      }));
  }, [cycles, buckets]);

  // ============================================================================
  // MUTATION HANDLERS (IndexedDB)
  // ============================================================================

  const handleAddExpense = async ({ bucketId, walletSource, amount, description, date }) => {
    if (!activeCycle) return;
    const numAmount = Math.round(Number(amount) || 0);
    if (numAmount <= 0) return;

    const targetBucket = activeBuckets.find((b) => b.id === Number(bucketId));
    if (!targetBucket) return;

    await santriDB.add('transactions', {
      cycleId: activeCycle.id,
      bucketId: targetBucket.id,
      type: 'EXPENSE',
      walletSource,
      amount: numAmount,
      description: description.trim() || targetBucket.name,
      date: date || getDateISO(0),
      createdAt: new Date().toISOString()
    });

    await santriDB.put('buckets', {
      ...targetBucket,
      spentAmount: (targetBucket.spentAmount || 0) + numAmount
    });

    triggerToast(`Tercatat: ${formatRupiah(numAmount)}`);
  };

  const handleBatchAddExpenses = async (rows) => {
    if (!activeCycle || !rows.length) return;
    let savedCount = 0;

    // Accumulate bucket spending deltas locally first to avoid race conditions
    const bucketDeltaMap = {};

    for (const row of rows) {
      const numAmount = Math.round(Number(row.amount) || 0);
      if (numAmount <= 0 || !row.bucketId) continue;

      const bId = Number(row.bucketId);
      await santriDB.add('transactions', {
        cycleId: activeCycle.id,
        bucketId: bId,
        type: 'EXPENSE',
        walletSource: row.walletSource || 'CASH',
        amount: numAmount,
        description: (row.description || '').trim() || 'Catatan buku',
        date: row.date || getDateISO(0),
        createdAt: new Date().toISOString()
      });

      bucketDeltaMap[bId] = (bucketDeltaMap[bId] || 0) + numAmount;
      savedCount += 1;
    }

    for (const [bIdStr, delta] of Object.entries(bucketDeltaMap)) {
      const bObj = activeBuckets.find((b) => b.id === Number(bIdStr));
      if (bObj) {
        await santriDB.put('buckets', {
          ...bObj,
          spentAmount: (bObj.spentAmount || 0) + delta
        });
      }
    }

    if (savedCount > 0) {
      triggerToast(`${savedCount} catatan buku berhasil disimpan`);
    }
  };

  const handleDeleteTransaction = async (tx) => {
    if (!tx || !tx.id) return;
    if (tx.type === 'EXPENSE' && tx.bucketId) {
      const bObj = buckets.find((b) => b.id === tx.bucketId);
      if (bObj) {
        await santriDB.put('buckets', {
          ...bObj,
          spentAmount: Math.max(0, (bObj.spentAmount || 0) - (Number(tx.amount) || 0))
        });
      }
    }
    await santriDB.delete('transactions', tx.id);
    triggerToast('Catatan dihapus & sisa uang dikembalikan');
  };

  const handleConvertWallet = async ({ direction, amount }) => {
    if (!activeCycle) return;
    const numAmount = Math.round(Number(amount) || 0);
    if (numAmount <= 0) return;

    // direction === 'DIGITAL_TO_CASH' -> walletSource: 'CASH' (Tarik Tunai)
    // direction === 'CASH_TO_DIGITAL' -> walletSource: 'DIGITAL' (Setor / Top-Up Digital)
    const isTarikTunai = direction === 'DIGITAL_TO_CASH';

    await santriDB.add('transactions', {
      cycleId: activeCycle.id,
      bucketId: null,
      type: 'CONVERT_WALLET',
      walletSource: isTarikTunai ? 'CASH' : 'DIGITAL',
      amount: numAmount,
      description: isTarikTunai ? 'Tarik Tunai (Digital ke Cash)' : 'Isi Saldo Digital (Cash ke Digital)',
      date: getDateISO(0),
      createdAt: new Date().toISOString()
    });

    triggerToast(
      isTarikTunai
        ? `Tarik tunai ${formatRupiah(numAmount)} berhasil`
        : `Isi saldo digital ${formatRupiah(numAmount)} berhasil`
    );
  };

  const handleUpdateEmergencyLock = async ({ isLocked, newEmergencyAllocation, reason }) => {
    const emergencyBucket = activeBuckets.find((b) => b.type === 'EMERGENCY');
    const lifestyleBucket = activeBuckets.find((b) => b.type === 'LIFESTYLE');
    if (!emergencyBucket) return;

    const oldAlloc = emergencyBucket.allocatedAmount || 0;
    const targetAlloc = Math.max(emergencyBucket.spentAmount || 0, Math.round(Number(newEmergencyAllocation) || 0));
    const diff = targetAlloc - oldAlloc;

    await santriDB.put('buckets', {
      ...emergencyBucket,
      allocatedAmount: targetAlloc,
      isLocked
    });

    // Balance zero-based allocation by adjusting Jajan & Kantin if allocation changed
    if (diff !== 0 && lifestyleBucket) {
      await santriDB.put('buckets', {
        ...lifestyleBucket,
        allocatedAmount: Math.max(lifestyleBucket.spentAmount || 0, (lifestyleBucket.allocatedAmount || 0) - diff)
      });
    }

    setPadlockWiggle(true);
    setTimeout(() => setPadlockWiggle(false), 260);
    triggerToast(
      isLocked
        ? 'Dana Darurat dikunci kembali'
        : `Kunci Dana Darurat dibuka (${reason || 'Sesuai kebutuhan'})`
    );
  };

  const handleStartNewCycle = async ({
    mode, // 'NEW_CYCLE' | 'TOP_UP'
    userNameInput,
    customTitle,
    cashInput,
    digitalInput,
    carryOver = true,
    contextFlags,
    allocations,
    aiNote,
    topUpTargetType
  }) => {
    if (userNameInput !== undefined && userNameInput.trim()) {
      updateUserSettings({ userName: userNameInput.trim() });
    }

    const addCash = Math.max(0, Math.round(Number(cashInput) || 0));
    const addDigital = Math.max(0, Math.round(Number(digitalInput) || 0));

    if (mode === 'TOP_UP' && activeCycle) {
      const totalAdd = addCash + addDigital;
      if (totalAdd <= 0) return;

      await santriDB.put('cycles', {
        ...activeCycle,
        initialCash: (activeCycle.initialCash || 0) + addCash,
        initialDigital: (activeCycle.initialDigital || 0) + addDigital
      });

      const targetBucket =
        activeBuckets.find((b) => b.type === (topUpTargetType || 'LIFESTYLE')) || activeBuckets[0];
      if (targetBucket) {
        await santriDB.put('buckets', {
          ...targetBucket,
          allocatedAmount: (targetBucket.allocatedAmount || 0) + totalAdd
        });
      }

      triggerToast(`Tambahan dana ${formatRupiah(totalAdd)} sudah masuk`);
      return;
    }

    // Automatically carry over remaining Cash & Digital from the previous active cycle
    const carryCash = carryOver ? Math.max(0, walletSummary.cash) : 0;
    const carryDigital = carryOver ? Math.max(0, walletSummary.digital) : 0;
    const totalCarryOver = carryCash + carryDigital;
    const previousTitle = activeCycle?.title || 'kiriman sebelumnya';

    // Close existing active cycles
    for (const c of cycles) {
      if (c.status === 'ACTIVE') {
        await santriDB.put('cycles', {
          ...c,
          status: 'CLOSED',
          closedAt: new Date().toISOString()
        });
      }
    }

    const finalInitialCash = addCash + carryCash;
    const finalInitialDigital = addDigital + carryDigital;

    const nextNumber = cycles.reduce((max, c) => Math.max(max, c.cycleNumber || 0), 0) + 1;
    const todayShort = formatShortDateID(getDateISO(0));
    const finalTitle = (customTitle || '').trim() || `Kiriman #${nextNumber} (${todayShort})`;

    const newCycleId = await santriDB.add('cycles', {
      cycleNumber: nextNumber,
      title: finalTitle,
      initialCash: finalInitialCash,
      initialDigital: finalInitialDigital,
      carryOverCash: carryCash,
      carryOverDigital: carryDigital,
      carryOverFromTitle: totalCarryOver > 0 ? previousTitle : '',
      status: 'ACTIVE',
      contextFlags: contextFlags || [],
      aiNote: aiNote || 'Pembagian jatah otomatis dari SantriFlow.',
      startedAt: new Date().toISOString()
    });

    const types = ['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'];
    for (const t of types) {
      await santriDB.add('buckets', {
        cycleId: newCycleId,
        name: BUCKET_META[t].label,
        type: t,
        allocatedAmount: Math.round(Number(allocations[t]) || 0),
        spentAmount: 0,
        isLocked: t === 'EMERGENCY'
      });
    }

    setSelectedCycleId(newCycleId);
    setActiveTab('HOME');
    if (totalCarryOver > 0) {
      triggerToast(`${finalTitle} dimulai! Sisa ${formatRupiah(totalCarryOver)} otomatis digabung`);
    } else {
      triggerToast(`${finalTitle} berhasil dimulai`);
    }
  };

  const handleLoadDemoSimulation = async () => {
    await santriDB.loadDemoSimulation();
    await loadDatabase();
    if (!userSettings.userName) {
      updateUserSettings({ userName: 'Aisyah' });
    }
    setActiveTab('HOME');
    triggerToast('Contoh 3 siklus kiriman berhasil dimuat');
  };

  const handleResetAllData = async () => {
    await santriDB.clearAll();
    updateUserSettings({ userName: '' });
    await loadDatabase();
    setActiveTab('HOME');
    triggerToast('Semua data berhasil diulang dari awal');
  };

  // ============================================================================
  // SHARED STYLES (GPU-ONLY 60FPS ANIMATIONS + CUTE STATIONERY POLISH + DARK MODE)
  // ============================================================================

  const isDark = userSettings.theme === 'dark';

  const globalStyles = (
    <style>{`
      .font-heading {
        font-family: 'Nunito', sans-serif;
      }
      .tabular-nums {
        font-variant-numeric: tabular-nums;
      }
      .bg-stationery-dots {
        background-color: #FFF7FA;
        background-image: radial-gradient(#FAD2E1 1.15px, transparent 1.15px);
        background-size: 20px 20px;
      }
      .card-cute {
        background: #FFFFFF;
        border: 1.5px solid #FAD9E4;
        border-radius: 22px;
        box-shadow: 0 6px 16px -4px rgba(244, 91, 132, 0.11);
      }
      .card-hero-pink {
        background: linear-gradient(135deg, #FF85A6 0%, #F45B84 62%, #E84A76 100%);
        border: 1.5px solid rgba(255, 255, 255, 0.35);
        border-radius: 26px;
        box-shadow: 0 12px 26px -6px rgba(244, 91, 132, 0.36);
      }
      .btn-pink-pill {
        background: linear-gradient(180deg, #FF7096 0%, #F45B84 100%);
        border-radius: 9999px;
        box-shadow: 0 4px 12px rgba(244, 91, 132, 0.28);
      }
      .btn-pink-pill:hover {
        background: #E0436E;
      }
      .tactile-tap {
        transition: transform 240ms cubic-bezier(0.34, 1.65, 0.64, 1), background-color 180ms ease;
        will-change: transform;
      }
      .tactile-tap:hover {
        transform: scale(1.025) translateY(-1px);
      }
      .tactile-tap:active {
        transform: scale(0.91);
      }
      .sliding-pill-thumb {
        transition: transform 360ms cubic-bezier(0.25, 1.32, 0.45, 1);
        will-change: transform;
      }
      @keyframes popIn {
        from {
          opacity: 0;
          transform: scale(0.92);
        }
        65% {
          opacity: 1;
          transform: scale(1.03);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .animate-pop-in {
        animation: popIn 240ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes jellyPop {
        0% { transform: scale(0.90); }
        50% { transform: scale(1.06); }
        78% { transform: scale(0.98); }
        100% { transform: scale(1); }
      }
      .animate-jelly-pop {
        animation: jellyPop 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes loopyBounce {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-7px) scale(1.03); }
      }
      .animate-loopy-bounce {
        animation: loopyBounce 1.15s ease-in-out infinite;
      }
      @keyframes loopyFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-4px) rotate(2.2deg); }
      }
      .animate-loopy-float {
        animation: loopyFloat 2.4s ease-in-out infinite;
        will-change: transform;
      }
      @keyframes loopySprout {
        0%, 100% { transform: rotate(-3deg); }
        50% { transform: rotate(4deg); }
      }
      .animate-loopy-sprout {
        animation: loopySprout 2s ease-in-out infinite;
      }
      @keyframes twinklePulse {
        0%, 100% { opacity: 0.55; transform: scale(0.92); }
        50% { opacity: 1; transform: scale(1.12); }
      }
      .animate-twinkle {
        animation: twinklePulse 2s ease-in-out infinite;
      }
      @keyframes splashScaleX {
        0% { transform: scaleX(0.08); }
        55% { transform: scaleX(0.76); }
        100% { transform: scaleX(1); }
      }
      .animate-splash-bar {
        transform-origin: left;
        animation: splashScaleX 1.15s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      @keyframes wiggle {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-8deg); }
        50% { transform: rotate(8deg); }
        75% { transform: rotate(-6deg); }
      }
      .animate-wiggle {
        animation: wiggle 200ms ease-in-out;
      }
      .notebook-paper {
        background-color: #FFFFFF;
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 35px,
          #FAD9E4 35px,
          #FAD9E4 36px
        );
      }

      /* COZY BERRY NIGHT (DARK MODE OVERRIDES - ZERO BLUR, 60FPS) */
      .theme-dark.bg-stationery-dots {
        background-color: #160F13;
        background-image: radial-gradient(#35222C 1.15px, transparent 1.15px);
        background-size: 20px 20px;
      }
      .theme-dark .card-cute {
        background: #22171D;
        border-color: #3D2733;
        box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.45);
      }
      .theme-dark .card-hero-pink {
        background: linear-gradient(135deg, #D94872 0%, #B8325A 65%, #962447 100%);
        border-color: rgba(255, 182, 203, 0.25);
        box-shadow: 0 12px 26px -6px rgba(0, 0, 0, 0.55);
      }
      .theme-dark .notebook-paper {
        background-color: #22171D;
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 35px,
          #3D2733 35px,
          #3D2733 36px
        );
      }
      .theme-dark .bg-white {
        background-color: #22171D !important;
      }
      .theme-dark .bg-\\[\\#FFF8FA\\] {
        background-color: #1A1116 !important;
      }
      .theme-dark .bg-\\[\\#FFEFF4\\] {
        background-color: #331F29 !important;
      }
      .theme-dark .bg-\\[\\#E8F8F0\\] {
        background-color: #163024 !important;
      }
      .theme-dark .bg-\\[\\#F3E8FF\\] {
        background-color: #2C1D3D !important;
      }
      .theme-dark .bg-\\[\\#FEF3C7\\] {
        background-color: #362914 !important;
      }
      .theme-dark .text-\\[\\#2D1E24\\] {
        color: #FFF0F5 !important;
      }
      .theme-dark .text-\\[\\#7A5C68\\] {
        color: #C7A3B2 !important;
      }
      .theme-dark .text-\\[\\#92400E\\] {
        color: #FCD34D !important;
      }
      .theme-dark .border-\\[\\#FAD9E4\\] {
        border-color: #3D2733 !important;
      }
      .theme-dark .border-\\[\\#A7F3D0\\] {
        border-color: #22543D !important;
      }
      .theme-dark .border-\\[\\#FDE68A\\] {
        border-color: #78350F !important;
      }
      .theme-dark .divide-\\[\\#FAD9E4\\] > :not([hidden]) ~ :not([hidden]) {
        border-color: #3D2733 !important;
      }
      .theme-dark nav > div {
        background-color: #22171D !important;
        border-color: #3D2733 !important;
        box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.65) !important;
      }
      .theme-dark .btn-pink-pill.border-4 {
        border-color: #160F13 !important;
      }
    `}</style>
  );

  // ============================================================================
  // STEP 1: SPLASH / BOOT LOADING SCREEN (~1.2s GPU-ACCELERATED)
  // ============================================================================

  if (bootLoading || !dbReady) {
    return (
      <div
        className={`${isDark ? 'theme-dark' : ''} min-h-screen w-full bg-stationery-dots flex flex-col items-center justify-center px-6 text-center select-none`}
        style={{
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {globalStyles}
        <div className="animate-pop-in max-w-xs w-full flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-white border-2 border-[#FAD9E4] flex items-center justify-center mb-5 shadow-sm">
            <LoopyMascot mood="loading" className="w-28 h-28 animate-loopy-bounce" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEFF4] border border-[#FAD9E4] text-[#F45B84] font-heading font-extrabold text-xs mb-2">
            <CuteIcon name="sakura" className="w-3.5 h-3.5" />
            <span>Catatan Keuangan Santri</span>
          </span>

          <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#2D1E24] tracking-tight">
            SantriFlow Local
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#7A5C68] mt-1">
            Rapi di HP, gampang disalin ke buku tulis
          </p>

          {/* GPU-Only Loading Progress Bar (scaleX) */}
          <div className="w-48 h-2.5 rounded-full bg-white overflow-hidden mt-6 border border-[#FAD9E4]">
            <div className="h-full w-full rounded-full bg-[#F45B84] animate-splash-bar" />
          </div>
          <p className="text-[11px] text-[#7A5C68] mt-2 font-medium">
            Membuka buku kas di perangkat...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 2: INITIAL SETUP & SMART AI ALLOCATOR SCREEN (IF NO ACTIVE CYCLE)
  // ============================================================================

  if (!hasAnyActiveCycle) {
    return (
      <div
        className={`${isDark ? 'theme-dark' : ''} min-h-screen w-full bg-stationery-dots text-[#2D1E24] pb-10 selection:bg-[#FF9EB5] selection:text-white`}
        style={{
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        }}
      >
        {globalStyles}
        <InitialSetupScreen
          initialUserName={userSettings.userName}
          defaultRounding={userSettings.defaultRounding}
          nextCycleNumber={cycles.reduce((max, c) => Math.max(max, c.cycleNumber || 0), 0) + 1}
          closedCyclesHistory={closedCyclesHistory}
          onStartCycle={handleStartNewCycle}
          onLoadDemo={handleLoadDemoSimulation}
        />

        {toastMessage && (
          <div className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none">
            <div className="animate-pop-in max-w-sm w-fit px-4 py-2.5 rounded-2xl bg-[#2D1E24] border border-[#FAD9E4]/25 text-white text-xs sm:text-sm font-heading font-bold shadow-lg flex items-center gap-2 leading-snug">
              <CuteIcon name="ribbon" className="w-4 h-4 shrink-0" />
              <span className="break-words">{toastMessage}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // STEP 3: MAIN DASHBOARD & 4-TAB NAVIGATION
  // ============================================================================

  const displayUserName = (userSettings.userName || '').trim() || 'Santri';

  return (
    <div
      className={`${isDark ? 'theme-dark' : ''} min-h-screen w-full bg-stationery-dots text-[#2D1E24] pb-28 selection:bg-[#FF9EB5] selection:text-white`}
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {globalStyles}

      {/* Main Mobile-First Container */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* TOP HEADER (MOBILE-FRIENDLY TWO-ROW LAYOUT) */}
        <header className="mb-4 space-y-2">
          {/* Top Utility Row: Offline Status + Cycle Controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#FAD9E4] text-[11px] font-semibold text-[#7A5C68] min-w-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2EB872] shrink-0" />
              <span className="truncate">Offline • Tersimpan di HP</span>
            </div>

            {/* Active Cycle Pill + New Cycle / Top-Up CTA */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCycleModalDefaultTab('HISTORY');
                  setShowCycleModal(true);
                }}
                className="tactile-tap flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#FAD9E4] text-[#F45B84] font-heading font-extrabold text-xs shadow-xs"
              >
                <span className="truncate max-w-[115px] sm:max-w-[150px]">
                  {activeCycle ? activeCycle.title : 'Kiriman #1'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCycleModalDefaultTab('NEW_CYCLE');
                  setShowCycleModal(true);
                }}
                className="tactile-tap btn-pink-pill px-3 py-1.5 text-white font-heading font-extrabold text-xs flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kiriman Baru</span>
                <span className="sm:hidden">Baru</span>
              </button>
            </div>
          </div>

          {/* Full-Width Greeting Row so "Assalamu'alaikum, [Nama]!" is never truncated */}
          <div>
            <h1 className="font-heading text-xl sm:text-2xl font-black tracking-tight text-[#2D1E24] leading-snug break-words">
              <span>Assalamu&apos;alaikum, {displayUserName}!</span>
              <CuteIcon name="sakura" className="inline-block w-5 h-5 ml-1.5 -mt-1 align-middle" />
            </h1>
          </div>
        </header>

        {activeTab === 'HOME' ? (
          <HomeScreen
            activeCycle={activeCycle}
            activeBuckets={activeBuckets}
            activeTransactions={activeTransactions}
            walletSummary={walletSummary}
            heroLoopyMood={heroLoopyMood}
            lowJajanThreshold={userSettings.lowJajanThreshold}
            padlockWiggle={padlockWiggle}
            onOpenConvert={() => setShowConvertModal(true)}
            onOpenLockModal={() => setShowLockModal(true)}
            onQuickAddExpense={handleAddExpense}
            onSelectBucketForExpense={(bucketId) => {
              setExpensePreselectBucketId(bucketId);
              setShowExpenseModal(true);
            }}
            onSwitchToNotebook={(mode) => {
              setNotebookMode(mode);
              setActiveTab('NOTEBOOK');
            }}
          />
        ) : activeTab === 'NOTEBOOK' ? (
          <NotebookScreen
            mode={notebookMode}
            setMode={setNotebookMode}
            activeCycle={activeCycle}
            activeBuckets={activeBuckets}
            activeTransactions={activeTransactions}
            walletSummary={walletSummary}
            onBatchSave={handleBatchAddExpenses}
            onDeleteTx={handleDeleteTransaction}
            onToast={triggerToast}
            onReloadDB={loadDatabase}
          />
        ) : activeTab === 'HISTORY' ? (
          <HistoryScreen
            cycles={cycles}
            activeCycle={activeCycle}
            activeBuckets={activeBuckets}
            activeTransactions={activeTransactions}
            closedCyclesHistory={closedCyclesHistory}
            onSelectCycle={(id) => setSelectedCycleId(id)}
            onDeleteTx={handleDeleteTransaction}
            onOpenNewCycle={() => {
              setCycleModalDefaultTab('NEW_CYCLE');
              setShowCycleModal(true);
            }}
          />
        ) : (
          <SettingsScreen
            userSettings={userSettings}
            onUpdateSettings={updateUserSettings}
            cyclesCount={cycles.length}
            transactionsCount={transactions.length}
            onToast={triggerToast}
            onReloadDB={loadDatabase}
            onLoadDemo={handleLoadDemoSimulation}
            onResetAllData={handleResetAllData}
          />
        )}
      </div>

      {/* FLOATING BOTTOM NAVIGATION PILL (4 TABS + CENTER FAB + SLIDING PINK PILL) */}
      <nav
        aria-label="Navigasi Utama"
        className="fixed bottom-4 left-0 right-0 z-30 px-3 pointer-events-none"
      >
        <div className="max-w-md mx-auto pointer-events-auto bg-white border-[1.5px] border-[#FAD9E4] rounded-full p-1.5 shadow-[0_10px_28px_-4px_rgba(244,91,132,0.22)]">
          <div className="relative grid grid-cols-5 items-center">
            {/* GPU-Accelerated Sliding Pink Highlight Pill */}
            <div
              aria-hidden="true"
              className="sliding-pill-thumb pointer-events-none absolute inset-y-0 left-0 w-1/5 p-0.5"
              style={{
                transform:
                  activeTab === 'HOME'
                    ? 'translateX(0%)'
                    : activeTab === 'NOTEBOOK'
                    ? 'translateX(100%)'
                    : activeTab === 'HISTORY'
                    ? 'translateX(300%)'
                    : 'translateX(400%)'
              }}
            >
              <div className="w-full h-full rounded-full bg-[#FFEFF4] border border-[#F45B84]/40 shadow-xs" />
            </div>

            {/* Tab 1: Pos & Saldo */}
            <button
              type="button"
              onClick={() => setActiveTab('HOME')}
              className={`tactile-tap relative z-10 flex flex-col items-center justify-center py-1.5 rounded-full text-[10px] font-heading font-extrabold transition-colors duration-200 ${
                activeTab === 'HOME'
                  ? 'text-[#F45B84]'
                  : 'text-[#7A5C68] hover:text-[#2D1E24]'
              }`}
            >
              <Home
                className={`w-4 h-4 mb-0.5 transition-transform duration-300 ${
                  activeTab === 'HOME' ? 'scale-110 -translate-y-0.5' : 'scale-100'
                }`}
              />
              <span>Pos</span>
            </button>

            {/* Tab 2: Salin Buku */}
            <button
              type="button"
              onClick={() => setActiveTab('NOTEBOOK')}
              className={`tactile-tap relative z-10 flex flex-col items-center justify-center py-1.5 rounded-full text-[10px] font-heading font-extrabold transition-colors duration-200 ${
                activeTab === 'NOTEBOOK'
                  ? 'text-[#F45B84]'
                  : 'text-[#7A5C68] hover:text-[#2D1E24]'
              }`}
            >
              <BookOpen
                className={`w-4 h-4 mb-0.5 transition-transform duration-300 ${
                  activeTab === 'NOTEBOOK' ? 'scale-110 -translate-y-0.5' : 'scale-100'
                }`}
              />
              <span>Buku</span>
            </button>

            {/* Center FAB: Catat Pengeluaran */}
            <div className="relative z-10 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setExpensePreselectBucketId(null);
                  setShowExpenseModal(true);
                }}
                aria-label="Catat Pengeluaran"
                className="tactile-tap btn-pink-pill -mt-6 w-12 h-12 px-3 py-3 flex items-center justify-center text-white border-4 border-[#FFF8FA] shrink-0"
              >
                <Plus className="w-5 h-5 stroke-[2.75]" />
              </button>
            </div>

            {/* Tab 3: Riwayat & Siklus */}
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`tactile-tap relative z-10 flex flex-col items-center justify-center py-1.5 rounded-full text-[10px] font-heading font-extrabold transition-colors duration-200 ${
                activeTab === 'HISTORY'
                  ? 'text-[#F45B84]'
                  : 'text-[#7A5C68] hover:text-[#2D1E24]'
              }`}
            >
              <History
                className={`w-4 h-4 mb-0.5 transition-transform duration-300 ${
                  activeTab === 'HISTORY' ? 'scale-110 -translate-y-0.5' : 'scale-100'
                }`}
              />
              <span>Riwayat</span>
            </button>

            {/* Tab 4: Pengaturan */}
            <button
              type="button"
              onClick={() => setActiveTab('SETTINGS')}
              className={`tactile-tap relative z-10 flex flex-col items-center justify-center py-1.5 rounded-full text-[10px] font-heading font-extrabold transition-colors duration-200 ${
                activeTab === 'SETTINGS'
                  ? 'text-[#F45B84]'
                  : 'text-[#7A5C68] hover:text-[#2D1E24]'
              }`}
            >
              <Settings
                className={`w-4 h-4 mb-0.5 transition-transform duration-300 ${
                  activeTab === 'SETTINGS' ? 'scale-110 -translate-y-0.5' : 'scale-100'
                }`}
              />
              <span>Atur</span>
            </button>
          </div>
        </div>
      </nav>

      {/* TOAST FEEDBACK POP-UP */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="animate-pop-in max-w-sm w-fit px-4 py-2.5 rounded-2xl bg-[#2D1E24] border border-[#FAD9E4]/25 text-white text-xs sm:text-sm font-heading font-bold shadow-lg flex items-center gap-2 leading-snug">
            <CuteIcon name="ribbon" className="w-4 h-4 shrink-0" />
            <span className="break-words">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MODAL 1: QUICK EXPENSE + SMART NLP PARSER */}
      {showExpenseModal && (
        <QuickExpenseModal
          buckets={activeBuckets}
          walletSummary={walletSummary}
          preselectedBucketId={expensePreselectBucketId}
          onClose={() => setShowExpenseModal(false)}
          onSubmit={async (payload) => {
            await handleAddExpense(payload);
            setShowExpenseModal(false);
          }}
          onOpenLockModal={() => {
            setShowExpenseModal(false);
            setShowLockModal(true);
          }}
        />
      )}

      {/* MODAL 2: FLEXIBLE LOCK / UNLOCK DANA DARURAT */}
      {showLockModal && (
        <EmergencyLockModal
          emergencyBucket={activeBuckets.find((b) => b.type === 'EMERGENCY')}
          lifestyleBucket={activeBuckets.find((b) => b.type === 'LIFESTYLE')}
          onClose={() => setShowLockModal(false)}
          onConfirm={async (payload) => {
            await handleUpdateEmergencyLock(payload);
            setShowLockModal(false);
          }}
        />
      )}

      {/* MODAL 3: CYCLE SWITCHER, NEW CYCLE (AI ALLOCATOR) & TOP-UP */}
      {showCycleModal && (
        <CycleManagerModal
          initialTab={cycleModalDefaultTab}
          cycles={cycles}
          activeCycle={activeCycle}
          walletSummary={walletSummary}
          closedCyclesHistory={closedCyclesHistory}
          onSelectCycle={(id) => {
            setSelectedCycleId(id);
            setShowCycleModal(false);
          }}
          onClose={() => setShowCycleModal(false)}
          onCreateOrTopUp={async (payload) => {
            await handleStartNewCycle(payload);
            setShowCycleModal(false);
          }}
          onResetDemo={async () => {
            await handleLoadDemoSimulation();
            setShowCycleModal(false);
          }}
        />
      )}

      {/* MODAL 4: TARIK TUNAI / TOP-UP WALLET CONVERTER */}
      {showConvertModal && (
        <WalletConvertModal
          walletSummary={walletSummary}
          onClose={() => setShowConvertModal(false)}
          onConfirm={async (payload) => {
            await handleConvertWallet(payload);
            setShowConvertModal(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// INITIAL SETUP SCREEN: SMART LOCAL AI ALLOCATOR (STEP 2 ON FIRST BOOT)
// ============================================================================

function InitialSetupScreen({
  initialUserName = '',
  defaultRounding = 1000,
  nextCycleNumber = 1,
  closedCyclesHistory = [],
  onStartCycle,
  onLoadDemo
}) {
  const defaultTitle = `Kiriman #${nextCycleNumber} (${formatShortDateID(getDateISO(0))})`;

  const [userName, setUserName] = useState(initialUserName);
  const [cycleTitle, setCycleTitle] = useState(defaultTitle);
  const [cashInput, setCashInput] = useState('100000');
  const [digitalInput, setDigitalInput] = useState('150000');
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [roundingStep, setRoundingStep] = useState(defaultRounding);
  const [manualAdjustments, setManualAdjustments] = useState({
    MANDATORY: 0,
    ACADEMIC: 0,
    EMERGENCY: 0,
    LIFESTYLE: 0
  });

  const totalFunds = useMemo(() => {
    return (
      Math.max(0, Math.round(Number(cashInput) || 0)) +
      Math.max(0, Math.round(Number(digitalInput) || 0))
    );
  }, [cashInput, digitalInput]);

  // Reset manual fine-tuning adjustments when inputs or checklist change
  useEffect(() => {
    setManualAdjustments({ MANDATORY: 0, ACADEMIC: 0, EMERGENCY: 0, LIFESTYLE: 0 });
  }, [totalFunds, selectedFlags, roundingStep]);

  const baseAiResult = useMemo(() => {
    return calculateSmartAllocation(
      totalFunds,
      selectedFlags,
      closedCyclesHistory,
      roundingStep
    );
  }, [totalFunds, selectedFlags, closedCyclesHistory, roundingStep]);

  // Combine AI allocation + user fine-tuning adjustments (-5rb / +5rb)
  const finalAllocations = useMemo(() => {
    const res = {};
    ['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'].forEach((k) => {
      res[k] = Math.max(0, (baseAiResult.allocations[k] || 0) + (manualAdjustments[k] || 0));
    });
    return res;
  }, [baseAiResult.allocations, manualAdjustments]);

  const handleFineTune = (bucketType, delta) => {
    if (totalFunds <= 0) return;
    const step = 5000;
    const change = delta > 0 ? step : -step;
    const currentVal = finalAllocations[bucketType] || 0;

    if (change < 0 && currentVal < step) return;

    // Balance with LIFESTYLE (or MANDATORY if tuning LIFESTYLE) so total stays exact
    const partnerType = bucketType === 'LIFESTYLE' ? 'MANDATORY' : 'LIFESTYLE';
    const partnerVal = finalAllocations[partnerType] || 0;

    if (change > 0 && partnerVal < step) return;

    setManualAdjustments((prev) => ({
      ...prev,
      [bucketType]: (prev[bucketType] || 0) + change,
      [partnerType]: (prev[partnerType] || 0) - change
    }));
  };

  const toggleFlag = (id) => {
    setSelectedFlags((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (totalFunds <= 0 || !userName.trim()) return;
    onStartCycle({
      mode: 'NEW_CYCLE',
      userNameInput: userName.trim(),
      customTitle: cycleTitle,
      cashInput: Number(cashInput) || 0,
      digitalInput: Number(digitalInput) || 0,
      carryOver: false,
      contextFlags: selectedFlags,
      allocations: finalAllocations,
      aiNote: baseAiResult.aiNote
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 animate-pop-in">
      {/* Top Bar with Optional Demo Simulation Button */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#FAD9E4] text-[#F45B84] font-heading font-extrabold text-xs">
          <CuteIcon name="sparkle" className="w-3.5 h-3.5" />
          <span>Atur Uang Kiriman</span>
        </span>
        <button
          type="button"
          onClick={onLoadDemo}
          className="tactile-tap px-3 py-1.5 rounded-full bg-white border border-[#FAD9E4] text-[#7A5C68] hover:text-[#F45B84] font-heading font-extrabold text-xs"
        >
          Muat Contoh Simulasi
        </button>
      </div>

      {/* Welcome Banner with Loopy */}
      <section className="card-hero-pink p-5 text-white relative overflow-hidden mb-4">
        <div className="pr-24 relative z-10">
          <h1 className="font-heading text-xl sm:text-2xl font-black leading-tight flex items-center gap-1.5">
            <span>Atur Kiriman Pertama Yuk!</span>
          </h1>
          <p className="text-xs text-white/95 mt-1 leading-relaxed">
            Pisahkan uang <strong>Cash</strong> dan <strong>Digital</strong>, lalu pembagian jatah
            4 pos akan dihitung otomatis agar rapi disalin ke buku kas.
          </p>
        </div>
        <div className="pointer-events-none absolute right-2 -bottom-1">
          <LoopyMascot mood="happy" className="w-24 h-24 animate-loopy-float" />
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* INPUT 1: NAMA PANGGILAN & IDENTITAS SIKLUS */}
        <section className="card-cute p-4 space-y-3">
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#F45B84] uppercase tracking-wider mb-1.5">
              1. Nama Panggilanmu
            </label>
            <input
              type="text"
              required
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Contoh: Nuzulin, Nur, atau Ladayka..."
              className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2.5 font-heading font-extrabold text-sm text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
            />
          </div>

          <div>
            <label className="block text-xs font-heading font-extrabold text-[#F45B84] uppercase tracking-wider mb-1.5">
              2. Nama Catatan Kiriman
            </label>
            <input
              type="text"
              required
              value={cycleTitle}
              onChange={(e) => setCycleTitle(e.target.value)}
              placeholder="Contoh: Kiriman #1 (23 Nov)"
              className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2.5 font-heading font-extrabold text-sm text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
            />
          </div>
        </section>

        {/* INPUT 2: DUAL-WALLET AWAL (CASH vs DIGITAL) */}
        <section className="card-cute p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-extrabold text-[#F45B84] uppercase tracking-wider">
              3. Uang yang Dipegang (Cash &amp; Digital)
            </span>
          </div>

          {/* Cash Input + Quick Chips */}
          <div className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-heading font-extrabold text-[#2D1E24] flex items-center gap-1.5">
                <CuteIcon name="cash" className="w-4 h-4" />
                <span>Uang Tunai (Cash di Dompet)</span>
              </label>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              className="w-full rounded-xl bg-white border border-[#FAD9E4] px-3 py-2 font-heading font-black text-base text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
            />
            <div className="flex items-center gap-1.5 mt-2">
              {[50000, 100000, 250000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCashInput(String((Number(cashInput) || 0) + chip))}
                  className="tactile-tap px-2.5 py-1 rounded-full bg-[#FFEFF4] text-[#F45B84] text-[11px] font-heading font-extrabold tabular-nums"
                >
                  +{chip / 1000}rb
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashInput('0')}
                className="tactile-tap ml-auto px-2 py-1 text-[11px] font-bold text-[#7A5C68]"
              >
                Nolkan
              </button>
            </div>
          </div>

          {/* Digital Input + Quick Chips */}
          <div className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-heading font-extrabold text-[#2D1E24] flex items-center gap-1.5">
                <CuteIcon name="digital" className="w-4 h-4" />
                <span>Saldo Digital (E-Wallet / QRIS)</span>
              </label>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              value={digitalInput}
              onChange={(e) => setDigitalInput(e.target.value)}
              className="w-full rounded-xl bg-white border border-[#FAD9E4] px-3 py-2 font-heading font-black text-base text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
            />
            <div className="flex items-center gap-1.5 mt-2">
              {[50000, 100000, 250000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setDigitalInput(String((Number(digitalInput) || 0) + chip))}
                  className="tactile-tap px-2.5 py-1 rounded-full bg-[#FFEFF4] text-[#F45B84] text-[11px] font-heading font-extrabold tabular-nums"
                >
                  +{chip / 1000}rb
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDigitalInput('0')}
                className="tactile-tap ml-auto px-2 py-1 text-[11px] font-bold text-[#7A5C68]"
              >
                Nolkan
              </button>
            </div>
          </div>

          {/* Real-Time Total Dana Siklus */}
          <div className="rounded-2xl bg-[#FFEFF4] border border-[#FAD9E4] px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-xs font-heading font-extrabold text-[#7A5C68]">
              Jumlah Uang Kiriman
            </span>
            <span className="font-heading font-black text-lg text-[#F45B84] tabular-nums">
              {formatRupiah(totalFunds)}
            </span>
          </div>
        </section>

        {/* INPUT 3: CHECKLIST KONDISI SANTRI + PEMBULATAN */}
        <section className="card-cute p-4 space-y-3">
          <div>
            <span className="block text-xs font-heading font-extrabold text-[#F45B84] uppercase tracking-wider">
              4. Keadaanmu Minggu Ini
            </span>
            <p className="text-[11px] text-[#7A5C68] mt-0.5">
              Pilih keadaanmu saat ini supaya pembagian jatah tiap pos lebih pas:
            </p>
          </div>

          <div className="space-y-1.5">
            {CONTEXT_OPTIONS.map((opt) => {
              const checked = selectedFlags.includes(opt.id);
              return (
                <button
                  key={`${opt.id}-${checked}`}
                  type="button"
                  onClick={() => toggleFlag(opt.id)}
                  className={`tactile-tap w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-2.5 ${
                    checked
                      ? 'animate-jelly-pop bg-[#FFEFF4] border-[#F45B84] text-[#2D1E24]'
                      : 'bg-[#FFF8FA] border-[#FAD9E4] text-[#7A5C68]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#FAD9E4] flex items-center justify-center shrink-0">
                      <CuteIcon name={opt.iconName} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-heading font-extrabold">{opt.label}</div>
                      <div className="text-[10px] opacity-80">{opt.hint}</div>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      checked ? 'bg-[#F45B84] text-white' : 'border border-[#FAD9E4] bg-white'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rounding Preference for Notebook */}
          <div className="pt-1">
            <span className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
              Pembulatan Angka untuk Buku Tulis:
            </span>
            <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
              <div
                aria-hidden="true"
                className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#F45B84] shadow-xs"
                style={{
                  transform: roundingStep === 1000 ? 'translateX(0%)' : 'translateX(100%)'
                }}
              />
              {[1000, 500].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setRoundingStep(step)}
                  className={`tactile-tap relative z-10 py-2 px-3 rounded-full text-xs font-heading font-extrabold transition-colors duration-200 ${
                    roundingStep === step ? 'text-white' : 'text-[#7A5C68]'
                  }`}
                >
                  Kelipatan {formatRupiah(step)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* PANEL LIVE PREVIEW KALKULASI JATAH */}
        <section className="card-cute p-4 space-y-3 border-[#F45B84]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-extrabold text-[#F45B84] flex items-center gap-1.5">
              <CuteIcon name="sparkle" className="w-4 h-4" />
              <span>Rincian Pembagian Uang Jatah</span>
            </span>
            <span className="text-[11px] font-bold text-[#7A5C68] tabular-nums">
              {totalFunds > 0 ? 'Bisa diubah ±5rb' : 'Isi nominal dulu'}
            </span>
          </div>

          <div className="space-y-2">
            {['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'].map((type) => {
              const meta = BUCKET_META[type];
              const IconComp = meta.icon;
              const val = finalAllocations[type] || 0;
              const pct = totalFunds > 0 ? Math.round((val / totalFunds) * 100) : 0;

              return (
                <div
                  key={type}
                  className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: meta.bgSoft, color: meta.accent }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-extrabold text-xs text-[#2D1E24] flex items-center gap-1 truncate">
                        <span>{meta.label}</span>
                        {type === 'EMERGENCY' && <Lock className="w-3 h-3 text-[#9D4EDD] shrink-0" />}
                      </div>
                      <div className="text-[10px] text-[#7A5C68] tabular-nums">
                        Bagian {pct}%
                      </div>
                    </div>
                  </div>

                  {/* Fine-tune -5rb / +5rb */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFineTune(type, -1)}
                      disabled={totalFunds <= 0}
                      className="tactile-tap px-2 py-1 rounded-full bg-white border border-[#FAD9E4] text-[11px] font-heading font-extrabold text-[#7A5C68] disabled:opacity-40"
                    >
                      -5rb
                    </button>
                    <span className="font-heading font-black text-xs sm:text-sm text-[#2D1E24] tabular-nums min-w-[74px] text-right">
                      {formatRupiah(val)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFineTune(type, 1)}
                      disabled={totalFunds <= 0}
                      className="tactile-tap px-2 py-1 rounded-full bg-[#FFEFF4] border border-[#FAD9E4] text-[11px] font-heading font-extrabold text-[#F45B84] disabled:opacity-40"
                    >
                      +5rb
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Natural Indonesian Explanation Note */}
          <div className="rounded-2xl bg-[#FFEFF4] px-3 py-2.5 flex items-start gap-2 text-xs text-[#7A5C68]">
            <Info className="w-4 h-4 text-[#F45B84] shrink-0 mt-0.5" />
            <p className="leading-snug">{baseAiResult.aiNote}</p>
          </div>
        </section>

        {/* PRIMARY CTA */}
        <button
          type="submit"
          disabled={totalFunds <= 0 || !userName.trim()}
          className="tactile-tap btn-pink-pill w-full py-3.5 px-5 text-white font-heading font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>Mulai Kiriman &amp; Simpan ke Buku Kas</span>
          <CuteIcon name="sakura" className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// SCREEN 1: BERANDA (POS & SALDO + INLINE NLP QUICK-PARSER)
// ============================================================================

function HomeScreen({
  activeCycle,
  activeBuckets,
  activeTransactions,
  walletSummary,
  heroLoopyMood,
  lowJajanThreshold = 20,
  padlockWiggle,
  onOpenConvert,
  onOpenLockModal,
  onQuickAddExpense,
  onSelectBucketForExpense,
  onSwitchToNotebook
}) {
  const [quickNlp, setQuickNlp] = useState('');

  const parsedQuick = useMemo(() => parseQuickExpense(quickNlp), [quickNlp]);

  const matchedQuickBucket = useMemo(() => {
    if (!activeBuckets.length) return null;
    if (parsedQuick?.bucketType) {
      const found = activeBuckets.find(
        (b) => b.type === parsedQuick.bucketType && !b.isLocked
      );
      if (found) return found;
    }
    return (
      activeBuckets.find((b) => b.type === 'LIFESTYLE' && !b.isLocked) ||
      activeBuckets.find((b) => !b.isLocked) ||
      null
    );
  }, [parsedQuick, activeBuckets]);

  const handleInlineQuickSubmit = async (e) => {
    e.preventDefault();
    if (!parsedQuick || parsedQuick.amount <= 0 || !matchedQuickBucket) return;
    await onQuickAddExpense({
      bucketId: matchedQuickBucket.id,
      walletSource: parsedQuick.walletSource || 'CASH',
      amount: parsedQuick.amount,
      description: parsedQuick.description || matchedQuickBucket.name,
      date: getDateISO(0)
    });
    setQuickNlp('');
  };

  const jajanBucket = activeBuckets.find((b) => b.type === 'LIFESTYLE');
  const warnRatio = (Number(lowJajanThreshold) || 20) / 100;
  const isJajanLow =
    jajanBucket &&
    jajanBucket.allocatedAmount > 0 &&
    (jajanBucket.allocatedAmount - jajanBucket.spentAmount) / jajanBucket.allocatedAmount < warnRatio;

  const carryOverTotal =
    (Number(activeCycle?.carryOverCash) || 0) + (Number(activeCycle?.carryOverDigital) || 0);

  return (
    <div className="space-y-4">
      {/* HERO BALANCE CARD (Pink Gradient + Cute Peeking Loopy in Top-Right) */}
      <section className="card-hero-pink relative overflow-hidden p-5 text-white">
        {/* Soft Decorative Circles (GPU friendly static shapes) */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-36 h-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-12 right-12 w-32 h-32 rounded-full bg-white/10" />

        <div className="relative z-10 pr-24">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
              Total Sisa Uang
            </span>
            {walletSummary.surplusRatio > 0.5 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/25 text-[11px] font-heading font-bold">
                <CuteIcon name="cool" className="w-3.5 h-3.5" />
                <span>Masih Banyak</span>
              </span>
            ) : isJajanLow ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-heading font-bold">
                <CuteIcon name="sweat" className="w-3.5 h-3.5" />
                <span>Jajan Menipis</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/25 text-[11px] font-heading font-bold">
                <CuteIcon name="sakura" className="w-3.5 h-3.5" />
                <span>Aman Terjaga</span>
              </span>
            )}
          </div>

          <div className="font-heading text-3xl sm:text-4xl font-black tracking-tight tabular-nums leading-tight">
            {formatRupiah(walletSummary.total)}
          </div>
          <p className="text-xs text-white/90 mt-0.5 tabular-nums">
            Dari total uang {formatRupiah(walletSummary.initialTotal)}
          </p>

          {carryOverTotal > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-heading font-bold tabular-nums">
              <CuteIcon name="coin" className="w-3.5 h-3.5" />
              <span>Termasuk sisa kiriman lalu +{formatRupiah(carryOverTotal)}</span>
            </div>
          )}
        </div>

        {/* Cute Floating Loopy Companion in Top-Right Corner */}
        <div className="pointer-events-none absolute right-2 top-1.5 z-10">
          <div className="relative">
            <div className="animate-twinkle absolute -left-2 top-2">
              <CuteIcon name="sparkle" className="w-4 h-4" />
            </div>
            <LoopyMascot
              mood={heroLoopyMood}
              className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-sm animate-loopy-float"
            />
          </div>
        </div>

        {/* Dual-Wallet Pills: Cash vs Digital */}
        <div className="relative z-10 grid grid-cols-2 gap-2.5 mt-4">
          <div className="rounded-2xl bg-white/20 border border-white/25 px-3 py-2">
            <div className="text-[11px] font-semibold text-white/95 flex items-center gap-1.5">
              <CuteIcon name="cash" className="w-4 h-4" />
              <span>Cash (Dompet)</span>
            </div>
            <div className="font-heading font-extrabold text-sm sm:text-base tabular-nums mt-0.5">
              {formatRupiah(walletSummary.cash)}
            </div>
          </div>

          <div className="rounded-2xl bg-white/20 border border-white/25 px-3 py-2">
            <div className="text-[11px] font-semibold text-white/95 flex items-center gap-1.5">
              <CuteIcon name="digital" className="w-4 h-4" />
              <span>Digital (QRIS)</span>
            </div>
            <div className="font-heading font-extrabold text-sm sm:text-base tabular-nums mt-0.5">
              {formatRupiah(walletSummary.digital)}
            </div>
          </div>
        </div>

        {/* Compact Tarik Tunai / Top-Up Action */}
        <div className="relative z-10 mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenConvert}
            className="tactile-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#F45B84] font-heading font-extrabold text-xs shadow-sm"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Tarik Tunai / Isi Digital</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchToNotebook('BATCH')}
            className="tactile-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white font-heading font-bold text-xs"
          >
            <CuteIcon name="notebook" className="w-3.5 h-3.5" />
            <span>Salin dari Buku</span>
          </button>
        </div>
      </section>

      {/* INLINE QUICK-PARSER BAR (1-CLICK CASUAL EXPENSE INPUT) */}
      <section className="card-cute p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-heading font-extrabold text-[#F45B84] flex items-center gap-1.5">
            <CuteIcon name="bolt" className="w-4 h-4" />
            <span>Catat Cepat (Tulis Seperti di Buku)</span>
          </label>
          <span className="text-[10px] font-semibold text-[#7A5C68]">Otomatis terpilah</span>
        </div>

        <form onSubmit={handleInlineQuickSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={quickNlp}
            onChange={(e) => setQuickNlp(e.target.value)}
            placeholder='Contoh: "15rb bakso kantin cash"...'
            className="flex-1 min-w-0 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2 text-xs sm:text-sm text-[#2D1E24] placeholder:text-[#7A5C68]/60 focus:outline-none focus:border-[#F45B84]"
          />
          <button
            type="submit"
            disabled={!parsedQuick || parsedQuick.amount <= 0}
            className="tactile-tap btn-pink-pill px-4 py-2 text-white font-heading font-extrabold text-xs shrink-0 disabled:opacity-45"
          >
            Simpan
          </button>
        </form>

        {/* Live Detection Preview */}
        {parsedQuick && parsedQuick.amount > 0 && (
          <div className="animate-pop-in flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-[#E8F8F0] text-[#2EB872] font-heading font-extrabold tabular-nums">
              {formatRupiah(parsedQuick.amount)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#FFEFF4] text-[#F45B84] font-heading font-bold">
              {parsedQuick.description || 'Pengeluaran'}
            </span>
            {matchedQuickBucket && (
              <span className="px-2 py-0.5 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] text-[#2D1E24] font-semibold">
                Pos: {BUCKET_META[matchedQuickBucket.type]?.shortLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] text-[#7A5C68] font-semibold">
              <CuteIcon
                name={parsedQuick.walletSource === 'DIGITAL' ? 'digital' : 'cash'}
                className="w-3 h-3"
              />
              <span>{parsedQuick.walletSource === 'DIGITAL' ? 'Digital' : 'Cash'}</span>
            </span>
          </div>
        )}
      </section>

      {/* LOOPY STATUS BANNER (Contextual Tip) */}
      {isJajanLow ? (
        <div className="rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#92400E]">
          <CuteIcon name="sweat" className="w-5 h-5 shrink-0" />
          <p className="font-medium leading-snug">
            <strong className="font-heading font-extrabold">Pesan Loopy:</strong>{' '}
            &ldquo;Pelan-pelan jajannya ya~ Sisa jatah Jajan &amp; Kantin tinggal sedikit.&rdquo;
          </p>
        </div>
      ) : activeCycle?.aiNote ? (
        <div className="rounded-2xl bg-white border border-[#FAD9E4] px-3.5 py-2.5 flex items-start gap-2 text-xs text-[#7A5C68]">
          <CuteIcon name="sparkle" className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-snug">{activeCycle.aiNote}</p>
        </div>
      ) : null}

      {/* SECTION HEADER: 4 POS ANGGARAN */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="font-heading font-extrabold text-base text-[#2D1E24]">
          4 Pos Jatah Uang
        </h2>
        <span className="text-[11px] font-semibold text-[#7A5C68]">Ketuk pos untuk catat</span>
      </div>

      {/* 2x2 GRID VIRTUAL BUCKETS */}
      <section className="grid grid-cols-2 gap-3">
        {activeBuckets.map((bucket) => {
          const meta = BUCKET_META[bucket.type] || BUCKET_META.LIFESTYLE;
          const IconComp = meta.icon;
          const remaining = Math.max(0, (bucket.allocatedAmount || 0) - (bucket.spentAmount || 0));
          const ratio =
            bucket.allocatedAmount > 0
              ? Math.min(1, Math.max(0, remaining / bucket.allocatedAmount))
              : 0;

          const isEmergency = bucket.type === 'EMERGENCY';
          const isLocked = isEmergency && bucket.isLocked;
          const isLow = !isLocked && bucket.allocatedAmount > 0 && ratio < 0.2;

          // Progress bar fill color
          let barColor = '#F45B84';
          if (isLocked) barColor = '#9D4EDD';
          else if (isLow) barColor = '#F59E0B';
          else if (ratio >= 0.5) barColor = '#2EB872';

          return (
            <div
              key={bucket.id}
              onClick={() => {
                if (isLocked) {
                  onOpenLockModal();
                } else {
                  onSelectBucketForExpense(bucket.id);
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  isLocked ? onOpenLockModal() : onSelectBucketForExpense(bucket.id);
                }
              }}
              className="card-cute tactile-tap p-3.5 cursor-pointer flex flex-col justify-between text-left select-none relative overflow-hidden"
            >
              {/* Cute Pastel Top Ribbon Strip */}
              <div
                className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 opacity-75"
                style={{ backgroundColor: meta.accent }}
              />

              <div className="pt-0.5">
                {/* Top Row: Category Icon + Status / Padlock */}
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: meta.bgSoft, color: meta.accent }}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>

                  {isEmergency ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLockModal();
                      }}
                      aria-label={isLocked ? 'Buka Kunci Dana Darurat' : 'Kunci Dana Darurat'}
                      className={`tactile-tap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-heading font-extrabold ${
                        padlockWiggle ? 'animate-wiggle' : ''
                      } ${
                        isLocked
                          ? 'bg-[#F3E8FF] text-[#9D4EDD]'
                          : 'bg-[#E8F8F0] text-[#2EB872]'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-3 h-3" />
                          <span>Terkunci</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Terbuka</span>
                        </>
                      )}
                    </button>
                  ) : isLow ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#F59E0B] text-[10px] font-heading font-extrabold">
                      Menipis
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#E8F8F0] text-[#2EB872] text-[10px] font-heading font-extrabold">
                      Aman
                    </span>
                  )}
                </div>

                {/* Bucket Title & Subtitle */}
                <h3 className="font-heading font-extrabold text-sm text-[#2D1E24] leading-tight">
                  {bucket.name}
                </h3>
                <p className="text-[11px] text-[#7A5C68] line-clamp-1 mt-0.5">{meta.subtitle}</p>
              </div>

              {/* Bottom: Remaining Rupiah + GPU scaleX Progress Bar */}
              <div className="mt-3">
                <div className="font-heading font-black text-base sm:text-lg text-[#2D1E24] tabular-nums">
                  {formatRupiah(remaining)}
                </div>
                <div className="text-[11px] text-[#7A5C68] tabular-nums mb-1.5">
                  dari {formatRupiah(bucket.allocatedAmount)}
                </div>

                {/* GPU-Only Progress Bar (scaleX with origin-left) */}
                <div className="h-2 w-full rounded-full bg-[#FFEFF4] overflow-hidden">
                  <div
                    className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                    style={{
                      backgroundColor: barColor,
                      transform: `scaleX(${ratio})`
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* RECENT TRANSACTIONS PREVIEW CARD */}
      <section className="card-cute p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">
            Catatan Terbaru
          </h3>
          <button
            type="button"
            onClick={() => onSwitchToNotebook('SUMMARY')}
            className="text-xs font-heading font-extrabold text-[#F45B84] hover:underline"
          >
            Lihat Buku Kas →
          </button>
        </div>

        {activeTransactions.length === 0 ? (
          <div className="py-4 text-center">
            <LoopyMascot mood="notebook" className="w-16 h-16 mx-auto mb-1" />
            <p className="text-xs text-[#7A5C68]">
              Belum ada catatan pengeluaran di kiriman ini. Tekan tombol <strong>+</strong> di
              bawah untuk mulai mencatat!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#FAD9E4]">
            {activeTransactions.slice(0, 4).map((tx) => {
              const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
              const meta = bObj ? BUCKET_META[bObj.type] : null;
              const isConvert = tx.type === 'CONVERT_WALLET';

              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-[#2D1E24] truncate">
                      {tx.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#7A5C68]">
                      <span>{formatShortDateID(tx.date)}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-[#FFEFF4] text-[#F45B84] font-semibold">
                        {isConvert ? 'Pindah Saldo' : meta?.shortLabel || 'Pos'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <CuteIcon
                          name={tx.walletSource === 'CASH' ? 'cash' : 'digital'}
                          className="w-3 h-3"
                        />
                        <span>{tx.walletSource === 'CASH' ? 'Cash' : 'Digital'}</span>
                      </span>
                    </div>
                  </div>
                  <div
                    className={`font-heading font-extrabold text-xs sm:text-sm tabular-nums shrink-0 ${
                      isConvert ? 'text-[#4F7DF3]' : 'text-[#2D1E24]'
                    }`}
                  >
                    {isConvert ? formatRupiah(tx.amount) : `-${formatRupiah(tx.amount)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// SCREEN 3: RIWAYAT & ARSIP SIKLUS (TAB 3)
// ============================================================================

function HistoryScreen({
  cycles,
  activeCycle,
  activeBuckets,
  activeTransactions,
  closedCyclesHistory,
  onSelectCycle,
  onDeleteTx,
  onOpenNewCycle
}) {
  const [walletFilter, setWalletFilter] = useState('ALL'); // 'ALL' | 'CASH' | 'DIGITAL'
  const [bucketFilter, setBucketFilter] = useState('ALL'); // 'ALL' | 'MANDATORY' | 'ACADEMIC' | 'EMERGENCY' | 'LIFESTYLE'

  const filteredTransactions = useMemo(() => {
    return activeTransactions.filter((tx) => {
      if (walletFilter !== 'ALL' && tx.walletSource !== walletFilter) return false;
      if (bucketFilter !== 'ALL') {
        if (tx.type === 'CONVERT_WALLET') return false;
        const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
        if (!bObj || bObj.type !== bucketFilter) return false;
      }
      return true;
    });
  }, [activeTransactions, walletFilter, bucketFilter, activeBuckets]);

  // Group transactions by date
  const groupedByDate = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach((tx) => {
      const d = tx.date || 'Lainnya';
      if (!groups[d]) groups[d] = [];
      groups[d].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const formatGroupDateHeading = (dateStr) => {
    if (dateStr === getDateISO(0)) return `Hari Ini (${formatShortDateID(dateStr)})`;
    if (dateStr === getDateISO(-1)) return `Kemarin (${formatShortDateID(dateStr)})`;
    return formatShortDateID(dateStr);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <section className="card-cute p-4 flex items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFEFF4] text-[#F45B84] text-[11px] font-heading font-extrabold mb-1">
            Arsip &amp; Riwayat
          </span>
          <h2 className="font-heading font-black text-lg text-[#2D1E24] leading-tight">
            Catatan &amp; Arsip Kiriman
          </h2>
          <p className="text-xs text-[#7A5C68] mt-0.5">
            {closedCyclesHistory.length > 0
              ? `Sudah ada ${closedCyclesHistory.length} kiriman selesai yang menjadi acuan pembagian berikutnya.`
              : 'Setiap kiriman yang selesai akan tersimpan rapi sebagai arsip dan acuan pembagian berikutnya.'}
          </p>
        </div>
        <LoopyMascot mood="happy" className="w-16 h-16 shrink-0" />
      </section>

      {/* Filter Pills */}
      <section className="card-cute p-3.5 space-y-2.5">
        <div className="relative grid grid-cols-3 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
          <div
            aria-hidden="true"
            className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-full bg-[#F45B84] shadow-xs"
            style={{
              transform:
                walletFilter === 'ALL'
                  ? 'translateX(0%)'
                  : walletFilter === 'CASH'
                  ? 'translateX(100%)'
                  : 'translateX(200%)'
            }}
          />
          {[
            { id: 'ALL', label: 'Semua', iconName: null },
            { id: 'CASH', label: 'Cash', iconName: 'cash' },
            { id: 'DIGITAL', label: 'Digital', iconName: 'digital' }
          ].map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWalletFilter(w.id)}
              className={`tactile-tap relative z-10 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full text-xs font-heading font-extrabold whitespace-nowrap transition-colors duration-200 ${
                walletFilter === w.id ? 'text-white' : 'text-[#7A5C68]'
              }`}
            >
              {w.iconName && <CuteIcon name={w.iconName} className="w-3.5 h-3.5" />}
              <span>{w.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            key={`ALL-${bucketFilter === 'ALL'}`}
            type="button"
            onClick={() => setBucketFilter('ALL')}
            className={`tactile-tap px-2.5 py-1 rounded-full text-[11px] font-heading font-extrabold whitespace-nowrap ${
              bucketFilter === 'ALL'
                ? 'animate-jelly-pop bg-[#FFEFF4] text-[#F45B84] border border-[#F45B84]'
                : 'bg-[#FFF8FA] border border-[#FAD9E4] text-[#7A5C68]'
            }`}
          >
            Semua Pos
          </button>
          {['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'].map((t) => (
            <button
              key={`${t}-${bucketFilter === t}`}
              type="button"
              onClick={() => setBucketFilter(t)}
              className={`tactile-tap px-2.5 py-1 rounded-full text-[11px] font-heading font-extrabold whitespace-nowrap ${
                bucketFilter === t
                  ? 'animate-jelly-pop bg-[#FFEFF4] text-[#F45B84] border border-[#F45B84]'
                  : 'bg-[#FFF8FA] border border-[#FAD9E4] text-[#7A5C68]'
              }`}
            >
              {BUCKET_META[t].shortLabel}
            </button>
          ))}
        </div>
      </section>

      {/* Date-Grouped Transactions */}
      <section className="space-y-3">
        {groupedByDate.length === 0 ? (
          <div className="card-cute p-6 text-center">
            <p className="text-xs text-[#7A5C68]">
              Tidak ada transaksi yang cocok dengan filter di siklus{' '}
              <strong>{activeCycle?.title}</strong>.
            </p>
          </div>
        ) : (
          groupedByDate.map(([dateKey, items]) => {
            const dailyExpenseSum = items
              .filter((t) => t.type === 'EXPENSE')
              .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

            return (
              <div key={dateKey} className="card-cute p-4">
                <div className="flex items-center justify-between border-b border-[#FAD9E4] pb-2 mb-2">
                  <span className="font-heading font-extrabold text-xs text-[#F45B84]">
                    {formatGroupDateHeading(dateKey)}
                  </span>
                  <span className="text-[11px] font-heading font-bold text-[#7A5C68] tabular-nums">
                    Keluar: {formatRupiah(dailyExpenseSum)}
                  </span>
                </div>

                <div className="divide-y divide-[#FAD9E4]">
                  {items.map((tx) => {
                    const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
                    const isConvert = tx.type === 'CONVERT_WALLET';
                    return (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[#2D1E24] truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#7A5C68]">
                            <span className="inline-flex items-center gap-1">
                              <CuteIcon
                                name={tx.walletSource === 'CASH' ? 'cash' : 'digital'}
                                className="w-3 h-3"
                              />
                              <span>{tx.walletSource === 'CASH' ? 'Cash' : 'Digital'}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-heading font-extrabold text-xs sm:text-sm tabular-nums ${
                              isConvert ? 'text-[#4F7DF3]' : 'text-[#2D1E24]'
                            }`}
                          >
                            {isConvert ? formatRupiah(tx.amount) : `-${formatRupiah(tx.amount)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteTx(tx)}
                            aria-label="Hapus transaksi"
                            className="p-1 text-[#7A5C68] hover:text-[#E0436E]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Archived & Active Cycles List (EMA AI Memory) */}
      <section className="card-cute p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">
            Daftar Siklus Kiriman ({cycles.length})
          </h3>
          <button
            type="button"
            onClick={onOpenNewCycle}
            className="text-xs font-heading font-extrabold text-[#F45B84] hover:underline"
          >
            + Tutup &amp; Siklus Baru
          </button>
        </div>

        <div className="space-y-2">
          {cycles.map((c) => {
            const isSelected = activeCycle?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCycle(c.id)}
                className={`tactile-tap w-full p-3 rounded-2xl border text-left flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#FFEFF4] border-[#F45B84]'
                    : 'bg-[#FFF8FA] border-[#FAD9E4]'
                }`}
              >
                <div>
                  <div className="font-heading font-extrabold text-xs sm:text-sm text-[#2D1E24]">
                    {c.title}
                  </div>
                  <div className="text-[11px] text-[#7A5C68] tabular-nums">
                    Modal Awal: {formatRupiah((c.initialCash || 0) + (c.initialDigital || 0))}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold ${
                    c.status === 'ACTIVE'
                      ? 'bg-[#E8F8F0] text-[#2EB872]'
                      : 'bg-white text-[#7A5C68] border border-[#FAD9E4]'
                  }`}
                >
                  {c.status === 'ACTIVE' ? 'Sedang Jalan' : 'Selesai'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SCREEN 2: NOTEBOOK SYNC & HISTORY (SALIN DARI BUKU & RINGKASAN)
// ============================================================================

function NotebookScreen({
  mode,
  setMode,
  activeCycle,
  activeBuckets,
  activeTransactions,
  walletSummary,
  onBatchSave,
  onDeleteTx,
  onToast,
  onReloadDB
}) {
  const fileInputRef = useRef(null);

  // Batch Quick-Entry State
  const defaultBucketId =
    activeBuckets.find((b) => b.type === 'LIFESTYLE')?.id ||
    activeBuckets.find((b) => !b.isLocked)?.id ||
    '';

  const createEmptyRow = (dateVal = getDateISO(0)) => ({
    uid: Math.random().toString(36).slice(2, 9),
    quickText: '',
    description: '',
    amount: '',
    bucketId: defaultBucketId,
    walletSource: 'CASH',
    date: dateVal
  });

  const [batchDate, setBatchDate] = useState(getDateISO(0));
  const [batchRows, setBatchRows] = useState(() => [
    createEmptyRow(getDateISO(0)),
    createEmptyRow(getDateISO(0)),
    createEmptyRow(getDateISO(0)),
    createEmptyRow(getDateISO(0)),
    createEmptyRow(getDateISO(0))
  ]);

  // Apply 1-click backdate across rows
  const handleSelectBatchDate = (newDate) => {
    setBatchDate(newDate);
    setBatchRows((prev) => prev.map((r) => ({ ...r, date: newDate })));
  };

  // Update a row and run live NLP parser when typing quickText
  const handleRowQuickParse = (uid, text) => {
    const parsed = parseQuickExpense(text);
    setBatchRows((prev) =>
      prev.map((row) => {
        if (row.uid !== uid) return row;
        const updated = { ...row, quickText: text };
        if (parsed) {
          if (parsed.amount > 0) updated.amount = String(parsed.amount);
          if (parsed.description) updated.description = parsed.description;
          if (parsed.walletSource) updated.walletSource = parsed.walletSource;
          if (parsed.bucketType) {
            const matchedBucket = activeBuckets.find(
              (b) => b.type === parsed.bucketType && !b.isLocked
            );
            if (matchedBucket) updated.bucketId = matchedBucket.id;
          }
        }
        return updated;
      })
    );
  };

  const handleRowFieldChange = (uid, field, value) => {
    setBatchRows((prev) =>
      prev.map((row) => (row.uid === uid ? { ...row, [field]: value } : row))
    );
  };

  const validBatchRows = useMemo(() => {
    return batchRows.filter((r) => Number(r.amount) > 0 && r.bucketId);
  }, [batchRows]);

  const handleSaveAllBatch = async () => {
    if (validBatchRows.length === 0) {
      onToast('Isi minimal 1 baris nominal dulu ya');
      return;
    }
    await onBatchSave(validBatchRows);
    setBatchRows([
      createEmptyRow(batchDate),
      createEmptyRow(batchDate),
      createEmptyRow(batchDate),
      createEmptyRow(batchDate),
      createEmptyRow(batchDate)
    ]);
    setMode('SUMMARY');
  };

  // Generate Notebook / WhatsApp formatted report text
  const generateNotebookReportText = () => {
    const title = activeCycle ? activeCycle.title : 'Kiriman Aktif';
    const lines = [
      `=== LAPORAN BUKU KAS SANTRIFLOW — ${title} ===`,
      `Tanggal Cetak: ${formatShortDateID(getDateISO(0))}`,
      `--------------------------------`,
      `RINGKASAN SALDO:`,
      `- Cash (Tunai) : ${formatRupiah(walletSummary.cash)}`,
      `- Digital/QRIS : ${formatRupiah(walletSummary.digital)}`,
      `- Total Sisa   : ${formatRupiah(walletSummary.total)}`,
      ``,
      `SISA PER POS JATAH:`
    ];

    activeBuckets.forEach((b) => {
      const rem = Math.max(0, (b.allocatedAmount || 0) - (b.spentAmount || 0));
      const lockMark = b.type === 'EMERGENCY' && b.isLocked ? ' [Terkunci]' : '';
      lines.push(`- ${b.name}${lockMark}: ${formatRupiah(rem)} (dari ${formatRupiah(b.allocatedAmount)})`);
    });

    if (activeTransactions.length > 0) {
      lines.push(``);
      lines.push(`CATATAN PENGELUARAN (${activeTransactions.length}):`);
      activeTransactions.slice(0, 15).forEach((tx) => {
        const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
        const posLabel = tx.type === 'CONVERT_WALLET' ? 'Pindah' : BUCKET_META[bObj?.type]?.shortLabel || '-';
        const wLabel = tx.walletSource === 'CASH' ? 'Cash' : 'Dig';
        lines.push(`- [${formatShortDateID(tx.date)}] ${tx.description} (${posLabel}/${wLabel}): ${formatRupiah(tx.amount)}`);
      });
    }

    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    const text = generateNotebookReportText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      onToast('Laporan tersalin! Siap ditempel');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onToast('Laporan tersalin! Siap ditempel');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Tanggal', 'Keterangan', 'Pos', 'Dompet', 'Tipe', 'Nominal'];
    const csvRows = [headers.join(',')];
    activeTransactions.forEach((tx) => {
      const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
      const posName = tx.type === 'CONVERT_WALLET' ? 'Pindah Saldo' : bObj?.name || '-';
      const descSafe = `"${(tx.description || '').replace(/"/g, '""')}"`;
      csvRows.push([tx.date, descSafe, `"${posName}"`, tx.walletSource, tx.type, tx.amount].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SantriFlow_${(activeCycle?.title || 'Laporan').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('File CSV berhasil diunduh');
  };

  // Backup JSON (All IndexedDB Stores)
  const handleBackupJSON = async () => {
    const [cycles, buckets, transactions] = await Promise.all([
      santriDB.getAll('cycles'),
      santriDB.getAll('buckets'),
      santriDB.getAll('transactions')
    ]);
    const payload = {
      app: 'SantriFlow Local',
      exportedAt: new Date().toISOString(),
      cycles,
      buckets,
      transactions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SantriFlow_Backup_${getDateISO(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('File cadangan berhasil disimpan');
  };

  // Restore JSON
  const handleRestoreJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.cycles) || !Array.isArray(parsed.buckets)) {
        onToast('Format file cadangan tidak sesuai');
        return;
      }
      await santriDB.clearAll();
      for (const c of parsed.cycles) await santriDB.put('cycles', c);
      for (const b of parsed.buckets) await santriDB.put('buckets', b);
      for (const t of parsed.transactions || []) await santriDB.put('transactions', t);
      await onReloadDB();
      onToast('Data buku kas berhasil dipulihkan');
    } catch {
      onToast('Gagal membaca file cadangan');
    } finally {
      e.target.value = '';
    }
  };

  const unlockedBuckets = activeBuckets.filter((b) => !b.isLocked);

  return (
    <div className="space-y-4">
      {/* Header Card with Animated Loopy Companion */}
      <section className="card-cute p-4 flex items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFEFF4] text-[#F45B84] text-[11px] font-heading font-extrabold mb-1">
            Buku Kas Santri
          </span>
          <h2 className="font-heading font-black text-lg text-[#2D1E24] leading-tight">
            Salin Buku &amp; Laporan
          </h2>
          <p className="text-xs text-[#7A5C68] mt-0.5">
            Pindahkan catatan dari buku saku ke HP atau salin laporan rapi ke buku tulis.
          </p>
        </div>
        <LoopyMascot mood="notebook" className="w-16 h-16 shrink-0" />
      </section>

      {/* Top Segmented Pill Toggle with Sliding Pink Indicator */}
      <div className="relative p-1.5 rounded-full bg-[#FFEFF4] border border-[#FAD9E4] grid grid-cols-2">
        <div
          aria-hidden="true"
          className="sliding-pill-thumb pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-full bg-[#F45B84] shadow-sm"
          style={{
            transform: mode === 'BATCH' ? 'translateX(0%)' : 'translateX(100%)'
          }}
        />
        <button
          type="button"
          onClick={() => setMode('BATCH')}
          className={`tactile-tap relative z-10 py-2 px-3 rounded-full font-heading font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors duration-200 ${
            mode === 'BATCH'
              ? 'text-white'
              : 'text-[#7A5C68] hover:text-[#2D1E24]'
          }`}
        >
          <CuteIcon name="notebook" className="w-4 h-4" />
          <span>Salin dari Buku Tulis</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('SUMMARY')}
          className={`tactile-tap relative z-10 py-2 px-3 rounded-full font-heading font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 transition-colors duration-200 ${
            mode === 'SUMMARY'
              ? 'text-white'
              : 'text-[#7A5C68] hover:text-[#2D1E24]'
          }`}
        >
          <CuteIcon name="book" className="w-4 h-4" />
          <span>Laporan Buku Kas</span>
        </button>
      </div>

      {mode === 'BATCH' ? (
        /* TAB A: BATCH QUICK-ENTRY MODE */
        <section className="card-cute p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">
                Salin Banyak Catatan Sekaligus
              </h3>
              <p className="text-[11px] text-[#7A5C68]">
                Ketik singkat (misal: <em>&ldquo;12rb laundry cash&rdquo;</em>) atau isi kolom di
                bawah.
              </p>
            </div>

            {/* 1-Click Backdate Pills with Sliding Pink Indicator */}
            <div className="relative grid grid-cols-3 bg-[#FFF8FA] p-1 rounded-full border border-[#FAD9E4]">
              <div
                aria-hidden="true"
                className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-full bg-[#F45B84]"
                style={{
                  transform:
                    batchDate === getDateISO(0)
                      ? 'translateX(0%)'
                      : batchDate === getDateISO(-1)
                      ? 'translateX(100%)'
                      : 'translateX(200%)'
                }}
              />
              {[
                { label: 'Hari Ini', offset: 0 },
                { label: 'Kemarin', offset: -1 },
                { label: '2 Hari Lalu', offset: -2 }
              ].map((opt) => {
                const iso = getDateISO(opt.offset);
                const active = batchDate === iso;
                return (
                  <button
                    key={opt.offset}
                    type="button"
                    onClick={() => handleSelectBatchDate(iso)}
                    className={`tactile-tap relative z-10 px-2.5 py-1 rounded-full text-[11px] font-heading font-extrabold transition-colors duration-200 ${
                      active ? 'text-white' : 'text-[#7A5C68]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Row Spreadsheet-Like Entry Cards */}
          <div className="space-y-2.5">
            {batchRows.map((row, index) => (
              <div
                key={row.uid}
                className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-heading font-extrabold text-[#F45B84]">
                    Baris #{index + 1} • {formatShortDateID(row.date)}
                  </span>
                  <input
                    type="text"
                    value={row.quickText}
                    onChange={(e) => handleRowQuickParse(row.uid, e.target.value)}
                    placeholder="Ketik singkat: 10rb bakso cash..."
                    className="flex-1 text-xs bg-white border border-[#FAD9E4] rounded-full px-3 py-1 text-[#2D1E24] placeholder:text-[#7A5C68]/60 focus:outline-none focus:border-[#F45B84]"
                  />
                </div>

                <div className="grid grid-cols-12 gap-1.5">
                  {/* Keterangan */}
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => handleRowFieldChange(row.uid, 'description', e.target.value)}
                    placeholder="Keterangan"
                    className="col-span-5 text-xs bg-white border border-[#FAD9E4] rounded-xl px-2.5 py-2 text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
                  />

                  {/* Nominal */}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.amount}
                    onChange={(e) => handleRowFieldChange(row.uid, 'amount', e.target.value)}
                    placeholder="Rp Nominal"
                    className="col-span-3 text-xs font-bold tabular-nums bg-white border border-[#FAD9E4] rounded-xl px-2 py-2 text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
                  />

                  {/* Pos Selector */}
                  <select
                    value={row.bucketId}
                    onChange={(e) => handleRowFieldChange(row.uid, 'bucketId', e.target.value)}
                    className="col-span-2 text-[11px] font-semibold bg-white border border-[#FAD9E4] rounded-xl px-1.5 py-2 text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
                  >
                    {unlockedBuckets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {BUCKET_META[b.type]?.shortLabel || b.name}
                      </option>
                    ))}
                  </select>

                  {/* Cash / Digital Toggle */}
                  <button
                    type="button"
                    onClick={() =>
                      handleRowFieldChange(
                        row.uid,
                        'walletSource',
                        row.walletSource === 'CASH' ? 'DIGITAL' : 'CASH'
                      )
                    }
                    className={`col-span-2 rounded-xl text-[11px] font-heading font-extrabold border inline-flex items-center justify-center gap-0.5 ${
                      row.walletSource === 'CASH'
                        ? 'bg-[#E8F8F0] border-[#A7F3D0] text-[#2EB872]'
                        : 'bg-[#EEF4FF] border-[#BFDBFE] text-[#4F7DF3]'
                    }`}
                  >
                    <CuteIcon
                      name={row.walletSource === 'CASH' ? 'cash' : 'digital'}
                      className="w-3 h-3"
                    />
                    <span>{row.walletSource === 'CASH' ? 'Cash' : 'Dig'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Row + Save All CTA */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setBatchRows((prev) => [...prev, createEmptyRow(batchDate)])}
              className="tactile-tap px-3.5 py-2.5 rounded-full bg-[#FFEFF4] text-[#F45B84] font-heading font-extrabold text-xs flex items-center gap-1"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Baris</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllBatch}
              className="tactile-tap btn-pink-pill flex-1 py-2.5 px-4 text-white font-heading font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Semua Transaksi ({validBatchRows.length})</span>
            </button>
          </div>
        </section>
      ) : (
        /* TAB B: LINED NOTEBOOK SUMMARY & LEDGER VIEW */
        <div className="space-y-4">
          {/* Lined Pink Notebook Paper Card */}
          <section className="card-cute notebook-paper p-4 sm:p-5">
            {/* Notebook Header */}
            <div className="flex items-center justify-between border-b-2 border-[#F45B84] pb-2 mb-3">
              <div>
                <div className="text-[11px] font-heading font-extrabold uppercase tracking-wider text-[#F45B84]">
                  Buku Kas Santri • {activeCycle?.title}
                </div>
                <div className="font-heading font-black text-base text-[#2D1E24]">
                  Ringkasan Siap Salin ke Buku
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#FFEFF4] text-[#F45B84] text-xs font-heading font-extrabold tabular-nums">
                {formatShortDateID(getDateISO(0))}
              </span>
            </div>

            {/* Saldo Cash / Digital / Total */}
            <div className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-3 mb-3">
              <div className="grid grid-cols-3 gap-2 text-center divide-x divide-[#FAD9E4]">
                <div>
                  <div className="text-[11px] text-[#7A5C68] inline-flex items-center justify-center gap-1">
                    <CuteIcon name="cash" className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </div>
                  <div className="font-heading font-extrabold text-xs sm:text-sm text-[#2D1E24] tabular-nums">
                    {formatRupiah(walletSummary.cash)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#7A5C68] inline-flex items-center justify-center gap-1">
                    <CuteIcon name="digital" className="w-3.5 h-3.5" />
                    <span>Digital</span>
                  </div>
                  <div className="font-heading font-extrabold text-xs sm:text-sm text-[#2D1E24] tabular-nums">
                    {formatRupiah(walletSummary.digital)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#F45B84]">Total Sisa</div>
                  <div className="font-heading font-black text-xs sm:text-sm text-[#F45B84] tabular-nums">
                    {formatRupiah(walletSummary.total)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sisa Per 4 Pos */}
            <div className="mb-4">
              <div className="text-xs font-heading font-extrabold text-[#2D1E24] mb-1.5">
                Sisa Per Pos Jatah:
              </div>
              <div className="divide-y divide-[#FAD9E4] border-y border-[#FAD9E4]">
                {activeBuckets.map((b) => {
                  const rem = Math.max(0, (b.allocatedAmount || 0) - (b.spentAmount || 0));
                  const isLocked = b.type === 'EMERGENCY' && b.isLocked;
                  return (
                    <div
                      key={b.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-heading font-bold text-[#2D1E24]">
                        <span>{b.name}</span>
                        {isLocked && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#9D4EDD] text-[10px] font-extrabold">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Terkunci</span>
                          </span>
                        )}
                      </div>
                      <div className="tabular-nums text-right">
                        <span className="font-heading font-black text-[#2D1E24]">
                          {formatRupiah(rem)}
                        </span>
                        <span className="text-[11px] text-[#7A5C68] ml-1">
                          / {formatRupiah(b.allocatedAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daftar Transaksi Format Buku Kas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-heading font-extrabold text-[#2D1E24]">
                  Rincian Transaksi Buku Kas ({activeTransactions.length}):
                </span>
                <span className="text-[10px] font-semibold text-[#7A5C68]">
                  Tgl • Ket • Pos • Dompet • Nominal
                </span>
              </div>

              {activeTransactions.length === 0 ? (
                <div className="py-5 text-center text-xs text-[#7A5C68]">
                  Belum ada transaksi tercatat di siklus ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#F45B84]/40 text-[10px] font-heading font-extrabold uppercase text-[#F45B84]">
                        <th className="py-1.5 pr-2">Tgl</th>
                        <th className="py-1.5 pr-2">Keterangan</th>
                        <th className="py-1.5 pr-2">Pos</th>
                        <th className="py-1.5 pr-2">Dompet</th>
                        <th className="py-1.5 text-right">Nominal</th>
                        <th className="py-1.5 pl-1 w-6" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#FAD9E4]">
                      {activeTransactions.map((tx) => {
                        const bObj = activeBuckets.find((b) => b.id === tx.bucketId);
                        const isConvert = tx.type === 'CONVERT_WALLET';
                        const posLabel = isConvert
                          ? 'Pindah'
                          : BUCKET_META[bObj?.type]?.shortLabel || '-';
                        return (
                          <tr key={tx.id} className="align-middle">
                            <td className="py-2 pr-2 whitespace-nowrap text-[11px] text-[#7A5C68] tabular-nums">
                              {formatShortDateID(tx.date)}
                            </td>
                            <td className="py-2 pr-2 font-semibold text-[#2D1E24] max-w-[130px] truncate">
                              {tx.description}
                            </td>
                            <td className="py-2 pr-2 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded bg-[#FFEFF4] text-[#F45B84] text-[10px] font-heading font-extrabold">
                                {posLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-2 whitespace-nowrap text-[11px] text-[#7A5C68]">
                              {tx.walletSource === 'CASH' ? 'Cash' : 'Digital'}
                            </td>
                            <td
                              className={`py-2 text-right whitespace-nowrap font-heading font-extrabold tabular-nums ${
                                isConvert ? 'text-[#4F7DF3]' : 'text-[#2D1E24]'
                              }`}
                            >
                              {formatRupiah(tx.amount)}
                            </td>
                            <td className="py-2 pl-1 text-right">
                              <button
                                type="button"
                                onClick={() => onDeleteTx(tx)}
                                aria-label="Hapus baris"
                                className="p-1 text-[#7A5C68] hover:text-[#E0436E]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Primary Copy Report CTA + Offline Backup & CSV Tools */}
          <section className="card-cute p-4 space-y-2.5">
            <button
              type="button"
              onClick={handleCopyReport}
              className="tactile-tap btn-pink-pill w-full py-3 px-4 text-white font-heading font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              <span>Salin Teks Laporan (Siap Tempel ke Buku / WA)</span>
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="tactile-tap py-2 px-2.5 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] text-[#2D1E24] font-heading font-extrabold text-[11px] flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#2EB872] shrink-0" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleBackupJSON}
                className="tactile-tap py-2 px-2.5 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] text-[#2D1E24] font-heading font-extrabold text-[11px] flex items-center justify-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-[#F45B84] shrink-0" />
                <span>Backup File</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tactile-tap py-2 px-2.5 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] text-[#2D1E24] font-heading font-extrabold text-[11px] flex items-center justify-center gap-1"
              >
                <Upload className="w-3.5 h-3.5 text-[#4F7DF3] shrink-0" />
                <span>Pulihkan</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreJSON}
                className="hidden"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL 1: QUICK EXPENSE + INDONESIAN NLP PARSER
// ============================================================================

function QuickExpenseModal({
  buckets,
  walletSummary,
  preselectedBucketId,
  onClose,
  onSubmit,
  onOpenLockModal
}) {
  const unlockedBuckets = buckets.filter((b) => !b.isLocked);
  const emergencyBucket = buckets.find((b) => b.type === 'EMERGENCY');
  const isEmergencyLocked = emergencyBucket?.isLocked;

  const initialBucketId =
    preselectedBucketId ||
    unlockedBuckets.find((b) => b.type === 'LIFESTYLE')?.id ||
    unlockedBuckets[0]?.id ||
    '';

  const [nlpInput, setNlpInput] = useState('');
  const [aiDetected, setAiDetected] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [bucketId, setBucketId] = useState(initialBucketId);
  const [walletSource, setWalletSource] = useState('CASH');
  const [date, setDate] = useState(getDateISO(0));

  const handleNlpChange = (val) => {
    setNlpInput(val);
    const parsed = parseQuickExpense(val);
    if (parsed) {
      setAiDetected(true);
      if (parsed.amount > 0) setAmount(String(parsed.amount));
      if (parsed.description) setDescription(parsed.description);
      if (parsed.walletSource) setWalletSource(parsed.walletSource);
      if (parsed.bucketType) {
        const match = buckets.find((b) => b.type === parsed.bucketType && !b.isLocked);
        if (match) setBucketId(match.id);
      }
    } else {
      setAiDetected(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0 || !bucketId) return;
    onSubmit({
      bucketId,
      walletSource,
      amount: Number(amount),
      description,
      date
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D1E24]/50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in w-full max-w-md bg-white border-[1.5px] border-[#FAD9E4] rounded-[24px] p-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-black text-lg text-[#2D1E24] flex items-center gap-1.5">
            <span>Catat Pengeluaran</span>
            <CuteIcon name="sakura" className="w-5 h-5" />
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal"
            className="tactile-tap w-8 h-8 rounded-full bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Smart NLP Quick-Parser Input */}
        <div className="rounded-2xl bg-[#FFEFF4] border border-[#FAD9E4] p-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-heading font-extrabold text-[#F45B84] flex items-center gap-1.5">
              <CuteIcon name="bolt" className="w-4 h-4" />
              <span>Tulis Singkat (Otomatis Terbaca)</span>
            </label>
            {aiDetected && (
              <span className="px-2 py-0.5 rounded-full bg-[#F45B84] text-white text-[10px] font-heading font-extrabold">
                Terbaca Otomatis
              </span>
            )}
          </div>
          <input
            type="text"
            value={nlpInput}
            onChange={(e) => handleNlpChange(e.target.value)}
            placeholder='Contoh: "15rb bakso kantin cash" atau "20000 print tugas digital"'
            className="w-full rounded-xl bg-white border border-[#FAD9E4] px-3 py-2 text-xs sm:text-sm text-[#2D1E24] placeholder:text-[#7A5C68]/60 focus:outline-none focus:border-[#F45B84]"
          />
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          {/* Amount Input + Quick Chips */}
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
              Nominal (Rp)
            </label>
            <input
              type="number"
              inputMode="numeric"
              required
              min="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2.5 font-heading font-black text-xl text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
            />
            <div className="flex items-center gap-1.5 mt-1.5">
              {[5000, 10000, 15000, 20000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAmount(String((Number(amount) || 0) + chip))}
                  className="tactile-tap px-2.5 py-1 rounded-full bg-[#FFEFF4] text-[#F45B84] text-xs font-heading font-extrabold tabular-nums"
                >
                  +{chip / 1000}rb
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
              Keterangan
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Misal: Bakso kantin, fotokopi kitab..."
              className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2 text-sm text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
            />
          </div>

          {/* Wallet Source Toggle */}
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
              Sumber Dompet
            </label>
            <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4]">
              <div
                aria-hidden="true"
                className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-[#FFEFF4] border border-[#F45B84]"
                style={{
                  transform: walletSource === 'CASH' ? 'translateX(0%)' : 'translateX(100%)'
                }}
              />
              <button
                type="button"
                onClick={() => setWalletSource('CASH')}
                className={`tactile-tap relative z-10 p-2 rounded-xl text-left transition-colors duration-200 ${
                  walletSource === 'CASH' ? 'text-[#2D1E24]' : 'text-[#7A5C68]'
                }`}
              >
                <div className="font-heading font-extrabold text-xs flex items-center gap-1.5">
                  <CuteIcon name="cash" className="w-4 h-4" />
                  <span>Cash (Tunai)</span>
                </div>
                <div className="text-[11px] tabular-nums mt-0.5">
                  Sisa: {formatRupiah(walletSummary.cash)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWalletSource('DIGITAL')}
                className={`tactile-tap relative z-10 p-2 rounded-xl text-left transition-colors duration-200 ${
                  walletSource === 'DIGITAL' ? 'text-[#2D1E24]' : 'text-[#7A5C68]'
                }`}
              >
                <div className="font-heading font-extrabold text-xs flex items-center gap-1.5">
                  <CuteIcon name="digital" className="w-4 h-4" />
                  <span>Digital (QRIS)</span>
                </div>
                <div className="text-[11px] tabular-nums mt-0.5">
                  Sisa: {formatRupiah(walletSummary.digital)}
                </div>
              </button>
            </div>
          </div>

          {/* Bucket Selector */}
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
              Ambil dari Pos Anggaran
            </label>
            <div className="grid grid-cols-2 gap-2">
              {unlockedBuckets.map((b) => {
                const rem = Math.max(0, (b.allocatedAmount || 0) - (b.spentAmount || 0));
                const active = Number(bucketId) === b.id;
                return (
                  <button
                    key={`${b.id}-${active}`}
                    type="button"
                    onClick={() => setBucketId(b.id)}
                    className={`tactile-tap p-2.5 rounded-2xl border text-left ${
                      active
                        ? 'animate-jelly-pop bg-[#FFEFF4] border-[#F45B84] text-[#2D1E24]'
                        : 'bg-[#FFF8FA] border-[#FAD9E4] text-[#7A5C68]'
                    }`}
                  >
                    <div className="font-heading font-extrabold text-xs truncate">{b.name}</div>
                    <div className="text-[11px] tabular-nums mt-0.5">
                      Sisa: {formatRupiah(rem)}
                    </div>
                  </button>
                );
              })}
            </div>

            {isEmergencyLocked && (
              <div className="mt-2 rounded-xl bg-[#F3E8FF] px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-[#9D4EDD]">
                <span className="font-semibold inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Dana Darurat sedang dikunci.</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenLockModal}
                  className="font-heading font-extrabold underline shrink-0"
                >
                  Buka Kunci
                </button>
              </div>
            )}
          </div>

          {/* Date Quick Pills */}
          <div>
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
              Tanggal Catatan
            </label>
            <div className="flex items-center gap-2">
              <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] shrink-0">
                <div
                  aria-hidden="true"
                  className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#F45B84]"
                  style={{
                    transform:
                      date === getDateISO(0)
                        ? 'translateX(0%)'
                        : date === getDateISO(-1)
                        ? 'translateX(100%)'
                        : 'translateX(0%) scale(0)'
                  }}
                />
                {[
                  { label: 'Hari Ini', offset: 0 },
                  { label: 'Kemarin', offset: -1 }
                ].map((dOpt) => {
                  const iso = getDateISO(dOpt.offset);
                  const active = date === iso;
                  return (
                    <button
                      key={dOpt.offset}
                      type="button"
                      onClick={() => setDate(iso)}
                      className={`tactile-tap relative z-10 px-3 py-1 rounded-full text-xs font-heading font-extrabold transition-colors duration-200 ${
                        active ? 'text-white' : 'text-[#7A5C68]'
                      }`}
                    >
                      {dOpt.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 min-w-0 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] px-3 py-1.5 text-xs text-[#2D1E24]"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            className="tactile-tap btn-pink-pill w-full py-3 px-4 text-white font-heading font-extrabold text-sm mt-2 flex items-center justify-center gap-1.5"
          >
            <span>Simpan Pengeluaran</span>
            <CuteIcon name="sparkle" className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL 2: FLEXIBLE LOCK / UNLOCK DANA DARURAT
// ============================================================================

function EmergencyLockModal({ emergencyBucket, lifestyleBucket, onClose, onConfirm }) {
  if (!emergencyBucket) return null;

  const isCurrentlyLocked = emergencyBucket.isLocked;
  const minAllowed = emergencyBucket.spentAmount || 0;
  const maxPool =
    (emergencyBucket.allocatedAmount || 0) +
    Math.max(0, (lifestyleBucket?.allocatedAmount || 0) - (lifestyleBucket?.spentAmount || 0));

  const [reason, setReason] = useState('Sakit / Beli Obat');
  const [allocation, setAllocation] = useState(emergencyBucket.allocatedAmount || 0);

  const reasons = ['Sakit / Beli Obat', 'Kebutuhan Mendesak', 'Atur Ulang Anggaran'];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D1E24]/50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in w-full max-w-md bg-white border-[1.5px] border-[#FAD9E4] rounded-[24px] p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F3E8FF] text-[#9D4EDD] text-[11px] font-heading font-extrabold mb-1">
              Kunci Dana Darurat
            </span>
            <h2 className="font-heading font-black text-lg text-[#2D1E24]">
              {isCurrentlyLocked ? 'Buka Kunci Dana Darurat?' : 'Atur & Kunci Dana Darurat'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tactile-tap w-8 h-8 rounded-full bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-[#FFF8FA] border border-[#FAD9E4] rounded-2xl p-3 my-3">
          <LoopyMascot mood="locked" className="w-16 h-16 shrink-0" />
          <p className="text-xs text-[#7A5C68] leading-relaxed">
            Dana Darurat dikunci supaya tidak terpakai jajan, tapi{' '}
            <strong className="text-[#2D1E24]">tetap bisa kamu buka</strong> atau ubah
            nominalnya kapan saja saat butuh.
          </p>
        </div>

        {isCurrentlyLocked && (
          <div className="mb-3.5">
            <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
              Pilih Alasan Cepat:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={`${r}-${reason === r}`}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`tactile-tap px-3 py-1.5 rounded-full text-xs font-heading font-extrabold ${
                    reason === r
                      ? 'animate-jelly-pop bg-[#9D4EDD] text-white'
                      : 'bg-[#F3E8FF] text-[#9D4EDD]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Flexible Allocation Slider / Input (Even down to Rp0 if spent == 0) */}
        <div className="mb-4 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-heading font-extrabold text-[#2D1E24]">
              Alokasi Dana Darurat
            </label>
            <span className="font-heading font-black text-sm text-[#9D4EDD] tabular-nums">
              {formatRupiah(allocation)}
            </span>
          </div>
          <input
            type="range"
            min={minAllowed}
            max={Math.max(minAllowed, maxPool)}
            step={1000}
            value={allocation}
            onChange={(e) => setAllocation(Number(e.target.value))}
            className="w-full accent-[#9D4EDD] cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] text-[#7A5C68] tabular-nums mt-1">
            <span>Min: {formatRupiah(minAllowed)}</span>
            <button
              type="button"
              onClick={() => setAllocation(minAllowed)}
              className="text-[#F45B84] font-bold underline"
            >
              Atur ke {formatRupiah(minAllowed)}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {isCurrentlyLocked ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="tactile-tap py-2.5 px-4 rounded-full bg-[#FFEFF4] text-[#F45B84] font-heading font-extrabold text-xs inline-flex items-center justify-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Tetap Kunci</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    isLocked: false,
                    newEmergencyAllocation: allocation,
                    reason
                  })
                }
                className="tactile-tap py-2.5 px-4 rounded-full bg-[#9D4EDD] text-white font-heading font-extrabold text-xs shadow-md inline-flex items-center justify-center gap-1"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kunci</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    isLocked: false,
                    newEmergencyAllocation: allocation,
                    reason: 'Ubah nominal'
                  })
                }
                className="tactile-tap py-2.5 px-4 rounded-full bg-[#FFEFF4] text-[#F45B84] font-heading font-extrabold text-xs"
              >
                Simpan Nominal
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    isLocked: true,
                    newEmergencyAllocation: allocation,
                    reason: 'Dikunci kembali'
                  })
                }
                className="tactile-tap py-2.5 px-4 rounded-full bg-[#9D4EDD] text-white font-heading font-extrabold text-xs shadow-md inline-flex items-center justify-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Kunci Kembali</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL 3: CYCLE MANAGER, AI LOCAL ALLOCATOR & TOP-UP
// ============================================================================

function CycleManagerModal({
  initialTab = 'NEW_CYCLE',
  cycles,
  activeCycle,
  walletSummary,
  closedCyclesHistory,
  onSelectCycle,
  onClose,
  onCreateOrTopUp,
  onResetDemo
}) {
  const [tab, setTab] = useState(initialTab); // 'NEW_CYCLE' | 'TOP_UP' | 'HISTORY'
  const [cashInput, setCashInput] = useState('100000');
  const [digitalInput, setDigitalInput] = useState('150000');
  const [carryOver, setCarryOver] = useState(true);
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [roundingStep, setRoundingStep] = useState(1000);
  const [topUpTargetType, setTopUpTargetType] = useState('LIFESTYLE');

  const toggleFlag = (id) => {
    setSelectedFlags((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalNewFunds = useMemo(() => {
    const base = (Number(cashInput) || 0) + (Number(digitalInput) || 0);
    const carry =
      tab === 'NEW_CYCLE' && carryOver
        ? Math.max(0, walletSummary.cash) + Math.max(0, walletSummary.digital)
        : 0;
    return base + carry;
  }, [cashInput, digitalInput, carryOver, tab, walletSummary]);

  const aiPreview = useMemo(() => {
    return calculateSmartAllocation(
      totalNewFunds,
      selectedFlags,
      closedCyclesHistory,
      roundingStep
    );
  }, [totalNewFunds, selectedFlags, closedCyclesHistory, roundingStep]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateOrTopUp({
      mode: tab,
      cashInput: Number(cashInput) || 0,
      digitalInput: Number(digitalInput) || 0,
      carryOver,
      contextFlags: selectedFlags,
      allocations: aiPreview.allocations,
      aiNote: aiPreview.aiNote,
      topUpTargetType
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D1E24]/50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in w-full max-w-md bg-white border-[1.5px] border-[#FAD9E4] rounded-[24px] p-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-black text-lg text-[#2D1E24] flex items-center gap-1.5">
            <span>Atur Kiriman Uang</span>
            <CuteIcon name="sakura" className="w-5 h-5" />
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tactile-tap w-8 h-8 rounded-full bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs with Sliding Pink Indicator */}
        <div className="relative grid grid-cols-3 p-1 rounded-full bg-[#FFEFF4] mb-4">
          <div
            aria-hidden="true"
            className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-full bg-[#F45B84] shadow-xs"
            style={{
              transform:
                tab === 'NEW_CYCLE'
                  ? 'translateX(0%)'
                  : tab === 'TOP_UP'
                  ? 'translateX(100%)'
                  : 'translateX(200%)'
            }}
          />
          {[
            { id: 'NEW_CYCLE', label: 'Kiriman Baru' },
            { id: 'TOP_UP', label: 'Tambah Dana' },
            { id: 'HISTORY', label: 'Daftar Kiriman' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`tactile-tap relative z-10 py-1.5 px-2 rounded-full text-xs font-heading font-extrabold transition-colors duration-200 ${
                tab === t.id ? 'text-white' : 'text-[#7A5C68]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'HISTORY' ? (
          <div className="space-y-2.5">
            {cycles.map((c) => {
              const isSelected = activeCycle?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCycle(c.id)}
                  className={`tactile-tap w-full p-3 rounded-2xl border text-left flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#FFEFF4] border-[#F45B84]'
                      : 'bg-[#FFF8FA] border-[#FAD9E4]'
                  }`}
                >
                  <div>
                    <div className="font-heading font-extrabold text-sm text-[#2D1E24]">
                      {c.title}
                    </div>
                    <div className="text-[11px] text-[#7A5C68] tabular-nums">
                      Awal: {formatRupiah((c.initialCash || 0) + (c.initialDigital || 0))}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold ${
                      c.status === 'ACTIVE'
                        ? 'bg-[#E8F8F0] text-[#2EB872]'
                        : 'bg-white text-[#7A5C68] border border-[#FAD9E4]'
                    }`}
                  >
                    {c.status === 'ACTIVE' ? 'Aktif' : 'Selesai'}
                  </span>
                </button>
              );
            })}

            <div className="pt-2 border-t border-[#FAD9E4] flex justify-end">
              <button
                type="button"
                onClick={onResetDemo}
                className="tactile-tap inline-flex items-center gap-1 text-xs font-heading font-bold text-[#7A5C68] hover:text-[#F45B84]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Data Demo Awal</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Cash & Digital Inputs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="flex items-center gap-1 text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
                  <CuteIcon name="cash" className="w-3.5 h-3.5" />
                  <span>Uang Cash Baru</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3 py-2 font-heading font-extrabold text-sm text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-xs font-heading font-extrabold text-[#7A5C68] mb-1">
                  <CuteIcon name="digital" className="w-3.5 h-3.5" />
                  <span>Saldo Digital Baru</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={digitalInput}
                  onChange={(e) => setDigitalInput(e.target.value)}
                  className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3 py-2 font-heading font-extrabold text-sm text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
                />
              </div>
            </div>

            {tab === 'NEW_CYCLE' ? (
              <>
                {/* Automatic Carry-Over Banner + Optional Toggle */}
                <div className="p-3 rounded-2xl bg-[#E8F8F0] border border-[#A7F3D0] space-y-1.5">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CuteIcon name="coin" className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="font-heading font-extrabold text-xs text-[#2D1E24]">
                          Otomatis Gabung Sisa Kiriman Kemarin
                        </div>
                        <div className="text-[11px] text-[#2EB872] font-bold tabular-nums">
                          {walletSummary.total > 0
                            ? `Sisa ${activeCycle?.title || 'sebelumnya'}: +${formatRupiah(
                                walletSummary.total
                              )} (Cash ${formatRupiah(walletSummary.cash)} + Dig ${formatRupiah(
                                walletSummary.digital
                              )})`
                            : 'Tidak ada sisa uang dari kiriman sebelumnya (Rp0)'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={carryOver}
                      onChange={(e) => setCarryOver(e.target.checked)}
                      className="w-4 h-4 accent-[#2EB872]"
                    />
                  </label>
                </div>

                {/* Context Checkboxes */}
                <div>
                  <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
                    Keadaanmu Minggu Ini:
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {CONTEXT_OPTIONS.map((opt) => {
                      const checked = selectedFlags.includes(opt.id);
                      return (
                        <button
                          key={`${opt.id}-${checked}`}
                          type="button"
                          onClick={() => toggleFlag(opt.id)}
                          className={`tactile-tap p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 ${
                            checked
                              ? 'animate-jelly-pop bg-[#FFEFF4] border-[#F45B84] text-[#2D1E24]'
                              : 'bg-[#FFF8FA] border-[#FAD9E4] text-[#7A5C68]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CuteIcon name={opt.iconName} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-heading font-extrabold">{opt.label}</div>
                              <div className="text-[10px] opacity-80">{opt.hint}</div>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              checked ? 'bg-[#F45B84] text-white' : 'border border-[#FAD9E4] bg-white'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rounding Option with Sliding Pink Indicator */}
                <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
                  <div
                    aria-hidden="true"
                    className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#F45B84]"
                    style={{
                      transform: roundingStep === 1000 ? 'translateX(0%)' : 'translateX(100%)'
                    }}
                  />
                  {[1000, 500].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setRoundingStep(step)}
                      className={`tactile-tap relative z-10 py-1.5 px-2.5 rounded-full text-[11px] font-heading font-extrabold transition-colors duration-200 ${
                        roundingStep === step ? 'text-white' : 'text-[#7A5C68]'
                      }`}
                    >
                      Bulatkan {formatRupiah(step)}
                    </button>
                  ))}
                </div>

                {/* Allocation Live Preview */}
                <div className="rounded-2xl bg-[#FFEFF4] border border-[#FAD9E4] p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-heading font-extrabold text-[#F45B84] flex items-center gap-1">
                      <CuteIcon name="sparkle" className="w-3.5 h-3.5" />
                      <span>Rincian Jatah Kiriman Baru</span>
                    </span>
                    <span className="font-heading font-black text-xs text-[#2D1E24] tabular-nums">
                      Total: {formatRupiah(totalNewFunds)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {['MANDATORY', 'ACADEMIC', 'EMERGENCY', 'LIFESTYLE'].map((t) => (
                      <div
                        key={t}
                        className="bg-white rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-[#7A5C68] font-semibold">
                          {BUCKET_META[t].shortLabel}
                        </span>
                        <span className="font-heading font-extrabold text-[#2D1E24] tabular-nums">
                          {formatRupiah(aiPreview.allocations[t])}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#7A5C68] leading-snug">{aiPreview.aiNote}</p>
                </div>
              </>
            ) : (
              /* Top-Up Target Pos Selector */
              <div>
                <label className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
                  Masukkan Tambahan Dana ke Pos:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['LIFESTYLE', 'ACADEMIC', 'MANDATORY', 'EMERGENCY'].map((t) => (
                    <button
                      key={`${t}-${topUpTargetType === t}`}
                      type="button"
                      onClick={() => setTopUpTargetType(t)}
                      className={`tactile-tap p-2.5 rounded-xl border text-left text-xs font-heading font-extrabold ${
                        topUpTargetType === t
                          ? 'animate-jelly-pop bg-[#FFEFF4] border-[#F45B84] text-[#2D1E24]'
                          : 'bg-[#FFF8FA] border-[#FAD9E4] text-[#7A5C68]'
                      }`}
                    >
                      {BUCKET_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="tactile-tap btn-pink-pill w-full py-3 px-4 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-1.5"
            >
              <span>
                {tab === 'NEW_CYCLE'
                  ? 'Tutup Kiriman Lama & Mulai Baru'
                  : 'Tambah Dana ke Kiriman Ini'}
              </span>
              <CuteIcon name="sakura" className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODAL 4: WALLET CONVERTER (TARIK TUNAI / TOP-UP DIGITAL)
// ============================================================================

function WalletConvertModal({ walletSummary, onClose, onConfirm }) {
  const [direction, setDirection] = useState('DIGITAL_TO_CASH'); // 'DIGITAL_TO_CASH' | 'CASH_TO_DIGITAL'
  const [amount, setAmount] = useState('');

  const maxAvailable =
    direction === 'DIGITAL_TO_CASH' ? walletSummary.digital : walletSummary.cash;

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(amount) || 0;
    if (num <= 0) return;
    onConfirm({ direction, amount: num });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D1E24]/50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop-in w-full max-w-md bg-white border-[1.5px] border-[#FAD9E4] rounded-[24px] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-black text-lg text-[#2D1E24] flex items-center gap-1.5">
            <span>Tarik Tunai / Isi Saldo Digital</span>
            <ArrowLeftRight className="w-4 h-4 text-[#F45B84]" />
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tactile-tap w-8 h-8 rounded-full bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#7A5C68] mb-3">
          Memindahkan uang antara <strong>Cash</strong> dan <strong>Digital</strong> tanpa mengubah
          jumlah total uangmu.
        </p>

        {/* Direction Switcher with Sliding Pink Highlight */}
        <div className="relative grid grid-cols-2 p-1 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] mb-3.5">
          <div
            aria-hidden="true"
            className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl bg-[#FFEFF4] border border-[#F45B84]"
            style={{
              transform: direction === 'DIGITAL_TO_CASH' ? 'translateX(0%)' : 'translateX(100%)'
            }}
          />
          <button
            type="button"
            onClick={() => setDirection('DIGITAL_TO_CASH')}
            className={`tactile-tap relative z-10 p-2.5 rounded-xl text-left transition-colors duration-200 ${
              direction === 'DIGITAL_TO_CASH' ? 'text-[#2D1E24]' : 'text-[#7A5C68]'
            }`}
          >
            <div className="font-heading font-extrabold text-xs flex items-center gap-1">
              <CuteIcon name="digital" className="w-3.5 h-3.5" />
              <span>→</span>
              <CuteIcon name="cash" className="w-3.5 h-3.5" />
              <span>Tarik Tunai</span>
            </div>
            <div className="text-[11px] mt-0.5">Digital jadi Cash</div>
          </button>

          <button
            type="button"
            onClick={() => setDirection('CASH_TO_DIGITAL')}
            className={`tactile-tap relative z-10 p-2.5 rounded-xl text-left transition-colors duration-200 ${
              direction === 'CASH_TO_DIGITAL' ? 'text-[#2D1E24]' : 'text-[#7A5C68]'
            }`}
          >
            <div className="font-heading font-extrabold text-xs flex items-center gap-1">
              <CuteIcon name="cash" className="w-3.5 h-3.5" />
              <span>→</span>
              <CuteIcon name="digital" className="w-3.5 h-3.5" />
              <span>Isi Digital</span>
            </div>
            <div className="text-[11px] mt-0.5">Cash jadi Digital</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-heading font-extrabold text-[#7A5C68]">Nominal Pindah</span>
              <span className="text-[#7A5C68] tabular-nums">
                Tersedia: {formatRupiah(maxAvailable)}
              </span>
            </div>
            <input
              type="number"
              inputMode="numeric"
              required
              min="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 20000"
              className="w-full rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2.5 font-heading font-black text-lg text-[#2D1E24] tabular-nums focus:outline-none focus:border-[#F45B84]"
            />
          </div>

          <button
            type="submit"
            className="tactile-tap btn-pink-pill w-full py-3 px-4 text-white font-heading font-extrabold text-sm flex items-center justify-center gap-1.5"
          >
            <span>Simpan Perpindahan Saldo</span>
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SCREEN 4: PENGATURAN (PROFIL, TEMA TERANG/GELAP, NOTIFIKASI & CADANGAN DATA)
// ============================================================================

function SettingsScreen({
  userSettings,
  onUpdateSettings,
  cyclesCount,
  transactionsCount,
  onToast,
  onReloadDB,
  onLoadDemo,
  onResetAllData
}) {
  const [nameInput, setNameInput] = useState(userSettings.userName || '');
  const [confirmReset, setConfirmReset] = useState(false);
  const restoreInputRef = useRef(null);

  const handleSaveName = (e) => {
    e.preventDefault();
    const cleaned = nameInput.trim();
    if (!cleaned) {
      onToast('Nama panggilan tidak boleh kosong');
      return;
    }
    onUpdateSettings({ userName: cleaned });
    onToast(`Nama diperbarui menjadi ${cleaned}`);
  };

  const handleBackupJSON = async () => {
    const [cycles, buckets, transactions] = await Promise.all([
      santriDB.getAll('cycles'),
      santriDB.getAll('buckets'),
      santriDB.getAll('transactions')
    ]);
    const payload = {
      app: 'SantriFlow Local',
      exportedAt: new Date().toISOString(),
      settings: userSettings,
      cycles,
      buckets,
      transactions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SantriFlow_Cadangan_${getDateISO(0)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('File cadangan berhasil diunduh');
  };

  const handleRestoreJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.cycles) || !Array.isArray(parsed.buckets)) {
        onToast('Format file cadangan tidak sesuai');
        return;
      }
      await santriDB.clearAll();
      for (const c of parsed.cycles) await santriDB.put('cycles', c);
      for (const b of parsed.buckets) await santriDB.put('buckets', b);
      for (const t of parsed.transactions || []) await santriDB.put('transactions', t);
      if (parsed.settings && typeof parsed.settings === 'object') {
        onUpdateSettings(parsed.settings);
        if (parsed.settings.userName) setNameInput(parsed.settings.userName);
      }
      await onReloadDB();
      onToast('Seluruh catatan berhasil dipulihkan');
    } catch {
      onToast('Gagal membaca file cadangan');
    } finally {
      e.target.value = '';
    }
  };

  const thresholds = [10, 20, 30];
  const thresholdIndex = Math.max(0, thresholds.indexOf(userSettings.lowJajanThreshold));

  return (
    <div className="space-y-4">
      {/* Header Card with Loopy */}
      <section className="card-cute p-4 flex items-center justify-between gap-3">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFEFF4] text-[#F45B84] text-[11px] font-heading font-extrabold mb-1">
            Pengaturan Aplikasi
          </span>
          <h2 className="font-heading font-black text-lg text-[#2D1E24] leading-tight">
            Profil, Tema &amp; Penyimpanan
          </h2>
          <p className="text-xs text-[#7A5C68] mt-0.5">
            Sesuaikan nama panggilan, warna tema, dan cadangan buku kasmu.
          </p>
        </div>
        <LoopyMascot mood="cool" className="w-16 h-16 shrink-0" />
      </section>

      {/* 1. PROFIL SANTRI */}
      <section className="card-cute p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">Profil Santri</h3>
            <p className="text-[11px] text-[#7A5C68]">Ditampilkan pada sapaan di halaman utama</p>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Masukkan nama panggilan..."
            className="flex-1 min-w-0 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] px-3.5 py-2 text-xs sm:text-sm font-heading font-bold text-[#2D1E24] focus:outline-none focus:border-[#F45B84]"
          />
          <button
            type="submit"
            className="tactile-tap btn-pink-pill px-4 py-2 text-white font-heading font-extrabold text-xs shrink-0"
          >
            Simpan
          </button>
        </form>
      </section>

      {/* 2. TAMPILAN TEMA (TERANG / GELAP) */}
      <section className="card-cute p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center">
            {userSettings.theme === 'dark' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">Tema Tampilan</h3>
            <p className="text-[11px] text-[#7A5C68]">
              Pilih tema terang pastel atau tema gelap yang nyaman di malam hari
            </p>
          </div>
        </div>

        <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
          <div
            aria-hidden="true"
            className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#F45B84] shadow-xs"
            style={{
              transform: userSettings.theme === 'light' ? 'translateX(0%)' : 'translateX(100%)'
            }}
          />
          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ theme: 'light' });
              onToast('Tema Terang Pastel aktif');
            }}
            className={`tactile-tap relative z-10 py-2 px-3 rounded-full text-xs font-heading font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors duration-200 ${
              userSettings.theme === 'light' ? 'text-white' : 'text-[#7A5C68]'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Mode Terang</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ theme: 'dark' });
              onToast('Tema Gelap Malam aktif');
            }}
            className={`tactile-tap relative z-10 py-2 px-3 rounded-full text-xs font-heading font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors duration-200 ${
              userSettings.theme === 'dark' ? 'text-white' : 'text-[#7A5C68]'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Mode Gelap</span>
          </button>
        </div>
      </section>

      {/* 3. PENGATURAN PENGINGAT & PEMBULATAN BUKU KAS */}
      <section className="card-cute p-4 space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#FFEFF4] text-[#F45B84] flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">
              Pengingat Jajan &amp; Pembulatan
            </h3>
            <p className="text-[11px] text-[#7A5C68]">
              Atur kapan Loopy mengingatkan sisa jajan dan pembulatan angka baru
            </p>
          </div>
        </div>

        {/* Batas Peringatan Sisa Jajan */}
        <div>
          <span className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
            Ingatkan Saat Sisa Jajan di Bawah:
          </span>
          <div className="relative grid grid-cols-3 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
            <div
              aria-hidden="true"
              className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-full bg-[#F45B84]"
              style={{
                transform: `translateX(${thresholdIndex * 100}%)`
              }}
            />
            {thresholds.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  onUpdateSettings({ lowJajanThreshold: pct });
                  onToast(`Batas pengingat jajan diatur ke ${pct}%`);
                }}
                className={`tactile-tap relative z-10 py-1.5 rounded-full text-xs font-heading font-extrabold tabular-nums transition-colors duration-200 ${
                  userSettings.lowJajanThreshold === pct ? 'text-white' : 'text-[#7A5C68]'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Pembulatan Bawaan Kiriman Baru */}
        <div>
          <span className="block text-xs font-heading font-extrabold text-[#7A5C68] mb-1.5">
            Pembulatan Bawaan Saat Kiriman Baru:
          </span>
          <div className="relative grid grid-cols-2 p-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4]">
            <div
              aria-hidden="true"
              className="sliding-pill-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-[#F45B84]"
              style={{
                transform: userSettings.defaultRounding === 1000 ? 'translateX(0%)' : 'translateX(100%)'
              }}
            />
            {[1000, 500].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => {
                  onUpdateSettings({ defaultRounding: step });
                  onToast(`Pembulatan bawaan ${formatRupiah(step)}`);
                }}
                className={`tactile-tap relative z-10 py-1.5 rounded-full text-xs font-heading font-extrabold tabular-nums transition-colors duration-200 ${
                  userSettings.defaultRounding === step ? 'text-white' : 'text-[#7A5C68]'
                }`}
              >
                Kelipatan {formatRupiah(step)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PENYIMPANAN LOKAL & CADANGAN DATA */}
      <section className="card-cute p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#E8F8F0] text-[#2EB872] flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-[#2D1E24]">
              Penyimpanan Permanen di HP
            </h3>
            <p className="text-[11px] text-[#7A5C68] tabular-nums">
              {cyclesCount} siklus kiriman • {transactionsCount} catatan tersimpan aman
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] p-3 text-xs text-[#7A5C68] leading-relaxed">
          Data tersimpan di memori permanen HP. Aplikasi aman ditutup dari latar belakang maupun
          dipakai tanpa kuota internet tanpa takut catatan hilang.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleBackupJSON}
            className="tactile-tap py-2.5 px-3 rounded-2xl bg-[#FFEFF4] text-[#F45B84] font-heading font-extrabold text-xs flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Simpan Cadangan</span>
          </button>

          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="tactile-tap py-2.5 px-3 rounded-2xl bg-[#FFF8FA] border border-[#FAD9E4] text-[#2D1E24] font-heading font-extrabold text-xs flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#4F7DF3]" />
            <span>Pulihkan Data</span>
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreJSON}
            className="hidden"
          />
        </div>

        <div className="pt-2 border-t border-[#FAD9E4] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onLoadDemo}
            className="tactile-tap inline-flex items-center gap-1 text-xs font-heading font-bold text-[#7A5C68] hover:text-[#F45B84]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat Contoh Simulasi</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="tactile-tap inline-flex items-center gap-1 text-xs font-heading font-extrabold text-[#E0436E]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Ulang dari Awal</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-pop-in">
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetAllData();
                }}
                className="tactile-tap px-2.5 py-1 rounded-full bg-[#E0436E] text-white text-[11px] font-heading font-extrabold"
              >
                Ya, Hapus Semua
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="tactile-tap px-2.5 py-1 rounded-full bg-[#FFF8FA] border border-[#FAD9E4] text-[#7A5C68] text-[11px] font-heading font-bold"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}