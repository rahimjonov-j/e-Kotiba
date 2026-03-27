import { env } from "../config/env.js";

export const sendTelegramMessage = async ({ chatId, message }) => {
  if (!env.telegramBotToken || !chatId) {
    return { delivered: false, reason: "Telegram not configured" };
  }

  const url = `https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    return { delivered: false, reason: error || "Telegram API failed" };
  }

  return { delivered: true };
};