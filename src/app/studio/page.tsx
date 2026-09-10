"use client";

import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Wand2,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Upload,
  Download,
  Copy,
  Check,
  ChevronDown,
  Sliders,
  Layers,
  X,
  Trash2,
  ShieldAlert,
} from "lucide-react";

const PRESET_STYLES = [
  { label: "写实摄影", tag: "photorealistic, 8k resolution, cinematic lighting, shot on 35mm lens, sharp focus" },
  { label: "赛博朋克", tag: "cyberpunk, neon glow, futuristic city, rainy night, volumetric smoke" },
  { label: "动漫日漫", tag: "anime aesthetic, Makoto Shinkai style, vibrant colors, detailed line art, masterpiece" },
  { label: "电影光影", tag: "cinematic film still, dramatic chiaroscuro, moody atmosphere, anamorphic bokeh" },
  { label: "概念插画", tag: "digital concept art, fantasy illustration, intricate details, trending on ArtStation" },
  { label: "极简3D", tag: "minimalist 3d render, clay material, studio lighting, smooth gradients, octane render" },
];

const NEGATIVE_PRESETS = [
  { label: "通用抗畸形", tag: "blurry, bad anatomy, bad hands, deformed fingers, extra limbs, mutated, low quality, worst quality, watermark, signature, text, jpeg artifacts" },
  { label: "写实避坑", tag: "cartoon, 3d, illustration, airbrushed, plastic skin, oversaturated, deformed face, bad eyes, unnatural lighting, duplicate" },
  { label: "动漫避坑", tag: "photorealistic, noisy, bad art, poorly drawn, extra ears, bad proportions, disfigured, lowres" },
];

const ASPECT_RATIOS = [
  { label: "1:1 正方", w: 1024, h: 1024, desc: "头像/插画" },
  { label: "4:3 横构图", w: 1024, h: 768, desc: "经典画幅" },
  { label: "16:9 宽屏", w: 1280, h: 720, desc: "电脑壁纸/场景" },
  { label: "9:16 竖屏", w: 720, h: 1280, desc: "移动端/手机壁纸" },
  { label: "3:4 人像", w: 768, h: 1024, desc: "人物半身肖像" },
];

interface ProviderOption {
  id: string;
  name: string;
  modelName: string;
  modelList?: string[];
  protocolType: string;
}

interface GeneratedArtifact {
  id: string;
  storageUrl: string;
  width: number;
  height: number;
}

