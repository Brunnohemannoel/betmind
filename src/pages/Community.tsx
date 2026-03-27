import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users, MessageSquare, Flame, TrendingUp, Zap, Star,
  ChevronRight, Bot, Plus, ArrowUpRight, ShieldCheck,
  Heart, Share2, Trophy, Send, X, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AI_AGENT_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : "http://191.252.100.73:8000";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MatchInfo {
  match_id?: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  minute: number;
  league: string;
}

interface BetData {
  market: string;
  odd: number;
}

interface PostUser {
  username: string;
  reputation: number;
  badges: string[];
}

interface UrgencyMetrics {
  time_left?: string;
  intensity: number;
  label: string;
}

interface SocialProof {
  bettors_count: number;
  community_percentage: number;
  trending?: boolean;
}

interface FeedPost {
  id: string;
  user: PostUser;
  content: string;
  ai_validated: boolean;
  ai_score: number;
  ai_recommendation?: "ENTRAR AGORA" | "AGUARDAR" | "EVITAR";
  bet_data?: BetData | null;
  match_info?: MatchInfo;
  urgency?: UrgencyMetrics;
  social_proof?: SocialProof;
  created_at: string;
  likes?: number;
  comments?: number;
  comments_list?: { username: string; content: string }[];
}

// ─── Seed data (shown instantly — never waits for network) ───────────────────
const SEED_POSTS: FeedPost[] = [
  {
    id: "s1",
    user: { username: "BetMind_IA", reputation: 9999, badges: ["🤖 IA OFICIAL"] },
    content: "🤖 PSG dominando as ações. Pressão ofensiva altíssima nos últimos 10 minutos. O gol está maduro.",
    ai_validated: true,
    ai_score: 0.97,
    ai_recommendation: "ENTRAR AGORA",
    bet_data: { market: "Over 0.5 HT (Gols no 1º Tempo)", odd: 1.85 },
    match_info: {
      match_id: "8421034",
      home_team: "PSG",
      away_team: "Arsenal",
      home_score: 0,
      away_score: 0,
      minute: 34,
      league: "Champions League"
    },
    urgency: {
      time_left: "11:00",
      intensity: 92,
      label: "JOGO EXPLODINDO 🔥"
    },
    social_proof: {
      bettors_count: 124,
      community_percentage: 87,
      trending: true
    },
    created_at: new Date(Date.now() - 3 * 60000).toISOString(),
    likes: 215,
    comments: 54,
  },
  {
    id: "s2",
    user: { username: "GreenHunter_23", reputation: 342, badges: ["PRO", "🔥 Streak 7"] },
    content: "🔥 Bayern massacrando no volume. 87% de posse no terço final. Aposta de valor no mercado de gols.",
    ai_validated: true,
    ai_score: 0.94,
    ai_recommendation: "ENTRAR AGORA",
    bet_data: { market: "Over 1.5 Gols", odd: 1.62 },
    match_info: {
      match_id: "9120394",
      home_team: "Bayern",
      away_team: "Dortmund",
      home_score: 1,
      away_score: 0,
      minute: 62,
      league: "Bundesliga"
    },
    urgency: {
      time_left: "28:00",
      intensity: 87,
      label: "MISSÃO GREEN ✅"
    },
    social_proof: {
      bettors_count: 85,
      community_percentage: 74
    },
    created_at: new Date(Date.now() - 9 * 60000).toISOString(),
    likes: 48,
    comments: 12,
  },
];

const STORIES = [
  { seed: "RealMadrid", label: "AO VIVO 🔴", match: "RMA x ATL" },
  { seed: "Bayern", label: "🔥 Quente", match: "BAY x BVB" },
  { seed: "Arsenal", label: "AO VIVO 🔴", match: "ARS x PSG" },
  { seed: "Flamengo", label: "⚡ +82%", match: "FLA x FLU" },
];

