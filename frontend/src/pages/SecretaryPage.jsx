import { useEffect, useRef, useState } from "react";
import { Mic, Send, Paperclip, Calendar, DollarSign, Loader2 } from "lucide-react";
import { BrushCleaning } from "../components/icons/BrushCleaning";
import { useClients, useCreateClient, useCreateExpense, useCreateMeeting, useCreateReminder, useGenerateSecretaryReplyAudio, useProcessSecretary, useTranscribeSecretary, useUpdateSettings } from "../hooks/useApi";
import { useSettingsStore } from "../store/settingsStore";

const createDefaultGreetingMessage = () => ({
  id: "initial",
  sender: "bot",
  text: "Assalomu alekum, hojayn bugunga qanday uchrashuvlar belgilay",
  time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
});

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const normalizeToIso = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value).trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  return null;
};

const mapRecurrenceToFrequency = (recurrence) => {
  if (recurrence === "daily") return { frequency_value: 1, frequency_unit: "day" };
  if (recurrence === "weekly") return { frequency_value: 1, frequency_unit: "week" };
  if (recurrence === "monthly") return { frequency_value: 1, frequency_unit: "custom" };
  return { frequency_value: null, frequency_unit: null };
};

// Remove old WaveAnimation

export function SecretaryPage() {
  const settings = useSettingsStore((state) => state.settings);
  const timezone = settings?.timezone || "Asia/Tashkent";

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("kotiba_chat_messages");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [createDefaultGreetingMessage()];
  });

  const [inputValue, setInputValue] = useState(() => {
    return localStorage.getItem("kotiba_chat_input") || "";
  });
  
  const [voiceState, setVoiceState] = useState("idle"); // idle, recording, transcribing
  const [aiThinking, setAiThinking] = useState(false);
  const [pendingMeeting, setPendingMeeting] = useState(null);
  const [clearNotice, setClearNotice] = useState("");
  const messagesEndRef = useRef(null);

  const processMutation = useProcessSecretary();
  const transcribeMutation = useTranscribeSecretary();
  const createMeeting = useCreateMeeting();
  const createClient = useCreateClient();
  const createExpense = useCreateExpense();
  const createReminder = useCreateReminder();
  const updateSettings = useUpdateSettings();
  const generateReplyAudio = useGenerateSecretaryReplyAudio();
  const clientsQuery = useClients();

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const assistantAudioRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    localStorage.setItem("kotiba_chat_messages", JSON.stringify(messages));
    scrollToBottom();
  }, [messages, aiThinking]);

  useEffect(() => {
    localStorage.setItem("kotiba_chat_input", inputValue);
  }, [inputValue]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      if (assistantAudioRef.current) {
        assistantAudioRef.current.pause();
        assistantAudioRef.current = null;
      }
    };
  }, []);

  const addMessage = (msg) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(),
        time: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        ...msg,
      },
    ]);
  };

  const clearChat = () => {
    setMessages([createDefaultGreetingMessage()]);
    setInputValue("");
    setPendingMeeting(null);
    setClearNotice("Chat tozalandi");
    setTimeout(() => setClearNotice(""), 1500);
  };

  const playAssistantReply = async (replyText) => {
    if (!settings?.audio_enabled || !replyText) return;

    try {
      const audioData = await generateReplyAudio.mutateAsync({
        text: replyText,
        voice: settings?.tts_voice || "lola",
      });

      if (!audioData?.audio_url) return;

      if (assistantAudioRef.current) {
        assistantAudioRef.current.pause();
        assistantAudioRef.current.currentTime = 0;
      }

      const audio = new Audio(audioData.audio_url);
      assistantAudioRef.current = audio;
      await audio.play();
    } catch {
      // keep chat reply even if voice generation fails
    }
  };

  const ensureClientId = async (personName) => {
    const clients = clientsQuery.data?.items || [];
    
    if (personName && typeof personName === "string") {
      const existing = clients.find(c => c.name.toLowerCase() === personName.toLowerCase());
      if (existing) return existing.id;
      
      const created = await createClient.mutateAsync({
        name: personName,
        phone: "",
        notes: "Avtomatik saqlandi (AI Kotiba)",
      });
      return created?.client?.id || created?.id;
    }
    
    if (clients.length > 0) return clients[0].id;
    const created = await createClient.mutateAsync({
      name: "Noma'lum Kontakt",
      notes: "Avtomatik saqlandi",
    });
    return created?.client?.id || created?.id;
  };

  const submitSecretaryText = async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) return;
    addMessage({ sender: "user", text });
    
    setAiThinking(true);
    try {
      const result = await processMutation.mutateAsync({ text, timezone, context: pendingMeeting });
      const parsed = result.parsed || {};
      const intent = parsed.intent;
      const normalizedTime = normalizeToIso(parsed.datetimeIso);
      const monthlySalary = Number(parsed.monthlySalary || 0);
      let replyText = parsed.reply || "Tushunarli.";

      if (Number.isFinite(monthlySalary) && monthlySalary > 0) {
        setPendingMeeting(null);
        try {
          await updateSettings.mutateAsync({ monthly_salary: monthlySalary });
          replyText =
            parsed.reply || `Tushundim, oylik maoshingiz ${monthlySalary.toLocaleString("uz-UZ")} so'm qilib saqlandi.`;
        } catch (e) {
          replyText = "Kechirasiz, oylik maoshni saqlashda xatolik yuz berdi.";
        }
      } else if (intent === "meeting") {
        setPendingMeeting(null);
        try {
          const personName = parsed.person;
          const clientId = await ensureClientId(personName);
          const scheduledTime = normalizedTime || new Date(Date.now() + 3600000).toISOString(); // Default to +1 hour if missing
          const fallbackTitle = text.length > 25 ? text.substring(0, 25) + "..." : text;
          
          await createMeeting.mutateAsync({
            title: parsed.title && parsed.title.length > 3 && parsed.title !== "Reminder" ? parsed.title : fallbackTitle,
            meeting_datetime: scheduledTime,
            client_id: clientId,
            auto_message_enabled: true,
            enable_audio_reminder: false,
            reminder_interval: null,
          });
        } catch (e) {
          replyText = "Kechirasiz, uchrashuvni tizimga saqlashda xatolik yuz berdi.";
        }
      } else if (intent === "expense") {
        setPendingMeeting(null);
        try {
          const expenseData = parsed.expense;
          if (expenseData && expenseData.amount) {
            await createExpense.mutateAsync({
              amount: Number(expenseData.amount),
              category: expenseData.title || expenseData.category || "Boshqa",
              date: expenseData.date || new Date().toISOString().split("T")[0],
              currency: expenseData.currency || "UZS",
              title: expenseData.title || parsed.title || text,
              note: parsed.note || result.cleanedText || text,
            });
          }
        } catch (e) {
          replyText = "Kechirasiz, xarajatni saqlashda xatolik yuz berdi.";
        }
      } else if (intent === "reminder" || intent === "task") {
        setPendingMeeting(null);
        try {
          const hasDateTime = Boolean(normalizedTime);
          const recurrence = parsed.recurrence || "none";
          const frequency = mapRecurrenceToFrequency(recurrence);
          await createReminder.mutateAsync({
            title: parsed.title || (text.length > 30 ? `${text.slice(0, 30)}...` : text),
            original_text: result.originalText || text,
            cleaned_text: result.cleanedText || text,
            next_run_at: hasDateTime ? normalizedTime : "2099-01-01T09:00:00.000Z",
            tts_voice: settings?.tts_voice || "lola",
            ...frequency,
            status: hasDateTime ? "active" : "paused",
            parsed_data: {
              intent: "reminder",
              task_intent: intent,
            recurrence,
            has_date: hasDateTime,
            has_time: hasDateTime,
            reminder_message: parsed.reminderMessage || parsed.note || parsed.title || text,
            reminder_audio_text: parsed.reminderMessage || parsed.note || parsed.title || text,
            tts_voice: settings?.tts_voice || "lola",
          },
        });
        replyText = parsed.reply || (intent === "task" ? "Vazifa saqlandi." : "Eslatma saqlandi.");
        } catch (e) {
          replyText = intent === "task"
            ? "Kechirasiz, vazifani saqlashda xatolik yuz berdi."
            : "Kechirasiz, eslatmani saqlashda xatolik yuz berdi.";
        }
      } else if (intent === "incomplete_meeting") {
        setPendingMeeting({ datetimeIso: parsed.datetimeIso });
      } else {
        setPendingMeeting(null);
      }

      await playAssistantReply(replyText);
      addMessage({ sender: "bot", text: replyText });

    } catch (error) {
      addMessage({ sender: "bot", text: "Xatolik yuz berdi. Iltimos qayta urinib ko'ring." });
    } finally {
      setAiThinking(false);
    }
  };

  const handleSendText = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    await submitSecretaryText(text);
  };

  const startRecording = async () => {
    if (voiceState === "transcribing" || voiceState === "recording" || aiThinking) return;
    
    setVoiceState("recording");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          setVoiceState("transcribing");
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const audioBase64 = await toBase64(blob);
          
          const result = await transcribeMutation.mutateAsync({ audioBase64 });
          const textReceived = result.text || "";
          if (textReceived) {
            setInputValue((prev) => (prev ? `${prev} ${textReceived}`.trim() : textReceived));
          }
        } catch (error) {
          addMessage({ sender: "bot", text: "Ovozdan matnga aylantirishda xatolik yuz berdi." });
        } finally {
          setVoiceState("idle");
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      recorder.start();
    } catch {
      setVoiceState("error");
      addMessage({ sender: "bot", text: "Mikrofonga ruxsat berilmagan." });
      setVoiceState("idle");
    }
  };

  const stopRecording = () => {
    if (voiceState !== "recording") return;
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  return (
    <div className="flex flex-col h-full bg-[#f3f4f6] overflow-hidden relative border-none sm:border-l sm:border-slate-200 shadow-inner">
      
      <button 
        onClick={clearChat}
        className="absolute right-4 top-4 p-2.5 bg-white shadow-md text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-full transition-colors flex items-center justify-center z-50 hover:scale-105 active:scale-95"
        title="Suhbatni tozalash"
      >
        <BrushCleaning className="w-5 h-5" />
      </button>

      {clearNotice && (
        <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 shadow-sm border border-emerald-200">
          {clearNotice}
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-40 pt-16">
        <div className="flex flex-col items-center mb-6 relative group">
          <div className="flex items-center gap-2.5 bg-white rounded-full px-2.5 py-1.5 shadow-sm mb-4 border border-teal-100/50 hover:border-teal-200 transition-colors">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-teal-100/80 shadow-inner group-hover:scale-105 transition-transform">
              <img src="/asalxon_avatar.png?v=3" alt="Asalxon" className="w-full h-full object-cover object-center" />
            </div>
            <div className="flex flex-col">
               <span className="text-[12px] font-bold text-teal-800 leading-tight">Asalxon</span>
               <span className="text-[10px] font-medium text-teal-500/80 leading-tight">Onlayn</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-slate-800">Intellektual Suhbat</h3>
          <p className="text-sm text-slate-500 mt-1">Bugun sizga qanday yordam bera olaman?</p>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mb-1 px-1 uppercase tracking-wider">
              {msg.sender === "user" ? "SIZ" : "ASALXON"} • {msg.time}
            </span>
            <div
              className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 text-[14px] md:text-[15px] leading-relaxed relative ${
                msg.sender === "user"
                  ? "bg-[#e2f5ee] text-slate-800 rounded-2xl rounded-tr-sm"
                  : "bg-white text-slate-800 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {aiThinking && (
           <div className="flex flex-col items-start">
             <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 mb-1 px-1 uppercase tracking-wider">
               ASALXON • {new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
             </span>
             <div className="bg-white px-4 py-3.5 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 inline-flex items-center gap-1.5 h-10">
                <div className="w-1.5 h-1.5 bg-slate-400/80 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400/80 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400/80 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
             </div>
           </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-[23px] left-0 right-0 z-10 px-3">
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto no-scrollbar pointer-events-none">
            <div className="flex w-max gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  setInputValue("Bugun 15:00 da uchrashuv belgilab ber");
                }}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50"
              >
                <Calendar size={16} className="text-slate-400" />
                Uchrashuv belgilash
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button className="hidden shrink-0 p-2 text-slate-500 hover:text-slate-700 md:block">
              <Paperclip size={22} />
            </button>

            <div className="relative flex h-[52px] flex-1 items-center overflow-hidden rounded-full border border-slate-200 bg-white px-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-colors focus-within:border-[#149B7A] focus-within:ring-1 focus-within:ring-[#149B7A]">
              {voiceState === "transcribing" ? (
                <div className="flex flex-1 items-center gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin text-[#149B7A]" />
                  <span className="text-[14.5px]">Ovoz aniqlanmoqda...</span>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendText();
                    }}
                    placeholder={voiceState === "recording" ? "Eshitilmoqda..." : "Xabar yozing..."}
                    className={`flex-1 border-none bg-transparent py-3 text-[15px] focus:outline-none ${
                      voiceState === "recording" ? "animate-pulse text-red-500 placeholder-red-400" : "placeholder-slate-400"
                    }`}
                    disabled={aiThinking || voiceState === "recording"}
                  />
                  <button
                    onPointerDown={startRecording}
                    onPointerUp={stopRecording}
                    onPointerLeave={stopRecording}
                    onPointerCancel={stopRecording}
                    disabled={aiThinking || voiceState === "recording"}
                    className={`p-2 transition-colors ${voiceState === "recording" ? "scale-110 text-red-500" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    <Mic size={20} />
                  </button>
                </>
              )}
            </div>

            <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
              {voiceState === "recording" && (
                <div className="absolute inset-0 animate-ping rounded-full bg-red-400/40" style={{ animationDuration: "1.5s" }} />
              )}
              <button
                onClick={voiceState === "recording" ? stopRecording : handleSendText}
                disabled={aiThinking || voiceState === "transcribing" || (!inputValue.trim() && voiceState !== "recording")}
                className={`relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-sm transition-all ${
                  voiceState === "recording"
                    ? "animate-pulse bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                    : !inputValue.trim()
                      ? "pointer-events-none bg-slate-300 opacity-80"
                      : "bg-[#149B7A] shadow-[0_8px_18px_rgba(20,155,122,0.24)] hover:bg-[#107c62]"
                }`}
              >
                {voiceState === "recording" ? (
                  <div className="h-4 w-4 rounded-sm bg-white" />
                ) : (
                  <Send size={18} className="translate-x-[2px] translate-y-[-1px]" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
