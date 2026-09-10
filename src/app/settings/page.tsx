"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Database,
  Cloud,
  Layers,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  Save,
  Server,
  RefreshCw,
  Edit3,
  CheckSquare,
  Square,
  Sparkles,
  KeyRound,
  ShieldCheck,
  User,
} from "lucide-react";

// 常见热门生图模型快捷预设供一键点选勾选
const POPULAR_IMAGE_MODELS = [
  { id: "black-forest-labs/FLUX.1-schnell", label: "Flux.1 Schnell (极速电影级)", group: "Flux 系列" },
  { id: "black-forest-labs/FLUX.1-dev", label: "Flux.1 Dev (专业开发版)", group: "Flux 系列" },
  { id: "stabilityai/stable-diffusion-xl-base-1.0", label: "SDXL Base 1.0 (经典高精)", group: "SD 系列" },
  { id: "stabilityai/sdxl-turbo", label: "SDXL Turbo (单步秒级生图)", group: "SD 系列" },
  { id: "Kwai-Kolors/Kolors", label: "Kolors 可图 (中文文字极强)", group: "国产大模型" },
  { id: "dall-e-3", label: "DALL-E 3 (OpenAI 语义极佳)", group: "OpenAI" },
  { id: "dall-e-2", label: "DALL-E 2 (OpenAI 轻量版)", group: "OpenAI" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<"providers" | "oss" | "pg" | "llm" | "account">("providers");

  // 账号与当前用户信息
  const [currentUser, setCurrentUser] = useState<{ email?: string; name?: string; role?: string } | null>(null);

  // 修改密码表单
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<{ success?: boolean; text?: string } | null>(null);

  // PG 状态
  const [pgInfo, setPgInfo] = useState<{
    connected?: boolean;
    latencyMs?: number;
    maskedUrl?: string;
    error?: string;
    tableCounts?: { users: number; tasks: number; artifacts: number };
  }>({});
  const [pgTesting, setPgTesting] = useState(false);
  const [customPgUrl, setCustomPgUrl] = useState("");
  const [pgTestMsg, setPgTestMsg] = useState<{ success?: boolean; text?: string } | null>(null);

  // OSS 状态
  const [ossForm, setOssForm] = useState({
    region: "us-east-1",
    endpoint: "https://s3.wangziheng.vip",
    accessKeyId: "",
    accessKeySecret: "",
    bucket: "omni",
    cdnDomain: "",
  });
  const [ossLoading, setOssLoading] = useState(false);
  const [ossStatus, setOssStatus] = useState<{ success?: boolean; text?: string } | null>(null);

  // 生图接口列表
  interface ProviderItem {
    id: string;
    name: string;
    protocolType: string;
    baseUrl: string;
    apiKeyEncrypted: string;
    hasKey: boolean;
    modelName: string;
    modelList: string[];
    isDefault: boolean;
  }
  const [providers, setProviders] = useState<ProviderItem[]>([]);

  // 统一支持勾选与选择的多模型表单
  const [newProvider, setNewProvider] = useState({
    name: "SiliconFlow 聚合生图",
    protocolType: "OPENAI",
    baseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    modelName: "black-forest-labs/FLUX.1-schnell",
    selectedModels: [
      "black-forest-labs/FLUX.1-schnell",
      "black-forest-labs/FLUX.1-dev",
      "stabilityai/stable-diffusion-xl-base-1.0",
    ] as string[],
    isDefault: true,
  });

  // 在线探测获取到的远端模型池
  const [fetchedRemoteModels, setFetchedRemoteModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelMsg, setFetchModelMsg] = useState<string | null>(null);
  const [customInputModel, setCustomInputModel] = useState("");

  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerTestMsg, setProviderTestMsg] = useState<{ [id: string]: { success: boolean; text: string } }>({});

  // 编辑 Provider
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  // LLM 状态
  const [llmForm, setLlmForm] = useState({
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    modelName: "gpt-4o-mini",
    systemPromptTemplate: "",
  });
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{ success?: boolean; text?: string } | null>(null);

  // 加载当前登录用户信息
  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 1. 加载 PG
  const loadPgStatus = useCallback(async () => {
    setPgTesting(true);
    setPgTestMsg(null);
    try {
      const res = await fetch("/api/settings/pg");
      const data = await res.json();
      setPgInfo(data);
    } catch {
      setPgInfo({ connected: false, error: "无法请求后端" });
    } finally {
      setPgTesting(false);
    }
  }, []);

  // 2. 加载 OSS
  const loadOss = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/oss");
      const data = await res.json();
      if (data.configured && data.config) {
        setOssForm((prev) => ({
          ...prev,
          region: data.config.region || "us-east-1",
          endpoint: data.config.endpoint || "",
          bucket: data.config.bucket || "",
          accessKeyId: data.config.accessKeyId || "",
          cdnDomain: data.config.cdnDomain || "",
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 3. 加载 Providers
  const loadProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/providers");
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 4. 加载 LLM
  const loadLlm = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/llm");
      const data = await res.json();
      if (data.config) {
        setLlmForm({
          baseUrl: data.config.baseUrl || "",
          modelName: data.config.modelName || "",
          systemPromptTemplate: data.config.systemPromptTemplate || "",
          apiKey: "",
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadUser();
    loadPgStatus();
    loadOss();
    loadProviders();
    loadLlm();
  }, [loadUser, loadPgStatus, loadOss, loadProviders, loadLlm]);

  // 修改密码操作
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdStatus(null);

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdStatus({ success: false, text: "两次输入的新密码不一致" });
      return;
    }

    if (pwdForm.newPassword.length < 6) {
      setPwdStatus({ success: false, text: "新密码长度不能少于 6 位" });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: pwdForm.oldPassword,
          newPassword: pwdForm.newPassword,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPwdStatus({ success: true, text: data.message || "密码修改成功！" });
        setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setPwdStatus({ success: false, text: data.error || "修改失败，请重试" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPwdStatus({ success: false, text: `网络异常: ${msg}` });
    } finally {
      setPwdLoading(false);
    }
  };

  // 勾选 / 反选模型
  const handleToggleModel = (modelId: string) => {
    setNewProvider((prev) => {
      const exists = prev.selectedModels.includes(modelId);
      const updated = exists
        ? prev.selectedModels.filter((m) => m !== modelId)
        : [...prev.selectedModels, modelId];

      let nextPrimary = prev.modelName;
      if (exists && prev.modelName === modelId) {
        nextPrimary = updated[0] || "";
      } else if (!exists && !prev.modelName) {
        nextPrimary = modelId;
      }

      return {
        ...prev,
        selectedModels: updated,
        modelName: nextPrimary,
      };
    });
  };

  // 手动输入并追加一个自定义模型
  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customInputModel.trim();
    if (!val) return;
    if (!newProvider.selectedModels.includes(val)) {
      setNewProvider((prev) => ({
        ...prev,
        selectedModels: [...prev.selectedModels, val],
        modelName: prev.modelName || val,
      }));
    }
    setCustomInputModel("");
  };

  // 在线自动拉取接口支持的模型列表
  const handleFetchModels = async () => {
    if (!newProvider.baseUrl) return;
    setFetchingModels(true);
    setFetchModelMsg(null);
    try {
      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_models",
          baseUrl: newProvider.baseUrl,
          apiKey: newProvider.apiKey,
          protocolType: newProvider.protocolType,
        }),
      });
      const data = await res.json();
      if (data.success && data.models?.length) {
        const modelsArr = data.models as string[];
        setFetchedRemoteModels(modelsArr);

        const filteredImageModels = modelsArr.filter(
          (m) =>
            m.includes("flux") ||
            m.includes("sd") ||
            m.includes("diffusion") ||
            m.includes("kolors") ||
            m.includes("dall") ||
            m.includes("image")
        );
        const toSelect = filteredImageModels.length ? filteredImageModels : modelsArr.slice(0, 10);

        setNewProvider((prev) => {
          const merged = Array.from(new Set([...prev.selectedModels, ...toSelect]));
          return {
            ...prev,
            selectedModels: merged,
            modelName: prev.modelName || merged[0] || "",
          };
        });

        setFetchModelMsg(`成功从上游检测到 ${modelsArr.length} 个模型，已自动为你列出选择框！`);
      } else {
        setFetchModelMsg(data.error || "未能自动获取，您可直接勾选预设或在下方直接添加");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setFetchModelMsg(`拉取失败: ${msg}`);
    } finally {
      setFetchingModels(false);
    }
  };

  // 保存 Provider
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProvider.selectedModels.length === 0) {
      alert("请至少勾选或添加一个可用模型！");
      return;
    }

    try {
      const payload = {
        id: editingProviderId || undefined,
        name: newProvider.name,
        protocolType: newProvider.protocolType,
        baseUrl: newProvider.baseUrl,
        apiKey: newProvider.apiKey,
        modelName: newProvider.modelName || newProvider.selectedModels[0],
        models: newProvider.selectedModels,
        isDefault: newProvider.isDefault,
      };

      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        loadProviders();
        setEditingProviderId(null);
        setNewProvider({
          name: "",
          protocolType: "OPENAI",
          baseUrl: "",
          apiKey: "",
          modelName: "",
          selectedModels: [],
          isDefault: false,
        });
        setFetchModelMsg(null);
        setFetchedRemoteModels([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditClick = (p: ProviderItem) => {
    setEditingProviderId(p.id);
    setNewProvider({
      name: p.name,
      protocolType: p.protocolType,
      baseUrl: p.baseUrl,
      apiKey: "",
      modelName: p.modelName,
      selectedModels: p.modelList?.length ? p.modelList : [p.modelName],
      isDefault: p.isDefault,
    });
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("确定删除该生图配置吗？")) return;
    await fetch(`/api/settings/providers?id=${id}`, { method: "DELETE" });
    loadProviders();
  };

  const handleTestProvider = async (p: ProviderItem) => {
    setTestingProviderId(p.id);
    try {
      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          id: p.id,
          baseUrl: p.baseUrl,
          protocolType: p.protocolType,
        }),
      });
      const data = await res.json();
      setProviderTestMsg((prev) => ({
        ...prev,
        [p.id]: {
          success: data.success,
          text: data.message || data.error,
        },
      }));
    } finally {
      setTestingProviderId(null);
    }
  };

  const testCustomPg = async () => {
    if (!customPgUrl) return;
    setPgTesting(true);
    setPgTestMsg(null);
    try {
      const res = await fetch("/api/settings/pg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: customPgUrl }),
      });
      const data = await res.json();
      setPgTestMsg({ success: data.success, text: data.message || data.error });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setPgTestMsg({ success: false, text: msg });
    } finally {
      setPgTesting(false);
    }
  };

  const handleOssAction = async (action: "save" | "test") => {
    setOssLoading(true);
    setOssStatus(null);
    try {
      const res = await fetch("/api/settings/oss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ossForm, action }),
      });
      const data = await res.json();
      if (data.success) {
        setOssStatus({ success: true, text: data.message });
      } else {
        setOssStatus({ success: false, text: data.error || data.message });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOssStatus({ success: false, text: msg });
    } finally {
      setOssLoading(false);
    }
  };

  const handleLlmAction = async (action: "save" | "test") => {
    setLlmLoading(true);
    setLlmStatus(null);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...llmForm, action }),
      });
      const data = await res.json();
      if (data.success) {
        setLlmStatus({ success: true, text: data.message || "大模型配置已更新" });
      } else {
        setLlmStatus({ success: false, text: data.error });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLlmStatus({ success: false, text: msg });
    } finally {
      setLlmLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">系统与服务配置中心</h1>
          <p className="text-sm text-neutral-400 mt-1">
            统一管理生图供应商、多模型矩阵勾选、RustFS 存储凭证、PostgreSQL 连接状态与账号安全。
          </p>
        </div>

        {/* 顶部标签页切换 */}
        <div className="flex border-b border-neutral-800 gap-2 flex-wrap">
          {[
            { key: "providers", label: "生图接口提供商 (多模型)", icon: Layers },
            { key: "account", label: "账号与密码安全", icon: ShieldCheck },
            { key: "oss", label: "RustFS / 对象存储", icon: Cloud },
            { key: "pg", label: "PostgreSQL 状态", icon: Database },
            { key: "llm", label: "LLM 提示词扩写引擎", icon: Bot },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key as typeof tab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-all cursor-pointer ${
                  active
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. 生图服务提供商配置 (选择框/勾选列表) */}
        {tab === "providers" && (
          <div className="space-y-6">
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">已启用的生图提供商 ({providers.length})</h2>
                <span className="text-xs text-neutral-500">一个供应商可同时关联任意多个模型供工作台秒切</span>
              </div>

              {providers.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                  暂未添加生图提供商，请在下方添加您的首个生图服务
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="bg-neutral-950/60 border border-neutral-800 p-5 rounded-2xl flex flex-col gap-3 hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-base text-white">{p.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300 font-mono">
                            {p.protocolType}
                          </span>
                          {p.isDefault && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              默认激活
                            </span>
                          )}
                          <span className="text-xs text-violet-400 font-medium">
                            已绑定 {p.modelList?.length || 1} 个模型
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTestProvider(p)}
                            disabled={testingProviderId === p.id}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            {testingProviderId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <span>测通</span>
                            )}
                          </button>
                          <button
                            onClick={() => handleEditClick(p)}
                            className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs rounded-xl flex items-center gap-1 cursor-pointer border border-violet-500/30"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>调整勾选模型</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProvider(p.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl cursor-pointer"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-neutral-400 flex flex-wrap gap-x-6 gap-y-1">
                        <span>Base URL: <code className="text-neutral-300">{p.baseUrl}</code></span>
                        <span>首选主模型: <strong className="text-violet-300 font-mono">{p.modelName}</strong></span>
                        <span>Key: {p.hasKey ? "已配置" : "无需Key"}</span>
                      </div>

                      {/* 绑定的模型选择框卡片展示 */}
                      <div className="pt-3 border-t border-neutral-800/80">
                        <span className="text-xs text-neutral-400 block mb-2 font-medium">可在工作台即时切换的模型：</span>
                        <div className="flex flex-wrap gap-2">
                          {p.modelList?.map((m) => (
                            <div
                              key={m}
                              className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border font-mono ${
                                m === p.modelName
                                  ? "bg-violet-600/20 border-violet-500/60 text-white font-medium shadow-sm shadow-violet-600/20"
                                  : "bg-neutral-900 border-neutral-800 text-neutral-300"
                              }`}
                            >
                              <CheckSquare className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                              <span>{m}</span>
                              {m === p.modelName && <span className="text-[10px] text-violet-400 ml-1">(默认)</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {providerTestMsg[p.id] && (
                        <div
                          className={`mt-1 text-xs flex items-center gap-1.5 ${
                            providerTestMsg[p.id].success ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {providerTestMsg[p.id].success ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span>{providerTestMsg[p.id].text}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 新增 / 编辑 Provider 表单 */}
            <form onSubmit={handleSaveProvider} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  {editingProviderId ? (
                    <>
                      <Edit3 className="h-5 w-5 text-violet-400" />
                      <span>编辑供应商配置与模型勾选</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5 text-violet-400" />
                      <span>添加新生图服务供应商 (支持勾选多模型)</span>
                    </>
                  )}
                </h3>
                {editingProviderId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProviderId(null);
                      setNewProvider({
                        name: "",
                        protocolType: "OPENAI",
                        baseUrl: "",
                        apiKey: "",
                        modelName: "",
                        selectedModels: [],
                        isDefault: false,
                      });
                    }}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    取消编辑
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">供应商名称</label>
                  <input
                    type="text"
                    required
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    placeholder="如: SiliconFlow 硅基流动, 官方 OpenAI"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">协议规范</label>
                  <select
                    value={newProvider.protocolType}
                    onChange={(e) => setNewProvider({ ...newProvider, protocolType: e.target.value })}
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="OPENAI">OpenAI 兼容规范 (/v1/images/generations)</option>
                    <option value="SD_WEBUI">Stable Diffusion WebUI (/sdapi/v1/txt2img)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">Base URL</label>
                  <input
                    type="text"
                    required
                    value={newProvider.baseUrl}
                    onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                    placeholder="https://api.siliconflow.cn/v1"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                    API Key {editingProviderId && "(留空表示保持原值)"}
                  </label>
                  <input
                    type="password"
                    value={newProvider.apiKey}
                    onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    placeholder="sk-••••••••"
                    className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* 模型选择框区域 */}
              <div className="border-t border-neutral-800/80 pt-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <CheckSquare className="h-4 w-4 text-violet-400" />
                      <span>勾选该供应商启用的模型 (多选选择框)</span>
                    </span>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      勾选后的模型将全部呈现在创作工作台的模型下拉列表中，随时随地一键秒切。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || !newProvider.baseUrl}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-violet-300 text-xs font-medium rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                  >
                    {fetchingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    <span>一键自动探测并拉取模型</span>
                  </button>
                </div>

                {fetchModelMsg && (
                  <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs text-violet-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>{fetchModelMsg}</span>
                  </div>
                )}

                {/* 常用主流模型选择框 */}
                <div>
                  <span className="text-xs font-medium text-neutral-400 mb-2 block">常用主流模型选择框：</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {POPULAR_IMAGE_MODELS.map((item) => {
                      const isChecked = newProvider.selectedModels.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleModel(item.id)}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                            isChecked
                              ? "bg-violet-600/20 border-violet-500 text-white shadow-sm shadow-violet-600/15"
                              : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-neutral-600 mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{item.label}</div>
                            <div className="text-[10px] text-neutral-500 font-mono truncate mt-0.5">{item.id}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 从上游探测到的其余模型列表 */}
                {fetchedRemoteModels.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-neutral-400 mb-2 block">
                      从上游探测到的其余模型列表 (点击勾选)：
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {fetchedRemoteModels.map((m) => {
                        const isChecked = newProvider.selectedModels.includes(m);
                        return (
                          <div
                            key={m}
                            onClick={() => handleToggleModel(m)}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                              isChecked
                                ? "bg-violet-600/20 border-violet-500 text-white"
                                : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-violet-400 shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-neutral-600 shrink-0" />
                            )}
                            <span className="text-xs font-mono truncate">{m}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 自定义追加模型 */}
                <div className="pt-2">
                  <span className="text-xs font-medium text-neutral-400 mb-1.5 block">
                    或者手动输入并添加自定义模型名称：
                  </span>
                  <div className="flex gap-2 max-w-lg">
                    <input
                      type="text"
                      value={customInputModel}
                      onChange={(e) => setCustomInputModel(e.target.value)}
                      placeholder="如: my-private-flux-lora-v2"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomModel}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl cursor-pointer"
                    >
                      添加并勾选
                    </button>
                  </div>
                </div>

                {/* 当前已勾选的所有模型汇总与默认主模型下拉选择框 */}
                <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-300">
                      当前已选中的模型矩阵 ({newProvider.selectedModels.length})：
                    </span>
                    {newProvider.selectedModels.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewProvider((p) => ({ ...p, selectedModels: [], modelName: "" }))}
                        className="text-[11px] text-red-400 hover:underline"
                      >
                        清空所有勾选
                      </button>
                    )}
                  </div>

                  {newProvider.selectedModels.length === 0 ? (
                    <p className="text-xs text-neutral-500">尚未勾选任何模型，请在上方选择框中勾选至少 1 个模型。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {newProvider.selectedModels.map((m) => (
                        <span
                          key={m}
                          className="px-2.5 py-1 bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg text-xs font-mono flex items-center gap-1.5"
                        >
                          <CheckSquare className="h-3 w-3 text-violet-400" />
                          <span>{m}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleModel(m)}
                            className="text-neutral-500 hover:text-red-400 ml-1 text-sm font-bold leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {newProvider.selectedModels.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="text-xs font-medium text-neutral-400 shrink-0">
                        默认激活主模型 (下拉选择)：
                      </label>
                      <select
                        value={newProvider.modelName}
                        onChange={(e) => setNewProvider({ ...newProvider, modelName: e.target.value })}
                        className="bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
                      >
                        {newProvider.selectedModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-neutral-500">
                        (进入工作台时优先展示该模型)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={newProvider.isDefault}
                  onChange={(e) => setNewProvider({ ...newProvider, isDefault: e.target.checked })}
                  className="rounded border-neutral-700 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="isDefault" className="text-xs text-neutral-300 cursor-pointer">
                  设为当前全局默认生图供应商
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/25"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingProviderId ? "保存供应商与已选模型" : "保存并启用此供应商"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. 账号与密码安全面板 */}
        {tab === "account" && (
          <div className="space-y-6">
            {/* 用户基本信息卡片 */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-violet-400" />
                <span>当前账号信息</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">当前登录邮箱</div>
                  <div className="text-sm font-semibold text-white mt-1 font-mono">
                    {currentUser?.email || "加载中..."}
                  </div>
                </div>
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">创作者昵称</div>
                  <div className="text-sm font-semibold text-white mt-1">
                    {currentUser?.name || "王子恒"}
                  </div>
                </div>
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">账号角色权限</div>
                  <div className="text-sm font-semibold text-violet-400 mt-1">
                    {currentUser?.role === "admin" ? "系统管理员 (Admin)" : "普通用户"}
                  </div>
                </div>
              </div>
            </div>

            {/* 修改密码表单 */}
            <form onSubmit={handleChangePassword} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-4 max-w-xl">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-violet-400" />
                  <span>在线修改密码</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  修改后密码将以安全哈希（bcrypt）存入您的 PostgreSQL 数据库。
                </p>
              </div>

              {pwdStatus && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                    pwdStatus.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {pwdStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                  <span>{pwdStatus.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">当前原密码</label>
                <input
                  type="password"
                  required
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  placeholder="请输入当前正在使用的密码"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">新密码 (至少 6 位)</label>
                <input
                  type="password"
                  required
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  placeholder="请输入新密码"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">确认新密码</label>
                <input
                  type="password"
                  required
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  placeholder="请再次输入新密码"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/25 disabled:opacity-50"
                >
                  {pwdLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>确认修改密码</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. RustFS / 对象存储面板 */}
        {tab === "oss" && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">RustFS / S3 对象存储在线配置</h2>
              <p className="text-xs text-neutral-400 mt-1">
                生成的图片资产将自动持久化至您的 RustFS / S3 Bucket。
              </p>
            </div>

            {ossStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                  ossStatus.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                {ossStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>{ossStatus.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Region (地域)</label>
                <input
                  type="text"
                  value={ossForm.region}
                  onChange={(e) => setOssForm({ ...ossForm, region: e.target.value })}
                  placeholder="us-east-1"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Bucket Name (存储桶名称)</label>
                <input
                  type="text"
                  value={ossForm.bucket}
                  onChange={(e) => setOssForm({ ...ossForm, bucket: e.target.value })}
                  placeholder="omni"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">AccessKey ID</label>
                <input
                  type="text"
                  value={ossForm.accessKeyId}
                  onChange={(e) => setOssForm({ ...ossForm, accessKeyId: e.target.value })}
                  placeholder="admin"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">AccessKey Secret (密文存储)</label>
                <input
                  type="password"
                  value={ossForm.accessKeySecret}
                  onChange={(e) => setOssForm({ ...ossForm, accessKeySecret: e.target.value })}
                  placeholder="若未修改可留空保持原值"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Endpoint</label>
                <input
                  type="text"
                  value={ossForm.endpoint}
                  onChange={(e) => setOssForm({ ...ossForm, endpoint: e.target.value })}
                  placeholder="https://s3.wangziheng.vip"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">自定义 CDN 加速域名 (可选)</label>
                <input
                  type="text"
                  value={ossForm.cdnDomain}
                  onChange={(e) => setOssForm({ ...ossForm, cdnDomain: e.target.value })}
                  placeholder="https://img.yourdomain.com"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
              <button
                onClick={() => handleOssAction("test")}
                disabled={ossLoading}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {ossLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "测试读写连通性"}
              </button>
              <button
                onClick={() => handleOssAction("save")}
                disabled={ossLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-medium rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>保存并应用</span>
              </button>
            </div>
          </div>
        )}

        {/* 4. PG 配置与状态面板 */}
        {tab === "pg" && (
          <div className="space-y-6">
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      pgInfo.connected ? "bg-emerald-500 shadow-lg shadow-emerald-500/50" : "bg-red-500"
                    }`}
                  />
                  <h2 className="text-base font-semibold text-white">当前数据库运行状态</h2>
                </div>
                <button
                  onClick={loadPgStatus}
                  disabled={pgTesting}
                  className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {pgTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
                  <span>刷新检测</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">连接状态</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {pgInfo.connected ? (
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-5 w-5" /> 正常在线
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1.5">
                        <XCircle className="h-5 w-5" /> 异常断开
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">查询往返延迟 (Ping)</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {pgInfo.latencyMs !== undefined ? `${pgInfo.latencyMs} ms` : "--"}
                  </div>
                </div>
                <div className="bg-neutral-950/60 border border-neutral-800/80 p-4 rounded-xl">
                  <div className="text-xs text-neutral-400">已存资产/任务量</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {pgInfo.tableCounts
                      ? `${pgInfo.tableCounts.artifacts} 图片 / ${pgInfo.tableCounts.tasks} 任务`
                      : "--"}
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-400">
                <span className="font-semibold text-neutral-300">当前生效连接串：</span>
                <code className="ml-2 px-2 py-1 bg-neutral-950 rounded border border-neutral-800 text-violet-300">
                  {pgInfo.maskedUrl || "未配置 DATABASE_URL"}
                </code>
              </div>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-2">在线测试 PostgreSQL 连接串</h3>
              <p className="text-xs text-neutral-400 mb-4">
                可以在此填入您手头的远程 PostgreSQL 数据库连接串（带用户名、密码与端口）进行快速连通性拨测。
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={customPgUrl}
                  onChange={(e) => setCustomPgUrl(e.target.value)}
                  placeholder="postgresql://username:password@pg-host.example.com:5432/omni_image?sslmode=require"
                  className="flex-1 bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={testCustomPg}
                  disabled={pgTesting || !customPgUrl}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {pgTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : "测试连接"}
                </button>
              </div>

              {pgTestMsg && (
                <div
                  className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    pgTestMsg.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {pgTestMsg.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>{pgTestMsg.text}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. LLM 提示词扩写引擎 */}
        {tab === "llm" && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">文本大语言模型配置 (提示词扩写与翻译)</h2>
              <p className="text-xs text-neutral-400 mt-1">
                创作工作台中的“魔法棒”智能扩写功能依赖此接口，可接入 DeepSeek、OpenAI、Claude 或任何兼容中转站。
              </p>
            </div>

            {llmStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                  llmStatus.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                {llmStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>{llmStatus.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">Base URL</label>
                <input
                  type="text"
                  value={llmForm.baseUrl}
                  onChange={(e) => setLlmForm({ ...llmForm, baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">模型名称</label>
                <input
                  type="text"
                  value={llmForm.modelName}
                  onChange={(e) => setLlmForm({ ...llmForm, modelName: e.target.value })}
                  placeholder="deepseek-chat 或 gpt-4o-mini"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={llmForm.apiKey}
                  onChange={(e) => setLlmForm({ ...llmForm, apiKey: e.target.value })}
                  placeholder="若未修改可留空保持原值"
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                提示词扩写 System Prompt 模板 (可自定义微调)
              </label>
              <textarea
                rows={5}
                value={llmForm.systemPromptTemplate}
                onChange={(e) => setLlmForm({ ...llmForm, systemPromptTemplate: e.target.value })}
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-neutral-800">
              <button
                onClick={() => handleLlmAction("test")}
                disabled={llmLoading}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {llmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "测试 LLM 通信"}
              </button>
              <button
                onClick={() => handleLlmAction("save")}
                disabled={llmLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-medium rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>保存 LLM 配置</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
