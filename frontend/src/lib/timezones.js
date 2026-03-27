const fallbackTimezones = [
  "Asia/Tashkent",
  "Asia/Samarkand",
  "Asia/Dubai",
  "Asia/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Almaty",
  "Asia/Singapore",
  "Asia/Bangkok",
];

export const getTimezoneList = () => {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone");
      if (Array.isArray(values) && values.length) return values;
    }
  } catch {
    // fallback below
  }
  return fallbackTimezones;
};

export const getLocalTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";
  } catch {
    return "Asia/Tashkent";
  }
};
