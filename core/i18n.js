// core/i18n.js
import { store } from './store.js';

export const locales = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  zh: 'Chinese'
};

const dictionaries = {
  en: {
    "Home": "Home",
    "About": "About",
    "Events": "Events",
    "Contact": "Contact",
    "Command Center": "Command Center",
    "Sign In / Register": "Sign In / Register",
    "My Dashboard": "My Dashboard",
    "Cart": "Cart"
  },
  es: {
    "Home": "Inicio",
    "About": "Acerca de",
    "Events": "Eventos",
    "Contact": "Contacto",
    "Command Center": "Centro de Comando",
    "Sign In / Register": "Iniciar Sesión / Registrarse",
    "My Dashboard": "Mi Panel",
    "Cart": "Carrito"
  },
  fr: {
    "Home": "Accueil",
    "About": "À propos",
    "Events": "Événements",
    "Contact": "Contact",
    "Command Center": "Centre de Commandement",
    "Sign In / Register": "Se Connecter / S'enregistrer",
    "My Dashboard": "Mon Tableau de bord",
    "Cart": "Panier"
  },
  de: {
    "Home": "Startseite",
    "About": "Über uns",
    "Events": "Termine",
    "Contact": "Kontakt",
    "Command Center": "Kommandozentrale",
    "Sign In / Register": "Anmelden / Registrieren",
    "My Dashboard": "Mein Dashboard",
    "Cart": "Warenkorb"
  },
  ja: {
    "Home": "ホーム",
    "About": "紹介",
    "Events": "イベント",
    "Contact": "連絡先",
    "Command Center": "管理センター",
    "Sign In / Register": "サインイン / 登録",
    "My Dashboard": "ダッシュボード",
    "Cart": "カート"
  },
  zh: {
    "Home": "首页",
    "About": "关于",
    "Events": "活动",
    "Contact": "联系我们",
    "Command Center": "控制中心",
    "Sign In / Register": "登录 / 注册",
    "My Dashboard": "我的面板",
    "Cart": "购物车"
  }
};

export class TranslationEngine {
  constructor() {
    this.currentLanguage = localStorage.getItem('foundation_language') || 'en';
  }

  setLanguage(lang) {
    if (!locales[lang]) return;
    this.currentLanguage = lang;
    localStorage.setItem('foundation_language', lang);
    console.log(`[i18n]: Language updated to ${lang} (${locales[lang]})`);
    this.translatePage();

    // Dispatch custom trigger for components/controllers
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  translateText(key) {
    const dict = dictionaries[this.currentLanguage] || dictionaries.en;
    return dict[key] || key;
  }

  translatePage() {
    // 1. Translate Dynamic Nav links & buttons with data-i18n key or simple text matching
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.translateText(key);
    });

    // 2. Iterate nav links and automatically translate common navbar tags
    document.querySelectorAll('.nav-link, .dynamic-nav-link').forEach(link => {
      const text = link.textContent.trim();
      if (text && dictionaries.en[text]) {
        link.textContent = this.translateText(text);
      }
    });

    // 3. Update Cart Text
    const cartText = document.querySelector('.nav-cart-text');
    if (cartText) {
      cartText.textContent = this.translateText("Cart");
    }
  }
}

export const i18n = new TranslationEngine();