export default function StudioPage() {
  const [taskType, setTaskType] = useState<"TEXT_TO_IMAGE" | "IMAGE_TO_IMAGE">("TEXT_TO_IMAGE");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [steps, setSteps] = useState(25);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [seed, setSeed] = useState(-1);
  const [denoiseStrength, setDenoiseStrength] = useState(0.75);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 接口提供商与二级模型选择器
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");

  // 状态
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceModalData, setEnhanceModalData] = useState<{
    original: string;
    positive: string;
    negative: string;
  } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [genTime, setGenTime] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);
  const [recentArtifacts, setRecentArtifacts] = useState<GeneratedArtifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<GeneratedArtifact | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载 Provider 列表
  useEffect(() => {
    fetch("/api/settings/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.providers?.length) {
          setProviders(data.providers);
          const defaultOne = data.providers.find((p: { isDefault: boolean }) => p.isDefault) || data.providers[0];
          setSelectedProviderId(defaultOne.id);
          setSelectedModel(defaultOne.modelName || defaultOne.modelList?.[0] || "");
        }
      })
      .catch(console.error);
  }, []);

  // 当切换供应商时，自动级联更新具体可用模型列表
  const handleProviderChange = (newProviderId: string) => {
    setSelectedProviderId(newProviderId);
    const matched = providers.find((p) => p.id === newProviderId);
    if (matched) {
      setSelectedModel(matched.modelName || matched.modelList?.[0] || "");
    }
  };

  // 当前选中供应商的可用模型数组
  const activeProvider = providers.find((p) => p.id === selectedProviderId);
  const currentModelList = activeProvider?.modelList?.length
    ? activeProvider.modelList
    : activeProvider?.modelName
    ? [activeProvider.modelName]
    : [];

  // 检查是否有来自画廊带回的参数
  useEffect(() => {
    const reuseData = sessionStorage.getItem("reuse_generation_task");
    if (reuseData) {
      try {
        const item = JSON.parse(reuseData);
        if (item.prompt) setPrompt(item.prompt);
        if (item.negativePrompt) setNegativePrompt(item.negativePrompt);
        if (item.referenceImageUrl) {
          setReferenceImageUrl(item.referenceImageUrl);
          setTaskType("IMAGE_TO_IMAGE");
        }
        if (item.parameters) {
          const params = typeof item.parameters === "string" ? JSON.parse(item.parameters) : item.parameters;
          if (params.steps) setSteps(params.steps);
          if (params.cfgScale) setCfgScale(params.cfgScale);
          if (params.seed !== undefined) setSeed(params.seed);
          if (params.denoiseStrength) setDenoiseStrength(params.denoiseStrength);
          const matched = ASPECT_RATIOS.find((r) => r.w === params.width && r.h === params.height);
          if (matched) setSelectedRatio(matched);
        }
        sessionStorage.removeItem("reuse_generation_task");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // 魔法棒智能扩写
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      setErrorMsg("请先在提示词框中输入简要想法或中文描述");
      return;
    }
    setErrorMsg("");
    setEnhancing(true);
    try {
      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "提示词扩写失败");
        return;
      }

      if (data.positive) {
        setEnhanceModalData({
          original: data.original || prompt,
          positive: data.positive,
          negative: data.negative || negativePrompt || "blurry, low quality, bad anatomy, deformed limbs, watermark, text",
        });
      }
    } catch {
      setErrorMsg("网络异常，扩写未完成");
    } finally {
      setEnhancing(false);
    }
  };

  // 应用扩写结果 (无论正向还是反向词，均完整同步覆盖)
  const handleApplyEnhanced = (mode: "replace" | "append") => {
    if (!enhanceModalData) return;
    if (mode === "replace") {
      setPrompt(enhanceModalData.positive);
    } else {
      setPrompt((prev) => (prev ? `${prev}, ${enhanceModalData.positive}` : enhanceModalData.positive));
    }
    // 自动将扩写推荐的反向提示词同步替换至反向提示词框中
    if (enhanceModalData.negative) {
      setNegativePrompt(enhanceModalData.negative);
    }
    setEnhanceModalData(null);
  };

  // 添加风格标签
  const handleAddStyle = (tag: string) => {
    if (prompt.includes(tag)) return;
    setPrompt((prev) => (prev ? `${prev}, ${tag}` : tag));
  };

  // 填入反向词预设
  const handleAddNegativePreset = (tag: string) => {
    if (!negativePrompt) {
      setNegativePrompt(tag);
    } else if (!negativePrompt.includes(tag)) {
      setNegativePrompt((prev) => `${prev}, ${tag}`);
    }
  };

  // 上传参考图
  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRef(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setReferenceImageUrl(data.url);
      } else {
        setErrorMsg(data.error || "参考图上传失败");
      }
    } catch {
      setErrorMsg("图片上传失败");
    } finally {
      setUploadingRef(false);
    }
  };

  // 发起生图
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMsg("请输入正向提示词");
      return;
    }
    if (taskType === "IMAGE_TO_IMAGE" && !referenceImageUrl) {
      setErrorMsg("图生图模式下必须上传或选择一张参考底图");
      return;
    }

    setErrorMsg("");
    setGenerating(true);
    const start = Date.now();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId || undefined,
          selectedModel: selectedModel || undefined,
          taskType,
          prompt,
          negativePrompt,
          referenceImageUrl: taskType === "IMAGE_TO_IMAGE" ? referenceImageUrl : null,
          parameters: {
            width: selectedRatio.w,
            height: selectedRatio.h,
            aspectRatio: selectedRatio.label,
            steps,
            cfgScale,
            seed,
            denoiseStrength: taskType === "IMAGE_TO_IMAGE" ? denoiseStrength : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "生成失败，请检查接口配置或服务余额");
        return;
      }

      setGenTime(Math.round((Date.now() - start) / 1000));
      if (data.artifacts?.length) {
        setRecentArtifacts((prev) => [...data.artifacts, ...prev]);
        setActiveArtifact(data.artifacts[0]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(`生图网络中断: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyNegativePrompt = () => {
    navigator.clipboard.writeText(negativePrompt);
    setCopiedNeg(true);
    setTimeout(() => setCopiedNeg(false), 2000);
  };

  return (
    <AppShell>
      {/* 宽屏响应式工作流：参数区占 4 列，画布展示区占 8 列 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左侧：控制面板与参数区 (占 4 列) */}
        <div className="lg:col-span-4 space-y-4">
          {/* 模式选择器 */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-sm">
            <button
              onClick={() => setTaskType("TEXT_TO_IMAGE")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                taskType === "TEXT_TO_IMAGE"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              文生图 (Text to Image)
            </button>
            <button
              onClick={() => setTaskType("IMAGE_TO_IMAGE")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                taskType === "IMAGE_TO_IMAGE"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              图生图 (Image to Image)
            </button>
          </div>

          {/* 供应商与具体模型二级联动下拉选择框 */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-300">1. 选择生图供应商 (Provider)</label>
                <a href="/settings" className="text-[11px] text-violet-400 hover:underline">
                  管理配置
                </a>
              </div>
              <select
                value={selectedProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500 font-medium"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.protocolType})
                  </option>
                ))}
                {providers.length === 0 && <option value="">未检测到接口，请先在配置页添加</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                2. 选择当前调用模型 (Model)
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-violet-300 font-mono focus:outline-none focus:border-violet-500 font-medium"
              >
                {currentModelList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {currentModelList.length === 0 && <option value="">暂无可选用模型</option>}
              </select>
            </div>
          </div>

          {/* 图生图参考底图卡片 */}
          {taskType === "IMAGE_TO_IMAGE" && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-300">参考底图 (Init Image)</span>
                {referenceImageUrl && (
                  <button
                    onClick={() => setReferenceImageUrl("")}
                    className="text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    清除图片
                  </button>
                )}
              </div>

              {referenceImageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-neutral-800 h-44 bg-neutral-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={referenceImageUrl} alt="Ref" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-violet-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-neutral-950/40"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleUploadReference}
                    className="hidden"
                  />
                  {uploadingRef ? (
                    <Loader2 className="h-6 w-6 text-violet-400 animate-spin mx-auto" />
                  ) : (
                    <Upload className="h-6 w-6 text-neutral-500 mx-auto mb-2" />
                  )}
                  <p className="text-xs text-neutral-400">点击上传本地图片或拖拽至此</p>
                  <p className="text-[10px] text-neutral-600 mt-1">支持 PNG, JPG, WebP 格式</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                  <span>重绘幅度 (Denoising Strength)</span>
                  <span className="font-mono text-violet-400">{denoiseStrength}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={denoiseStrength}
                  onChange={(e) => setDenoiseStrength(parseFloat(e.target.value))}
                  className="w-full accent-violet-500 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-violet-950/20 border border-violet-800/30 rounded-xl text-[11px] text-violet-300/90 leading-relaxed">
                💡 <strong>修图模式已激活</strong>：参考图已通过真实文件流直连上游编辑接口（<code>/images/edits</code>），将在深度记忆并锁定原图人物与轮廓的前提下为您生成衍生修图！
              </div>
            </div>
          )}

          {/* Prompt 正向与反向提示词工坊 */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-4">
            {/* 1. 正向提示词 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200">
                  {taskType === "IMAGE_TO_IMAGE" ? "修图修改要求 (Positive Edit Prompt)" : "正向提示词 (Positive Prompt)"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyPrompt}
                    className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="复制正向词"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={handleEnhancePrompt}
                    disabled={enhancing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl transition-all shadow-md shadow-violet-600/20 cursor-pointer disabled:opacity-50"
                    title="输入简短中文，点击自动同时生成正向词与反向词"
                  >
                    {enhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    <span>智能扩写</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  taskType === "IMAGE_TO_IMAGE"
                    ? "请重点描述在原图基础上需要修改、增添或微调的内容（如：给人物戴上一副赛博朋克发光墨镜，保留原人物五官发型与背景构图）..."
                    : "输入画面构想（支持中文，点击魔法棒自动转译为电影级英文 Prompt 并生成反向词）..."
                }
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
              />

              {/* 正向风格快捷标签 Chip */}
              <div>
                <span className="block text-[11px] text-neutral-500 mb-1.5">正向风格快选：</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_STYLES.map((style) => (
                    <button
                      key={style.label}
                      onClick={() => handleAddStyle(style.tag)}
                      className="px-2.5 py-1 text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    >
                      + {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. 反向提示词 (更加醒目、自带避坑预设) */}
            <div className="pt-3 border-t border-neutral-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-xs font-semibold text-rose-300">反向提示词 (Negative Prompt)</span>
                </div>
                <div className="flex items-center gap-2">
                  {negativePrompt && (
                    <button
                      onClick={() => setNegativePrompt("")}
                      className="text-[11px] text-neutral-500 hover:text-rose-400 flex items-center gap-0.5 cursor-pointer"
                      title="清空反向词"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>清空</span>
                    </button>
                  )}
                  <button
                    onClick={copyNegativePrompt}
                    className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="复制反向词"
                  >
                    {copiedNeg ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="在此填入要规避的画面缺陷（如模糊、多余手指、文字水印、低画质等）..."
                className="w-full bg-neutral-950/80 border border-rose-950/40 focus:border-rose-500 rounded-xl p-3 text-xs text-rose-200/90 placeholder-neutral-600 focus:outline-none resize-none leading-relaxed font-mono"
              />

              {/* 反向词快捷预设 */}
              <div>
                <span className="block text-[11px] text-neutral-500 mb-1.5">常用避坑反向词：</span>
                <div className="flex flex-wrap gap-1.5">
                  {NEGATIVE_PRESETS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleAddNegativePreset(item.tag)}
                      className="px-2.5 py-1 text-[11px] bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 rounded-lg text-rose-300/80 hover:text-rose-200 transition-colors cursor-pointer"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 画幅与比例 */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <span className="block text-xs font-medium text-neutral-300 mb-2">画幅比例</span>
            <div className="grid grid-cols-5 gap-2">
              {ASPECT_RATIOS.map((r) => {
                const active = selectedRatio.label === r.label;
                return (
                  <button
                    key={r.label}
                    onClick={() => setSelectedRatio(r)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      active
                        ? "bg-violet-600/20 border-violet-500 text-white shadow-sm"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{r.label.split(" ")[0]}</div>
                    <div className="text-[9px] text-neutral-500 mt-0.5">{r.w}x{r.h}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 进阶折叠面板 */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-medium text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                <span>进阶参数 (采样步数 / CFG / 随机种子)</span>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </button>

            {showAdvanced && (
              <div className="pt-4 space-y-4 border-t border-neutral-800/80 mt-3">
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>采样步数 (Steps)</span>
                    <span className="font-mono text-violet-400">{steps}</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="50"
                    value={steps}
                    onChange={(e) => setSteps(parseInt(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>提示词相关性 (CFG Scale)</span>
                    <span className="font-mono text-violet-400">{cfgScale}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={cfgScale}
                    onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>随机种子 (Seed，-1 为真随机)</span>
                    <button
                      onClick={() => setSeed(-1)}
                      className="text-[10px] text-violet-400 hover:underline cursor-pointer"
                    >
                      重置随机
                    </button>
                  </div>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || -1)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 报错提示 */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          {/* 生成主操作按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-violet-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI 渲染生成中，请稍候...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span className="truncate">立即生成 ({selectedModel || "默认模型"})</span>
              </>
            )}
          </button>
        </div>

        {/* 右侧：画布与成果区 (占 8 列) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 sm:p-8 min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden">
            {generating && (
              <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex flex-col items-center justify-center z-20 space-y-4">
                <div className="relative">
                  <div className="h-24 w-24 rounded-3xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 animate-pulse flex items-center justify-center shadow-2xl shadow-violet-600/50">
                    <Sparkles className="h-10 w-10 text-white animate-spin" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-white">正在调用模型渲染: {selectedModel}...</p>
                  <p className="text-xs text-neutral-400 mt-1">出图完成后将自动秒级同步存入您的 RustFS 对象存储</p>
                </div>
              </div>
            )}

            {/* 展示当前生成结果 */}
            {activeArtifact ? (
              <div className="w-full flex flex-col items-center">
                <div className="relative group max-h-[720px] rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeArtifact.storageUrl}
                    alt="Rendered Art"
                    className="max-h-[720px] w-auto object-contain rounded-3xl"
                  />
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={activeArtifact.storageUrl}
                      download="omni_artifact.png"
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded-xl backdrop-blur-md border border-neutral-700 shadow-lg cursor-pointer"
                      title="下载原图"
                    >
                      <Download className="h-5 w-5" />
                    </a>
                  </div>
                </div>

                {/* 快速动作栏 */}
                <div className="w-full max-w-2xl mt-5 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-4">
                    <span>耗时：{genTime ? `${genTime}s` : "刚刚"}</span>
                    <span>尺寸：{activeArtifact.width} × {activeArtifact.height}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReferenceImageUrl(activeArtifact.storageUrl);
                        setTaskType("IMAGE_TO_IMAGE");
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Layers className="h-4 w-4 text-violet-400" />
                      <span>以此图进行图生图</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 space-y-4">
                <div className="h-20 w-20 rounded-3xl bg-neutral-950 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-600 shadow-inner">
                  <ImageIcon className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-200">创作画布就绪</h3>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto mt-1.5 leading-relaxed">
                    在左侧选择供应商与具体模型，输入提示词并选择画幅比例，点击“立即生成”即可在这里超高清实时预览
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 最近生成批次缩略图栏 */}
          {recentArtifacts.length > 0 && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5">
              <span className="text-xs font-medium text-neutral-400 block mb-3">本次会话生成历史 ({recentArtifacts.length})</span>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentArtifacts.map((art) => {
                  const isSelected = activeArtifact?.id === art.id;
                  return (
                    <div
                      key={art.id}
                      onClick={() => setActiveArtifact(art)}
                      className={`h-24 w-24 shrink-0 rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                        isSelected ? "border-violet-500 scale-105 shadow-md shadow-violet-500/30" : "border-neutral-800 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art.storageUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 魔法棒扩写对比与确认弹层 */}
      {enhanceModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">AI 智能扩写提示词确认</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">已同时生成纯净正向词与专属反向避坑词</p>
                </div>
              </div>
              <button
                onClick={() => setEnhanceModalData(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* 原始输入 */}
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-3">
                <span className="text-[11px] font-medium text-neutral-400 block mb-1">原始输入想法：</span>
                <p className="text-xs text-neutral-300">{enhanceModalData.original}</p>
              </div>

              {/* 扩写后正向词 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    <span>优化后正向提示词 (Positive Prompt)：</span>
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(enhanceModalData.positive)}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>复制</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={enhanceModalData.positive}
                  onChange={(e) =>
                    setEnhanceModalData({ ...enhanceModalData, positive: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 font-mono leading-relaxed"
                />
              </div>

              {/* 扩写后反向词 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    <span>推荐反向提示词 (Negative Prompt)：</span>
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(enhanceModalData.negative)}
                    className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>复制</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={enhanceModalData.negative}
                  onChange={(e) =>
                    setEnhanceModalData({ ...enhanceModalData, negative: e.target.value })
                  }
                  className="w-full bg-neutral-950 border border-rose-950/50 rounded-xl p-2.5 text-xs text-rose-200/90 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {/* 动作栏 */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setEnhanceModalData(null)}
                className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-xl cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleApplyEnhanced("append")}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl cursor-pointer"
              >
                追加到原词后面
              </button>
              <button
                onClick={() => handleApplyEnhanced("replace")}
                className="px-5 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-violet-600/25"
              >
                <Check className="h-4 w-4" />
                <span>同时应用正向与反向词</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
