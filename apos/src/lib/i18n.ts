/**
 * Sistema de internacionalização (i18n) para o Green Game
 * Este módulo permite preparar o sistema para suportar múltiplos idiomas no futuro
 */

// Lista de idiomas suportados
export type SupportedLocale = 'pt-BR' | 'en-US' | 'es';

// Interface para registro de traduções
interface TranslationMap {
  [key: string]: {
    [locale in SupportedLocale]?: string;
  };
}

// Armazenamento global de traduções
const translations: TranslationMap = {};

// Idioma padrão
const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

// Idioma atual
let currentLocale: SupportedLocale = DEFAULT_LOCALE;

/**
 * Define o idioma atual
 */
export const setLocale = (locale: SupportedLocale) => {
  currentLocale = locale;
  // Armazenar preferência do usuário (caso estejamos no browser)
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
};

/**
 * Obtém o idioma atual
 */
export const getLocale = (): SupportedLocale => {
  // Se estivermos no browser, verificar se há uma preferência salva
  if (typeof window !== 'undefined') {
    const savedLocale = localStorage.getItem('locale') as SupportedLocale;
    if (savedLocale && isValidLocale(savedLocale)) {
      currentLocale = savedLocale;
    }
  }
  return currentLocale;
};

/**
 * Verifica se um locale é válido
 */
const isValidLocale = (locale: string): locale is SupportedLocale => {
  return ['pt-BR', 'en-US', 'es'].includes(locale);
};

/**
 * Registra uma ou mais traduções
 */
export const registerTranslations = (newTranslations: TranslationMap) => {
  Object.keys(newTranslations).forEach(key => {
    translations[key] = {
      ...translations[key],
      ...newTranslations[key]
    };
  });
};

/**
 * Função de tradução
 * Uso: t('hello_world')
 * Com parâmetros: t('welcome_user', { name: 'João' })
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
  // Buscar tradução no idioma atual
  const translation = translations[key]?.[currentLocale] || translations[key]?.[DEFAULT_LOCALE];
  
  // Se não houver tradução, retornar a chave
  if (!translation) {
    return key;
  }
  
  // Se houver parâmetros, substituir no texto
  if (params) {
    return Object.keys(params).reduce((text, param) => {
      const value = String(params[param]);
      // Substituir {paramName} pelo valor
      return text.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
    }, translation);
  }
  
  return translation;
};

/**
 * Registrar traduções iniciais para mensagens comuns do sistema
 */
registerTranslations({
  'error.generic': {
    'pt-BR': 'Ocorreu um erro inesperado. Por favor, tente novamente.',
    'en-US': 'An unexpected error occurred. Please try again.',
    'es': 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.'
  },
  'success.generic': {
    'pt-BR': 'Operação realizada com sucesso!',
    'en-US': 'Operation completed successfully!',
    'es': '¡Operación realizada con éxito!'
  },
  'auth.login': {
    'pt-BR': 'Entrar',
    'en-US': 'Login',
    'es': 'Iniciar sesión'
  },
  'auth.register': {
    'pt-BR': 'Cadastrar',
    'en-US': 'Register',
    'es': 'Registrarse'
  },
  'auth.logout': {
    'pt-BR': 'Sair',
    'en-US': 'Logout',
    'es': 'Cerrar sesión'
  },
  'game.bet.above': {
    'pt-BR': 'Apostar Acima',
    'en-US': 'Bet Above',
    'es': 'Apostar Arriba'
  },
  'game.bet.below': {
    'pt-BR': 'Apostar Abaixo',
    'en-US': 'Bet Below',
    'es': 'Apostar Abajo'
  },
  'profile.balance': {
    'pt-BR': 'Saldo: {amount}',
    'en-US': 'Balance: {amount}',
    'es': 'Saldo: {amount}'
  },
  'bet.limit.daily': {
    'pt-BR': 'Limite diário de apostas: {amount}',
    'en-US': 'Daily bet limit: {amount}',
    'es': 'Límite diario de apuestas: {amount}'
  }
});

// Exportar uma função para formatar valores monetários conforme o locale
export const formatCurrency = (value: number): string => {
  const currencyFormatters = {
    'pt-BR': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    'en-US': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    'es': new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
  };
  
  return currencyFormatters[currentLocale]?.format(value) || 
         currencyFormatters[DEFAULT_LOCALE].format(value);
};

// Função para obter o locale do usuário com base no navegador
export const detectUserLocale = (): SupportedLocale => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }
  
  const browserLocale = navigator.language;
  
  // Verificar correspondência direta
  if (isValidLocale(browserLocale)) {
    return browserLocale;
  }
  
  // Verificar idioma base (ex: 'en-GB' corresponde a 'en-US')
  const baseLanguage = browserLocale.split('-')[0];
  if (baseLanguage === 'en') return 'en-US';
  if (baseLanguage === 'es') return 'es';
  if (baseLanguage === 'pt') return 'pt-BR';
  
  // Usar idioma padrão como fallback
  return DEFAULT_LOCALE;
}; 