import { useSettingsStore } from "../store/settingsStore";
import { translations } from "../i18n/translations";

export const useI18n = () => {
  const language = useSettingsStore((state) => state.language);

  const t = (key) => {
    const langPack = translations[language] || translations.uz;
    return langPack[key] || translations.en[key] || key;
  };

  return { t, language };
};