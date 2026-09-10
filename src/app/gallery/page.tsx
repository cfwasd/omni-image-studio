"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  Search,
  Heart,
  Download,
  Trash2,
  Copy,
  Check,
  Layers,
  Sparkles,
  Sliders,
  Calendar,
  Clock,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface GalleryArtifact {
  id: string;
  taskId: string;
  storageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  isFavorited: boolean;
  createdAt: string;
  task: {
    id: string;
    taskType: string;
    prompt: string;
    negativePrompt?: string;
    referenceImageUrl?: string;
    parameters: string;
    costTimeMs?: number;
    providerSnapshot?: string;
  };
}

export default function GalleryPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<GalleryArtifact[]>([]);
  const [filter, setFilter] = useState<"ALL" | "FAVORITES" | "T2I" | "I2I">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Inspector 模态抽屉
  const [activeItem, setActiveItem] = useState<GalleryArtifact | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", filter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/gallery?${params.toString()}`);
      const data = await res.json();
      if (data.artifacts) {
        setArtifacts(data.artifacts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // 切换收藏
  const toggleFavorite = async (art: GalleryArtifact, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !art.isFavorited;

    // 乐观更新
    setArtifacts((prev) =>
      prev.map((item) => (item.id === art.id ? { ...item, isFavorited: newStatus } : item))
    );
    if (activeItem?.id === art.id) {
      setActiveItem({ ...activeItem, isFavorited: newStatus });
    }

    await fetch("/api/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: art.id, isFavorited: newStatus }),
    });
  };

  // 删除资产
  const handleDelete = async (id: string) => {
    if (!confirm("确定彻底删除该生成图像资产吗？")) return;
    await fetch(`/api/gallery?id=${id}`, { method: "DELETE" });
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    if (activeItem?.id === id) setActiveItem(null);
  };

  // 一键带回工作台
  const handleReuseTask = (art: GalleryArtifact) => {
    sessionStorage.setItem(
      "reuse_generation_task",
      JSON.stringify({
        prompt: art.task.prompt,
        negativePrompt: art.task.negativePrompt,
        referenceImageUrl: art.task.referenceImageUrl,
        parameters: art.task.parameters,
      })
    );
    router.push("/studio");
  };

  // 送去图生图
  const handleSendToI2I = (art: GalleryArtifact) => {
    sessionStorage.setItem(
      "reuse_generation_task",
      JSON.stringify({
        prompt: art.task.prompt,
        negativePrompt: art.task.negativePrompt,
        referenceImageUrl: art.storageUrl, // 将此图设为参考底图
        parameters: art.task.parameters,
      })
    );
    router.push("/studio");
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* 顶部控制栏 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">历史资产画廊</h1>
            <p className="text-sm text-neutral-400 mt-1">
              浏览全部作品、查看渲染参数、一键全量带回工作台或发送至图生图。
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="按提示词关键词过滤..."
                className="bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 w-48 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="flex gap-2 border-b border-neutral-800/80 pb-3">
          {[
            { key: "ALL", label: "全部图像" },
            { key: "FAVORITES", label: "⭐ 已收藏" },
            { key: "T2I", label: "文生图 (T2I)" },
            { key: "I2I", label: "图生图 (I2I)" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === tab.key
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 瀑布流 / 网格画廊 */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-500 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <span className="text-xs">加载资产画廊中...</span>
          </div>
        ) : artifacts.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-neutral-800 rounded-3xl space-y-2">
            <p className="text-sm text-neutral-400">暂未查询到符合条件的生成图像</p>
            <p className="text-xs text-neutral-600">前往工作台开始您的第一张 AI 画作创作吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artifacts.map((art) => (
              <div
                key={art.id}
                onClick={() => setActiveItem(art)}
                className="group relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-violet-500/60 transition-all cursor-pointer shadow-lg hover:shadow-violet-950/20"
              >
                <div className="aspect-square w-full bg-neutral-950 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={art.thumbnailUrl || art.storageUrl}
                    alt={art.task.prompt}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* 悬浮遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => toggleFavorite(art, e)}
                      className="p-1.5 bg-black/50 backdrop-blur-md rounded-lg text-white hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          art.isFavorited ? "fill-red-500 text-red-500" : "text-neutral-300"
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <p className="text-[11px] text-white line-clamp-2 leading-tight">
                      {art.task.prompt}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1.5">
                      <span>{art.width}x{art.height}</span>
                      <span>{art.task.taskType === "IMAGE_TO_IMAGE" ? "图生图" : "文生图"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 详情 Inspector Modal / Drawer */}
        {activeItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl">
              {/* 大图展示区 */}
              <div className="md:w-3/5 bg-neutral-950 p-4 flex items-center justify-center relative overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeItem.storageUrl}
                  alt="High res"
                  className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                />
                <button
                  onClick={() => setActiveItem(null)}
                  className="md:hidden absolute top-4 right-4 p-2 bg-neutral-900/80 rounded-full text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 参数 Inspector 栏 */}
              <div className="md:w-2/5 p-6 flex flex-col justify-between overflow-y-auto bg-neutral-900/95 space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                      参数回溯 · Inspector
                    </span>
                    <button
                      onClick={() => setActiveItem(null)}
                      className="hidden md:block p-1 text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* 正向提示词 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-neutral-300">正向提示词</span>
                      <button
                        onClick={() => copyText(activeItem.task.prompt)}
                        className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPrompt ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>复制</span>
                      </button>
                    </div>
                    <p className="text-xs text-neutral-300 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800 max-h-32 overflow-y-auto font-mono leading-relaxed">
                      {activeItem.task.prompt}
                    </p>
                  </div>

                  {/* 负向提示词 */}
                  {activeItem.task.negativePrompt && (
                    <div>
                      <span className="text-xs font-medium text-neutral-400 block mb-1">负向排除词</span>
                      <p className="text-xs text-neutral-400 bg-neutral-950 p-2 rounded-xl border border-neutral-800 font-mono">
                        {activeItem.task.negativePrompt}
                      </p>
                    </div>
                  )}

                  {/* 元数据 */}
                  <div className="space-y-2 text-xs border-t border-neutral-800/80 pt-3">
                    <div className="flex justify-between text-neutral-400">
                      <span>分辨率尺寸</span>
                      <span className="font-mono text-white">{activeItem.width} × {activeItem.height}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>任务类型</span>
                      <span className="text-white">
                        {activeItem.task.taskType === "IMAGE_TO_IMAGE" ? "图生图 (I2I)" : "文生图 (T2I)"}
                      </span>
                    </div>
                    {activeItem.task.costTimeMs && (
                      <div className="flex justify-between text-neutral-400">
                        <span>生成耗时</span>
                        <span className="font-mono text-white">{(activeItem.task.costTimeMs / 1000).toFixed(1)} 秒</span>
                      </div>
                    )}
                    <div className="flex justify-between text-neutral-400">
                      <span>创建时间</span>
                      <span className="font-mono text-neutral-300">
                        {new Date(activeItem.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 动作底部栏 */}
                <div className="space-y-2 border-t border-neutral-800 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReuseTask(activeItem)}
                      className="py-2.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-violet-600/25"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>复用参数回工作台</span>
                    </button>
                    <button
                      onClick={() => handleSendToI2I(activeItem)}
                      className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-violet-400" />
                      <span>设为图生图参考底图</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={activeItem.storageUrl}
                      download="omni_image.png"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>下载高清原图</span>
                    </a>

                    <button
                      onClick={() => handleDelete(activeItem.id)}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>删除资产</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
