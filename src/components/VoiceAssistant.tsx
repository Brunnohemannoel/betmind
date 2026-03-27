import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, X, Bot, Flame, Zap, Trophy, Play, TrendingUp, AlertCircle, CheckCircle2, Timer, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Match {
  id: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: number;
  awayScore: number;
  league: string;
  status: string;
  minute: number;
  intensity: number;
  confidence: number;
  suggestion: string;
  trend: string;
  hot: boolean;
  // Rich AI analysis fields from the Edge Function
  winHome: number;
  winDraw: number;
  winAway: number;
  goalChance: number;
  cornerChance: number;
  cardChance: number;
  over15: number;
  over25: number;
  redCardChance: number;
  insight: string;
  bestBetMarket: string;
  bestBetConfidence: number;
  bestBetRationale: string;
  riskLevel: string;
  pressure: number;
  momentum: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  matches?: Match[];
}

const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "https://api.torrenettelecom.com.br/ai-agent";


export const VoiceAssistant = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o **BetMind AI**. Estou monitorando milhares de eventos globais agora. O que você gostaria de saber? Tente perguntar por **'jogos quentes'**, **'melhores oportunidades'** ou o **nome de um time** específico.",
    },

  ]);
  
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const resultTranscript = event.results[current][0].transcript;
        setTranscript(resultTranscript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        if (transcript) {
          handleCommand(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, [transcript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      recognitionRef.current?.start();
      setIsListening(true);
      if (!isOpen) setIsOpen(true);
    }
  };

  const handleCommand = async (text: string) => {
    const newUserMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, newUserMessage]);
    setTranscript("");

    try {
      // 1. Buscar dados REAIS do Supabase primeiro (Fonte de Verdade)
      const { data: realData, error: sbError } = await supabase.functions.invoke("betsapi-live", {
        body: { limit: 80, sport: "football" },
      });

      if (sbError) console.error("Erro ao buscar dados reais do Supabase:", sbError);

      // Mapeia para o formato que o backend espera, incluindo TODAS as métricas reais da IA
      const contextMatches = realData?.live ? realData.live.map((m: any) => ({
        id: m.id,
        home: m.homeTeam?.name || "Casa",
        away: m.awayTeam?.name || "Visitante",
        homeLogo: m.homeTeam?.logoUrl,
        awayLogo: m.awayTeam?.logoUrl,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        league: m.league,
        minute: m.minute,
        status: "live",
        // Métricas REAIS vindas da API/VPS
        intensity: m.ai?.pressure || 0,
        confidence: m.ai?.confidence || 0.5,
        winHome: m.ai?.winHome || 0,
        winDraw: m.ai?.winDraw || 0,
        winAway: m.ai?.winAway || 0,
        goalChance: m.ai?.eventChances?.goal || 0,
        cornerChance: m.ai?.eventChances?.corner || 0,
        cardChance: m.ai?.eventChances?.card || 0,
        redCardChance: m.ai?.eventChances?.redCard || 0,
        suggestion: m.ai?.suggestion || "",
        insight: m.ai?.insight || "",
        hot: m.isHot || m.ai?.tags?.hot || false,
        trend: m.ai?.statusSignals?.trend || "estavel"
      })) : [];

      // 2. Enviar para o interpretador inteligente no Backend com o contexto REAL
      const res = await fetch(`${API_URL}/chat/interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text,
          real_matches: contextMatches 
        }),
      });

      if (!res.ok) throw new Error("Falha ao comunicar com o interpretador de IA.");
      
      const chatData = await res.json();
      const { response_text, data } = chatData;

      // Helper para converter o formato da API no objeto Match que o UI espera
      const mapApiToMatch = (item: any): Match => {
        return {
          id: item.id,
          home: item.home,
          away: item.away,
          homeLogo: item.homeLogo,
          awayLogo: item.awayLogo,
          homeScore: item.homeScore,
          awayScore: item.awayScore,
          league: item.league,
          status: item.status || "live",
          minute: item.minute || 0,
          intensity: item.intensity || 0,
          confidence: Math.round(item.confidence || 50), // Removido o *100 pois o backend já envia 0-100
          suggestion: item.suggestion || "Análise Pendente",
          trend: item.trend || "estavel",
          hot: item.hot || false,
          winHome: item.winHome || 0,
          winDraw: item.winDraw || 0,
          winAway: item.winAway || 0,
          goalChance: item.goalChance || 0,
          cornerChance: item.cornerChance || 0,
          cardChance: item.cardChance || 0,
          redCardChance: item.redCardChance || 0,
          over15: item.over15 || 0,
          over25: item.over25 || 0,
          insight: item.insight || "",
          bestBetMarket: item.bestBet?.market || item.suggestion || "Over 1.5 gols",
          bestBetConfidence: item.bestBet?.confidence || item.confidence || 50,
          bestBetRationale: item.bestBet?.rationale || "",
          riskLevel: item.riskLevel || "moderate",
          pressure: item.intensity || 0,
          momentum: Math.round((item.intensity || 0) * 0.9),
        };
      };

      const recommended = data ? data.map((m: any) => mapApiToMatch(m)) : [];

      const assistantMessage: Message = {
        role: "assistant",
        content: response_text || "Aqui está o que encontrei para você:",
        matches: recommended.slice(0, 5),
      };

      setMessages(prev => [...prev, assistantMessage]);
      speak(assistantMessage.content.replace(/\*\*/g, ''));
    } catch (error) {
      console.error("Assistant error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Desculpe, tive um problema ao acessar os dados em tempo real. Verifique sua conexão."
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleBetClick = (match: Match) => {
    setIsOpen(false);
    // Emite evento global para o Index.tsx abrir o modal de detalhes do jogo
    // Passamos o ID e também os nomes dos times para busca flexível (Fuzzy Match)
    window.dispatchEvent(new CustomEvent("open-match-analysis", { 
      detail: { 
        matchId: match.id,
        homeTeam: match.home,
        awayTeam: match.away
      } 
    }));
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
        {isListening && (
          <div className="bg-card/95 border border-primary/30 p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300 mb-2 max-w-[200px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Ouvindo...</span>
            </div>
            <p className="text-sm font-medium text-foreground italic">"{transcript || "Fale agora..."}"</p>
          </div>
        )}
        
        <Button
          onClick={toggleListening}
          size="lg"
          className={cn(
            "h-16 w-16 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 active:scale-90",
            isListening 
              ? "bg-destructive hover:bg-destructive/90 animate-voice-pulse shadow-[0_0_30px_rgba(239,68,68,0.4)]" 
              : "bg-primary hover:bg-primary/90 hover:shadow-primary/40"
          )}
        >
          {isListening ? (
            <MicOff className="h-8 w-8 text-white" />
          ) : (
            <Mic className="h-8 w-8 text-primary-foreground" />
          )}
        </Button>
      </div>

      {/* Assistant Drawer */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="bg-background/95 backdrop-blur-xl border-t border-primary/20 h-[85vh] md:h-[75vh]">
          <div className="mx-auto w-full max-w-3xl flex flex-col h-full">
            <DrawerHeader className="border-b border-border/10 pb-4 bg-muted/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                      <Bot className="h-7 w-7 text-primary" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-border">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <DrawerTitle className="text-2xl font-black tracking-tighter text-foreground uppercase">BetMind AI <span className="text-primary">Assistant</span></DrawerTitle>
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      Monitorando 2.482 eventos globais em tempo real
                    </p>
                  </div>
                </div>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                    <X className="h-6 w-6" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>

            <ScrollArea className="flex-1 px-4 py-6">
              <div className="space-y-8 max-w-2xl mx-auto pb-20">
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[90%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-lg transition-all duration-300",
                      msg.role === "user" 
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold rounded-tr-none border border-white/10" 
                        : "bg-card/40 backdrop-blur-md border border-primary/20 rounded-tl-none relative overflow-hidden"
                    )}>
                      {msg.role === "assistant" && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/60" />
                      )}
                      <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<span class="text-primary font-black">$1</span>') }} />
                    </div>

                    {msg.matches && msg.matches.length > 0 && (
                      <div className="w-full grid gap-4 mt-2">
                        {msg.matches.map((match) => (
                          <div 
                            key={match.id}
                            className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-primary/50 transition-all duration-500 group relative overflow-hidden shadow-2xl"
                          >
                            <div className={cn(
                              "absolute -inset-1 opacity-20 group-hover:opacity-30 blur-2xl transition duration-500",
                              match.hot ? "bg-primary" : "bg-primary/20"
                            )} />

                            <div className="flex flex-col gap-5 relative z-10">
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className={cn(
                                  "bg-black/40 border-primary/30 backdrop-blur-sm text-[10px] font-black px-3 py-1 gap-1.5",
                                  match.status === 'live' ? "text-primary anim-pulse" : "text-muted-foreground"
                                )}>
                                  <div className={cn("h-1.5 w-1.5 rounded-full", match.status === 'live' ? "bg-primary animate-pulse" : "bg-muted-foreground")} />
                                  {match.status === 'live' ? `${match.minute}' AO VIVO` : match.status.toUpperCase()}
                                </Badge>
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{match.league}</span>
                              </div>

                              <div className="flex items-center justify-between gap-6">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="flex items-center gap-3">
                                    <div className="relative h-14 w-14 group-hover:scale-110 transition-transform duration-500">
                                      <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg" />
                                      <div className="relative h-full w-full rounded-2xl bg-black/40 border border-white/10 p-2 overflow-hidden shadow-inner">
                                        <img src={match.homeLogo} alt="" className="h-full w-full object-contain" />
                                      </div>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-black text-white uppercase truncate max-w-[80px]">{match.home}</span>
                                      <span className="text-2xl font-black text-primary leading-none">{match.homeScore}</span>
                                    </div>
                                  </div>
                                  <div className="h-8 w-px bg-white/10 hidden sm:block" />
                                  <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-end">
                                      <span className="text-sm font-black text-white uppercase truncate max-w-[80px]">{match.away}</span>
                                      <span className="text-2xl font-black text-primary leading-none">{match.awayScore}</span>
                                    </div>
                                    <div className="relative h-14 w-14 group-hover:scale-110 transition-transform duration-500">
                                      <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg" />
                                      <div className="relative h-full w-full rounded-2xl bg-black/40 border border-white/10 p-2 overflow-hidden shadow-inner">
                                        <img src={match.awayLogo} alt="" className="h-full w-full object-contain" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Win Probabilities */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-black/20 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{match.home.substring(0,8)}</span>
                                  <span className="text-lg font-black text-primary">{match.winHome}%</span>
                                </div>
                                <div className="bg-black/20 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Empate</span>
                                  <span className="text-lg font-black text-yellow-400">{match.winDraw}%</span>
                                </div>
                                <div className="bg-black/20 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{match.away.substring(0,8)}</span>
                                  <span className="text-lg font-black text-blue-400">{match.winAway}%</span>
                                </div>
                              </div>

                              {/* Event Chances */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] text-white/40 uppercase tracking-widest">⚽ Gol</span>
                                    <span className="text-sm font-black text-white">{match.goalChance}%</span>
                                  </div>
                                  <div className="bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] text-white/40 uppercase tracking-widest">🚩 Escanteio</span>
                                    <span className="text-sm font-black text-white">{match.cornerChance}%</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] text-white/40 uppercase tracking-widest">🟡 Cartão</span>
                                    <span className="text-sm font-black text-white">{match.cardChance}%</span>
                                  </div>
                                  <div className="bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center gap-0.5 border-red-500/20">
                                    <span className="text-[8px] text-red-500/60 uppercase tracking-widest font-black">🔴 Expulsão</span>
                                    <span className="text-sm font-black text-red-500">{match.redCardChance}%</span>
                                  </div>
                                </div>
                              </div>

                              {/* Best Bet */}
                              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 relative overflow-hidden group/sug">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/sug:opacity-30 transition-opacity">
                                  <Bot className="h-4 w-4" />
                                </div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">🎯 Melhor Aposta</p>
                                  <Badge className="bg-primary/20 text-primary text-[9px]">{match.bestBetConfidence}% confiança</Badge>
                                </div>
                                <p className="text-sm font-black text-white/90 leading-snug">👉 {match.bestBetMarket}</p>
                                {match.bestBetRationale && (
                                  <p className="text-[10px] text-white/50 mt-1 leading-snug">{match.bestBetRationale}</p>
                                )}
                              </div>

                              {/* AI Insight */}
                              {match.insight && (
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">📊 Análise IA</p>
                                  <p className="text-xs text-white/70 leading-snug">{match.insight}</p>
                                </div>
                              )}

                              {/* Pressure + Confidence Row */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-black/20 border border-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Pressão</span>
                                  <div className="flex items-center gap-2">
                                    <Flame className={cn("h-4 w-4", match.hot ? "text-primary" : "text-white/20")} />
                                    <span className="text-sm font-black text-white italic">{match.pressure}/100</span>
                                  </div>
                                </div>
                                <div className="bg-black/20 border border-white/5 rounded-2xl p-3 flex flex-col gap-1">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">IA Confiança</span>
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-black text-white">{match.confidence}%</span>
                                  </div>
                                </div>
                              </div>

                              <Button 
                                onClick={() => handleBetClick(match)}
                                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm uppercase tracking-[0.1em] gap-3 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300"
                              >
                                <Zap className="h-5 w-5 fill-current" />
                                Apostar Agora
                              </Button>
                            </div>
                          </div>

                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <DrawerFooter className="border-t border-border/10 p-5 bg-card/30">
              <div className="flex gap-3 items-center max-w-2xl mx-auto w-full">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={toggleListening}
                  className={cn(
                    "h-14 w-14 rounded-2xl flex-shrink-0 transition-all shadow-lg",
                    isListening ? "border-destructive text-destructive bg-destructive/10 animate-pulse" : "bg-background hover:border-primary hover:text-primary"
                  )}
                >
                  <Mic className="h-6 w-6" />
                </Button>
                <div className="relative flex-1 group">
                  <input 
                    type="text" 
                    placeholder="Pergunte sobre 'jogos quentes'..."
                    className="w-full h-14 bg-background border border-border/60 rounded-2xl px-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50 border-r-0 pr-14"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        handleCommand(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <div className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground group-focus-within:text-primary group-focus-within:bg-primary/5 rounded-xl transition-colors">
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
