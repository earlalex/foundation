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
    // Navigation & Utility Bar
    "Home": "Home",
    "About": "About",
    "Events": "Events",
    "Contact": "Contact",
    "Command Center": "Command Center",
    "Sign In / Register": "Sign In / Register",
    "Sign In": "Sign In",
    "Sign Out": "Sign Out",
    "My Dashboard": "My Dashboard",
    "My Profile": "My Profile",
    "Admin Dashboard": "Admin Dashboard",
    "Contrast": "Contrast",
    "Cart": "Cart",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Sovereign Developers Community Reviews",
    "Based on": "Based on",
    "Google reviews": "Google reviews",
    "Leave a Google Review": "Leave a Google Review",
    "Loading reviews...": "Loading reviews...",

    // Cart Drawer Text
    "Your cart is empty": "Your cart is empty",
    "Your Shopping Cart is Empty": "Your Shopping Cart is Empty",
    "Your registration cart is empty": "Your Shopping Cart is Empty",
    "Shopping Cart": "Shopping Cart",
    "Subtotal": "Subtotal",
    "Estimated Tax": "Estimated Tax",
    "Event Tax (8.25%)": "Estimated Tax (8.25%)",
    "Platform Service Fee": "Platform Service Fee",
    "Grand Total": "Grand Total",
    "Proceed to Secure Checkout": "Proceed to Secure Checkout",

    // Footer Links & Forms
    "Legal & Policies": "Legal & Policies",
    "Terms of Use": "Terms of Use",
    "Terms of Service": "Terms of Service",
    "Privacy Policy": "Privacy Policy",
    "Cookie Settings": "Cookie Settings",
    "Subscribe to our newsletter": "Subscribe to our newsletter",
    "Subscribe to our newsletter for exclusive updates.": "Subscribe to our newsletter for exclusive updates.",
    "Subscribe": "Subscribe",
    "Your Email Address": "Your Email Address",
    "Follow Us": "Follow Us"
  },
  es: {
    // Navigation & Utility Bar
    "Home": "Inicio",
    "About": "Acerca de",
    "Events": "Eventos",
    "Contact": "Contacto",
    "Command Center": "Centro de Comando",
    "Sign In / Register": "Iniciar Sesión / Registrarse",
    "Sign In": "Iniciar Sesión",
    "Sign Out": "Cerrar Sesión",
    "My Dashboard": "Mi Panel",
    "My Profile": "Mi Perfil",
    "Admin Dashboard": "Panel de Administración",
    "Contrast": "Contraste",
    "Cart": "Carrito",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Reseñas de la Comunidad de Desarrolladores Soberanos",
    "Based on": "Basado en",
    "Google reviews": "reseñas de Google",
    "Leave a Google Review": "Dejar una Reseña en Google",
    "Loading reviews...": "Cargando reseñas...",

    // Cart Drawer Text
    "Your cart is empty": "Su carrito está vacío",
    "Your Shopping Cart is Empty": "Su carrito de compras está vacío",
    "Your registration cart is empty": "Su carrito de compras está vacío",
    "Shopping Cart": "Carrito de Compras",
    "Subtotal": "Subtotal",
    "Estimated Tax": "Impuesto Estimado",
    "Event Tax (8.25%)": "Impuesto Estimado (8.25%)",
    "Platform Service Fee": "Tarifa de Servicio de Plataforma",
    "Grand Total": "Gran Total",
    "Proceed to Secure Checkout": "Proceder al Pago Seguro",

    // Footer Links & Forms
    "Legal & Policies": "Legal y Políticas",
    "Terms of Use": "Términos de Uso",
    "Terms of Service": "Términos del Servicio",
    "Privacy Policy": "Política de Privacidad",
    "Cookie Settings": "Configuración de Cookies",
    "Subscribe to our newsletter": "Suscríbase a nuestro boletín",
    "Subscribe to our newsletter for exclusive updates.": "Suscríbase a nuestro boletín para actualizaciones exclusivas.",
    "Subscribe": "Suscribirse",
    "Your Email Address": "Su Correo Electrónico",
    "Follow Us": "Síganos"
  },
  fr: {
    // Navigation & Utility Bar
    "Home": "Accueil",
    "About": "À propos",
    "Events": "Événements",
    "Contact": "Contact",
    "Command Center": "Centre de Commandement",
    "Sign In / Register": "Se Connecter / S'enregistrer",
    "Sign In": "Se Connecter",
    "Sign Out": "Se Déconnecter",
    "My Dashboard": "Mon Tableau de bord",
    "My Profile": "Mon Profil",
    "Admin Dashboard": "Tableau d'administration",
    "Contrast": "Contraste",
    "Cart": "Panier",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Avis de la Communauté des Développeurs Souverains",
    "Based on": "Basé sur",
    "Google reviews": "avis Google",
    "Leave a Google Review": "Laisser un Avis Google",
    "Loading reviews...": "Chargement des avis...",

    // Cart Drawer Text
    "Your cart is empty": "Votre panier est vide",
    "Your Shopping Cart is Empty": "Votre panier est vide",
    "Your registration cart is empty": "Votre panier est vide",
    "Shopping Cart": "Panier d'achat",
    "Subtotal": "Sous-total",
    "Estimated Tax": "Taxe Estimée",
    "Event Tax (8.25%)": "Taxe Estimée (8.25%)",
    "Platform Service Fee": "Frais de Service de Plateforme",
    "Grand Total": "Total Général",
    "Proceed to Secure Checkout": "Passer à la Caisse Sécurisée",

    // Footer Links & Forms
    "Legal & Policies": "Mentions Légales & Politiques",
    "Terms of Use": "Conditions d'Utilisation",
    "Terms of Service": "Conditions de Service",
    "Privacy Policy": "Politique de Confidentialité",
    "Cookie Settings": "Paramètres des Cookies",
    "Subscribe to our newsletter": "Abonnez-vous à notre newsletter",
    "Subscribe to our newsletter for exclusive updates.": "Abonnez-vous à notre newsletter pour des mises à jour exclusives.",
    "Subscribe": "S'abonner",
    "Your Email Address": "Votre Adresse E-mail",
    "Follow Us": "Suivez-nous"
  },
  de: {
    // Navigation & Utility Bar
    "Home": "Startseite",
    "About": "Über uns",
    "Events": "Termine",
    "Contact": "Kontakt",
    "Command Center": "Kommandozentrale",
    "Sign In / Register": "Anmelden / Registrieren",
    "Sign In": "Anmelden",
    "Sign Out": "Abmelden",
    "My Dashboard": "Mein Dashboard",
    "My Profile": "Mein Profil",
    "Admin Dashboard": "Admin-Dashboard",
    "Contrast": "Kontrast",
    "Cart": "Warenkorb",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Bewertungen der Sovereign Developers Community",
    "Based on": "Basierend auf",
    "Google reviews": "Google-Bewertungen",
    "Leave a Google Review": "Google-Bewertung abgeben",
    "Loading reviews...": "Bewertungen werden geladen...",

    // Cart Drawer Text
    "Your cart is empty": "Ihr Warenkorb ist leer",
    "Your Shopping Cart is Empty": "Ihr Warenkorb ist leer",
    "Your registration cart is empty": "Ihr Warenkorb ist leer",
    "Shopping Cart": "Warenkorb",
    "Subtotal": "Zwischensumme",
    "Estimated Tax": "Geschätzte Steuer",
    "Event Tax (8.25%)": "Geschätzte Steuer (8.25%)",
    "Platform Service Fee": "Plattform-Servicegebühr",
    "Grand Total": "Gesamtsumme",
    "Proceed to Secure Checkout": "Zur sicheren Kasse",

    // Footer Links & Forms
    "Legal & Policies": "Rechtliches & Richtlinien",
    "Terms of Use": "Nutzungsbedingungen",
    "Terms of Service": "Nutzungsbedingungen",
    "Privacy Policy": "Datenschutz-Bestimmungen",
    "Cookie Settings": "Cookie-Einstellungen",
    "Subscribe to our newsletter": "Newsletter abonnieren",
    "Subscribe to our newsletter for exclusive updates.": "Abonnieren Sie unseren Newsletter für exklusive Updates.",
    "Subscribe": "Abonnieren",
    "Your Email Address": "Ihre E-Mail-Adresse",
    "Follow Us": "Folgen Sie uns"
  },
  ja: {
    // Navigation & Utility Bar
    "Home": "ホーム",
    "About": "紹介",
    "Events": "イベント",
    "Contact": "連絡先",
    "Command Center": "管理センター",
    "Sign In / Register": "サインイン / 登録",
    "Sign In": "サインイン",
    "Sign Out": "サインアウト",
    "My Dashboard": "ダッシュボード",
    "My Profile": "プロフィール",
    "Admin Dashboard": "管理者ダッシュボード",
    "Contrast": "コントラスト",
    "Cart": "カート",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Sovereign Developers コミュニティのレビュー",
    "Based on": "基準:",
    "Google reviews": "件のGoogleレビュー",
    "Leave a Google Review": "Googleレビューを書く",
    "Loading reviews...": "レビューを読み込み中...",

    // Cart Drawer Text
    "Your cart is empty": "カートは空です",
    "Your Shopping Cart is Empty": "ショッピングカートは空です",
    "Your registration cart is empty": "ショッピングカートは空です",
    "Shopping Cart": "ショッピングカート",
    "Subtotal": "小計",
    "Estimated Tax": "見積もり税額",
    "Event Tax (8.25%)": "見積もり税額 (8.25%)",
    "Platform Service Fee": "プラットフォーム手数料",
    "Grand Total": "合計金額",
    "Proceed to Secure Checkout": "安全な決済へ進む",

    // Footer Links & Forms
    "Legal & Policies": "法的情報とポリシー",
    "Terms of Use": "利用規約",
    "Terms of Service": "利用規約",
    "Privacy Policy": "プライバシーポリシー",
    "Cookie Settings": "クッキー設定",
    "Subscribe to our newsletter": "ニュースレターに登録",
    "Subscribe to our newsletter for exclusive updates.": "限定情報を入手するにはニュースレターにご登録ください。",
    "Subscribe": "登録する",
    "Your Email Address": "メールアドレス",
    "Follow Us": "フォローする"
  },
  zh: {
    // Navigation & Utility Bar
    "Home": "首页",
    "About": "关于",
    "Events": "活动",
    "Contact": "联系我们",
    "Command Center": "控制中心",
    "Sign In / Register": "登录 / 注册",
    "Sign In": "登录",
    "Sign Out": "退出登录",
    "My Dashboard": "我的面板",
    "My Profile": "个人资料",
    "Admin Dashboard": "管理后台",
    "Contrast": "高对比度",
    "Cart": "购物车",

    // Google Reviews Widget
    "Sovereign Developers Community Reviews": "Sovereign Developers 社区评价",
    "Based on": "基于",
    "Google reviews": "条 Google 评价",
    "Leave a Google Review": "发表 Google 评价",
    "Loading reviews...": "正在加载评价...",

    // Cart Drawer Text
    "Your cart is empty": "您的购物车是空的",
    "Your Shopping Cart is Empty": "您的购物车是空的",
    "Your registration cart is empty": "您的购物车是空的",
    "Shopping Cart": "购物车",
    "Subtotal": "小计",
    "Estimated Tax": "预估税费",
    "Event Tax (8.25%)": "预估税费 (8.25%)",
    "Platform Service Fee": "平台服务费",
    "Grand Total": "总计",
    "Proceed to Secure Checkout": "前往安全结账",

    // Footer Links & Forms
    "Legal & Policies": "法律与政策",
    "Terms of Use": "使用条款",
    "Terms of Service": "服务条款",
    "Privacy Policy": "隐私政策",
    "Cookie Settings": "Cookie 设置",
    "Subscribe to our newsletter": "订阅我们的简报",
    "Subscribe to our newsletter for exclusive updates.": "订阅我们的电子报以获取独家资讯。",
    "Subscribe": "订阅",
    "Your Email Address": "您的电子邮箱",
    "Follow Us": "关注我们"
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

    // Dispatch global custom events for Web Components and active listeners
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  }

  translateText(key) {
    if (!key) return key;
    const cleanKey = String(key).trim();
    const dict = dictionaries[this.currentLanguage] || dictionaries.en;
    if (dict[cleanKey]) {
      return dict[cleanKey];
    }
    // Fallback search in English dictionary or return original
    return dictionaries.en[cleanKey] || key;
  }

  translatePage() {
    // 1. Elements with explicit data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.translateText(key);
      }
    });

    // 2. Iterate nav links and automatically translate common navbar tags
    document.querySelectorAll('.nav-link, .dynamic-nav-link').forEach(link => {
      const text = link.textContent.trim();
      if (text && dictionaries.en[text]) {
        link.textContent = this.translateText(text);
      }
    });

    // 3. Translate Placeholders & Aria Labels if matching dictionary keys exist
    document.querySelectorAll('[placeholder]').forEach(el => {
      const ph = el.getAttribute('placeholder')?.trim();
      if (ph && dictionaries.en[ph]) {
        el.setAttribute('placeholder', this.translateText(ph));
      }
    });

    document.querySelectorAll('[aria-label]').forEach(el => {
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria && dictionaries.en[aria]) {
        el.setAttribute('aria-label', this.translateText(aria));
      }
    });

    // 4. Update Cart Text in navigation
    document.querySelectorAll('.nav-cart-text').forEach(cartText => {
      cartText.textContent = this.translateText("Cart");
    });
  }
}

export const i18n = new TranslationEngine();
