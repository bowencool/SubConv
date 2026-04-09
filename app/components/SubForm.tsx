"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "subconv_config";

interface SavedConfig {
  link: string;
  time: string;
  standby: boolean;
  standbyLink: string;
  proxy: boolean;
}

export default function SubForm() {
  const [linkInput, setLinkInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [standbySwitch, setStandbySwitch] = useState(false);
  const [standbyInput, setStandbyInput] = useState("");
  const [proxySwitch, setProxySwitch] = useState(true);
  const [linkOutput, setLinkOutput] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  // Restore from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const cfg: SavedConfig = JSON.parse(raw);
      if (cfg.link != null) setLinkInput(cfg.link);
      if (cfg.time != null) setTimeInput(cfg.time);
      if (cfg.standby != null) setStandbySwitch(cfg.standby);
      if (cfg.standbyLink != null) setStandbyInput(cfg.standbyLink);
      if (cfg.proxy != null) setProxySwitch(cfg.proxy);
    } catch {
      // ignore malformed data
    }
  }, []);

  // Save to localStorage
  const saveConfig = useCallback(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        link: linkInput,
        time: timeInput,
        standby: standbySwitch,
        standbyLink: standbyInput,
        proxy: proxySwitch,
      })
    );
  }, [linkInput, timeInput, standbySwitch, standbyInput, proxySwitch]);

  useEffect(() => {
    saveConfig();
  }, [saveConfig]);

  const handleGenerate = () => {
    setLinkError(false);
    setTimeError(false);

    if (!linkInput.trim()) {
      setLinkError(true);
      setTimeout(() => setLinkError(false), 1500);
      return;
    }

    let result = `${location.protocol}//${location.host}/sub?url=${encodeURIComponent(linkInput)}`;

    const time = timeInput.trim();
    if (time !== "") {
      if (/^[1-9][0-9]*$/.test(time)) {
        result += `&interval=${time}`;
      } else {
        setTimeError(true);
        setTimeout(() => setTimeError(false), 1500);
        return;
      }
    }

    if (standbySwitch && standbyInput.trim()) {
      result += `&urlstandby=${encodeURIComponent(standbyInput)}`;
    }

    if (!proxySwitch) {
      result += "&npr=1";
    }

    setLinkOutput(result);
  };

  const handleCopy = () => {
    if (!linkOutput) return;
    navigator.clipboard.writeText(linkOutput).then(() => {
      setShowToast(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 2000);
    });
  };

  const inputClass =
    "flex w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 resize-none transition-colors";

  const switchClass =
    "w-9 h-5 bg-zinc-200 hover:bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 dark:hover:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-50";

  return (
    <div className="space-y-6">
      {/* 订阅链接 */}
      <div className="space-y-2">
        <label
          htmlFor="linkInput"
          className="text-sm font-medium leading-none"
        >
          订阅链接
        </label>
        <textarea
          id="linkInput"
          rows={4}
          className={`${inputClass} ${linkError ? "ring-2 ring-red-400 border-transparent" : ""}`}
          placeholder="请粘贴订阅链接，多个链接请换行或用 | 隔开"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 代理规则集 */}
        <div className="flex items-center justify-between space-x-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="space-y-0.5">
            <label htmlFor="proxySwitch" className="text-sm font-medium">
              代理规则集
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              关闭则直连 GitHub
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              id="proxySwitch"
              type="checkbox"
              className="sr-only peer"
              checked={proxySwitch}
              onChange={(e) => setProxySwitch(e.target.checked)}
            />
            <div className={switchClass} />
          </label>
        </div>

        {/* 备用节点 */}
        <div className="flex items-center justify-between space-x-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="space-y-0.5">
            <label htmlFor="standbySwitch" className="text-sm font-medium">
              备用节点
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              只出现在手动选择分组
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              id="standbySwitch"
              type="checkbox"
              className="sr-only peer"
              checked={standbySwitch}
              onChange={(e) => setStandbySwitch(e.target.checked)}
            />
            <div className={switchClass} />
          </label>
        </div>
      </div>

      {/* 备用节点输入 */}
      {standbySwitch && (
        <div className="space-y-2">
          <textarea
            id="standbyInput"
            rows={3}
            className={inputClass}
            placeholder="请粘贴备用节点，多个备用节点请换行或用 | 符号隔开"
            value={standbyInput}
            onChange={(e) => setStandbyInput(e.target.value)}
          />
        </div>
      )}

      {/* 更新间隔 */}
      <div className="space-y-2">
        <label
          htmlFor="timeInput"
          className="text-sm font-medium leading-none"
        >
          更新间隔{" "}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
            (单位:秒)
          </span>
        </label>
        <input
          id="timeInput"
          type="text"
          placeholder="1800"
          className={`flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 ${timeError ? "ring-2 ring-red-400 border-transparent" : ""}`}
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
        />
      </div>

      <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

      {/* 结果 */}
      <div className="space-y-2 relative">
        <label
          htmlFor="linkOutput"
          className="text-sm font-medium leading-none"
        >
          转换结果
        </label>
        <div className="relative flex w-full">
          <textarea
            id="linkOutput"
            rows={3}
            readOnly
            className={`${inputClass} bg-zinc-50/50 dark:bg-zinc-900/50 pr-20 break-all`}
            value={linkOutput}
          />
          <div className="absolute right-2 top-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700 h-7 px-3"
              title="复制到剪贴板"
            >
              复制
            </button>
          </div>
          {showToast && (
            <span className="absolute right-3 -top-6 text-xs text-green-600 dark:text-green-500 font-medium bg-green-50 dark:bg-green-950/50 px-2 py-1 rounded">
              已复制
            </span>
          )}
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90 h-10 px-4 py-2 mt-4"
      >
        生成订阅配置
      </button>
    </div>
  );
}