const TOP_BETTORS = [
  { name: "GreenHunter_23", wins: 76, rep: 342, badge: "🏆" },
  { name: "Estrategista_VIP", wins: 91, rep: 890, badge: "👑" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const timeAgo = (iso: string) => {
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  
  let relative = "";
  if (diff < 60) relative = `há ${diff}s`;
  else if (diff < 3600) relative = `há ${Math.floor(diff / 60)}m`;
  else if (diff < 86400) relative = `há ${Math.floor(diff / 3600)}h`;
  else relative = `há ${Math.floor(diff / 86400)}d`;

  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  
  return `${relative} · ${dateStr} ${timeStr}`;
};

const fetchWithTimeout = async (url: string, opts?: RequestInit, ms = 4000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

// ─── PostCard ─────────────────────────────────────────────────────────────────
const PostCard = ({
  post,
  onLike,
}: {
  post: FeedPost;
  onLike: (id: string) => void;
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likes ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [localComments, setLocalComments] = useState(post.comments_list ?? []);
  const isOfficial = post.user.badges.some((b) => b.includes("IA OFICIAL"));

  const handleAction = (matchId?: string) => {
    if (!matchId) return;
    navigate(`/?matchId=${matchId}&action=analyze`);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    
    const newComment = { username: "Você", content: commentText };
    setLocalComments(prev => [newComment, ...prev]);
    setCommentText("");
    
    toast({ title: "Comentário enviado!", description: "Seu comentário foi registrado com sucesso." });

    try {
      await fetchWithTimeout(`${AI_AGENT_URL}/community/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          post_id: post.id, 
          user_id: "trader-silva", 
          type: "comment",
          content: newComment.content 
        }),
      }, 3000);
    } catch (err) {
      console.error("Comment error:", err);
    }
  };

  const getRecStyles = (rec?: string) => {
    if (rec === "ENTRAR AGORA") return "text-green-400 bg-green-500/10 border-green-500/20";
    if (rec === "AGUARDAR") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    if (rec === "EVITAR") return "text-red-400 bg-red-500/10 border-red-500/20";
    return "text-primary bg-primary/10 border-primary/20";
  };

  return (
    <Card className={cn(
      "glass-panel border-border/40 hover:border-primary/30 transition-all duration-500 overflow-hidden group relative mb-4",
      isOfficial && "border-primary/50 shadow-[0_0_25px_rgba(var(--primary),0.12)] bg-gradient-to-br from-primary/5 to-transparent"
    )}>
      {post.social_proof?.trending && (
        <div className="absolute top-0 right-0 py-1 px-3 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-tighter rounded-bl-xl z-10 animate-pulse">
          🔥 Em Alta
        </div>
      )}

      <CardContent className="p-0">
        {post.match_info && (
          <div 
            className="p-3 bg-secondary/30 border-b border-border/20 flex items-center justify-between gap-4 cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={() => handleAction(post.match_info?.match_id)}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{post.match_info.league}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black">{post.match_info.home_team}</span>
                  <div className="flex items-center gap-1 bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
                    <span className="text-xs font-bold text-primary">{post.match_info.home_score}</span>
                    <span className="text-[10px] text-muted-foreground">-</span>
                    <span className="text-xs font-bold text-primary">{post.match_info.away_score}</span>
                  </div>
                  <span className="text-sm font-black">{post.match_info.away_team}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[11px] font-black text-red-400">{post.match_info.minute}'</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          <div className="flex justify-between items-center gap-3">
            <div className="flex gap-3 min-w-0">
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user.username}`}
                alt={post.user.username}
                className="w-10 h-10 rounded-full bg-secondary border-2 border-border"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate">{post.user.username}</p>
                  {post.user.badges.map((b) => (
                    <Badge
                      key={b}
                      className={cn(
                        "text-[9px] h-4 px-1 border-0 underline-none",
                        b.includes("IA OFICIAL") ? "bg-primary text-primary-foreground font-black" : "bg-primary/20 text-primary border-0"
                      )}
                    >
                      {b}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                   {timeAgo(post.created_at)} · ⭐ {post.user.reputation} rep.
                </p>
              </div>
            </div>
            {post.ai_recommendation && (
              <Badge className={cn("text-[10px] font-black tracking-tighter border", getRecStyles(post.ai_recommendation))}>
                <Zap className="h-3 w-3 mr-1" /> {post.ai_recommendation}
              </Badge>
            )}
          </div>

          <p className="text-sm leading-relaxed font-medium text-foreground/90 italic">
            "{post.content}"
          </p>

          {post.bet_data && (
            <div className="pt-2">
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/20 to-accent/10 border-2 border-primary/30 space-y-3 shadow-lg group-hover:shadow-primary/10 transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-1">Entrada Sugerida</span>
                    <h3 className="text-lg font-black leading-tight tracking-tight">{post.bet_data.market}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Odd Agora</span>
                    <span className="text-xl font-black text-accent">{post.bet_data.odd.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm uppercase tracking-widest gap-2 shadow-[0_4px_15px_rgba(var(--primary),0.3)] hover:translate-y-[-2px] transition-all"
                    onClick={() => handleAction(post.match_info?.match_id)}
                  >
                    <Trophy className="h-5 w-5" />
                    APOSTAR AGORA
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-12 border-border/40 text-[10px] font-bold uppercase gap-1 hover:bg-secondary"
                      onClick={() => handleAction(post.match_info?.match_id)}>
                      <TrendingUp className="h-3.5 w-3.5" /> Ver Odds
                    </Button>
                    <Button variant="outline" size="sm" className="h-12 border-border/40 text-[10px] font-bold uppercase gap-1 hover:bg-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(`${post.bet_data?.market} @ ${post.bet_data?.odd}`);
                        toast({ title: "Copiado!" });
                      }}>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border/20">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (!liked) setLocalLikes((n) => n + 1);
                  else setLocalLikes((n) => n - 1);
                  setLiked((p) => !p);
                  onLike(post.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-all",
                  liked ? "text-red-400 font-bold" : "text-muted-foreground hover:text-red-400"
                )}
              >
                <Heart className={cn("h-4 w-4 transition-all", liked && "fill-red-400 scale-125")} />
                {localLikes}
              </button>
              <button 
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors font-medium",
                  showComments ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="h-4 w-4" />
                {localComments.length}
              </button>
            </div>
          </div>

          {showComments && (
            <div className="pt-3 animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
              {localComments.length > 0 && (
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {localComments.map((c, i) => (
                    <div key={i} className="bg-secondary/20 p-2 rounded-lg border border-border/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-primary">{c.username}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Escreva um comentário..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="bg-secondary/50 border-border/40 text-xs h-9"
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                />
                <Button size="sm" className="h-9 px-3" onClick={handleComment}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const Community = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedPost[]>(SEED_POSTS);
  const [activeFilter, setActiveFilter] = useState<"hot" | "new" | "following" | "ia">("hot");
  const [postText, setPostText] = useState("");
  const [showBetInput, setShowBetInput] = useState(false);
  const [postBetMarket, setPostBetMarket] = useState("");
  const [postBetOdd, setPostBetOdd] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const loadFeedFromBackend = useCallback(async () => {
    try {
      const res = await fetchWithTimeout(`${AI_AGENT_URL}/community/feed`, {}, 4000);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const enriched: FeedPost[] = data.map((p: any) => ({
        id: p.id ?? `b-${Math.random()}`,
        user: p.user ?? { username: "Apostador", reputation: 0, badges: [] },
        content: p.content ?? "",
        ai_validated: p.ai_validated ?? false,
        ai_score: p.ai_score ?? 0,
        ai_recommendation: p.ai_recommendation ?? null,
        bet_data: p.bet_data ?? null,
        match_info: p.match_info ?? null,
        urgency: p.urgency ?? null,
        social_proof: p.social_proof ?? null,
        created_at: p.created_at ?? new Date().toISOString(),
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        comments_list: p.comments_list ?? [],
      }));

      setPosts((prev) => {
        const existingIds = new Set(enriched.map((p) => p.id));
        const locals = prev.filter((p) => !existingIds.has(p.id));
        return [...enriched, ...locals];
      });
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(loadFeedFromBackend, 200);
    return () => clearTimeout(t);
  }, [loadFeedFromBackend]);

  const handlePost = async () => {
    if (!postText.trim()) return;
    setIsPosting(true);
    
    const newPost: FeedPost = {
      id: `local-${Date.now()}`,
      user: { username: "Trader Silva", reputation: 100, badges: ["PRO"] },
      content: postText,
      ai_validated: postText.length > 20,
      ai_score: postText.length > 20 ? 0.82 : 0.4,
      ai_recommendation: postText.length > 20 ? "ENTRAR AGORA" : "AGUARDAR",
      bet_data: showBetInput && postBetMarket && postBetOdd
        ? { market: postBetMarket, odd: parseFloat(postBetOdd) }
        : null,
      match_info: showBetInput ? {
        match_id: "match-local",
        home_team: "Time Casa",
        away_team: "Time Fora",
        home_score: 0,
        away_score: 0,
        minute: 1,
        league: "Minha Liga"
      } : undefined,
      created_at: new Date().toISOString(),
      likes: 0, 
      comments: 0,
    };

    setPosts((prev) => [newPost, ...prev]);
    setPostText("");
    setShowBetInput(false);
    setIsPosting(false);

    toast({ title: "✅ Post publicado!" });

    try {
      await fetchWithTimeout(`${AI_AGENT_URL}/community/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "trader-silva",
          content: postText,
          bet_data: newPost.bet_data,
          match_id: newPost.match_info?.match_id
        }),
      }, 3000);
    } catch {}
  };

  const handleLike = async (postId: string) => {
    try {
      await fetchWithTimeout(`${AI_AGENT_URL}/community/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, user_id: "trader-silva", type: "like" }),
      }, 3000);
    } catch {}
  };

  const filteredPosts = useMemo(() => {
    let base = [...posts];
    
    // Sort by filter
    if (activeFilter === "ia") {
      base = base.filter(p => p.ai_validated);
      // IA results sorted by score
      base.sort((a, b) => b.ai_score - a.ai_score);
    } else if (activeFilter === "hot") {
      // Hot: More likes/comments first
      base.sort((a, b) => {
        const scoreA = (a.likes ?? 0) + (a.comments ?? 0) * 2;
        const scoreB = (b.likes ?? 0) + (b.comments ?? 0) * 2;
        return scoreB - scoreA;
      });
    } else if (activeFilter === "new") {
      // New: Most recent first
      base.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return base;
  }, [posts, activeFilter]);

  return (
    <main className="betmind-bg min-h-screen p-3 md:p-4">
      <section className="sportsbook-shell">
        <aside className="sportsbook-sidebar md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:overflow-y-auto space-y-6">
          <div className="space-y-4 mb-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Devos da Sorte" className="w-[180px] mx-auto h-auto object-contain" />
            <div className="flex items-center gap-3 px-1 justify-center">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-black tracking-tight">Comunidade</h1>
            </div>
          </div>
          <nav className="space-y-1">
            {["hot", "new", "ia"].map((f) => (
              <Button key={f} variant={activeFilter === f ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setActiveFilter(f as any)}>
                {f === "ia" && <Bot className="h-4 w-4" />}
                {f.toUpperCase()}
              </Button>
            ))}
          </nav>
          <Button onClick={() => navigate("/")} variant="outline" className="w-full justify-start gap-2">
            <ChevronRight className="h-4 w-4 rotate-180" /> Voltar
          </Button>
        </aside>

        <section className="sportsbook-main space-y-5">
          <Card className="glass-panel border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-3">
                <Textarea placeholder="O que você está analisando?" className="bg-background/40" value={postText} onChange={(e) => setPostText(e.target.value)} />
              </div>
              {showBetInput && (
                <div className="flex gap-2">
                  <Input placeholder="Mercado" className="flex-1" value={postBetMarket} onChange={(e) => setPostBetMarket(e.target.value)} />
                  <Input placeholder="Odd" type="number" className="w-24" value={postBetOdd} onChange={(e) => setPostBetOdd(e.target.value)} />
                </div>
              )}
              <div className="flex justify-between">
                <Button size="sm" variant="ghost" onClick={() => setShowBetInput(!showBetInput)}>+ Dica</Button>
                <Button size="sm" onClick={handlePost} disabled={isPosting || !postText.trim()}>Postar</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
};

export default Community;
