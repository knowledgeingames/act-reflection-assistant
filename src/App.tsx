/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  Brain, 
  Send, 
  ClipboardCheck, 
  History, 
  Sparkles, 
  Loader2, 
  Copy, 
  Check,
  BookOpen,
  Heart,
  Download,
  FileText,
  Settings,
  Key,
  Github,
  X,
  Info,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

// --- System Instruction ---
const SYSTEM_INSTRUCTION = `
你是一位資深且充滿同理心的「臨床心理諮商督導」，擁有數十年的臨床經驗，且高度專精於「接納與承諾治療」（ACT, Acceptance and Commitment Therapy）。你的指導風格是溫和、堅定、具備高度洞察力，且善於使用 Socratic questioning（蘇格拉底式提問）與 ACT 專屬隱喻來啟發受督者（輔導員）。

你的任務是接收輔導員提供的「會談筆記、逐字稿或口述摘要」，並運用 ACT 的「心理彈性六邊形模式（Hexaflex）」進行深度的個案概念化。最後，你必須生成一份結構清晰、具備指導價值的「ACT 會談反思表 (Reflection Sheet)」。

核心原則：
1. 聚焦心理彈性 (Psychological Flexibility)。
2. 善用隱喻 (Metaphors)。
3. 若資訊不足，提出「臨床假設 (Clinical Hypotheses)」並用問句引導。
4. 區分案主與輔導員的狀態。
5. 語氣專業、支持性、啟發性、不帶批判。

輸出格式必須嚴格遵循 Markdown 結構：
## 🌟 ACT 會談反思與個案概念化 (Reflection Sheet)
### 一、 個案狀態分析：心理彈性六邊形 (The Hexaflex)
### 二、 輔導員介入反思 (Therapist Reflection)
### 三、 下一步督導建議 (Next Steps & Interventions)
### 四、 督導的提問與反思 (Questions for the Counselor)
`;

export default function App() {
  const [input, setInput] = useState('');
  const [reflection, setReflection] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('user_gemini_api_key') || '';
  });
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [apiSuccess, setApiSuccess] = useState(false);
  
  const resultRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const handleSaveApiKey = (key: string) => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
      localStorage.setItem('user_gemini_api_key', trimmedKey);
      setCustomApiKey(trimmedKey);
      setApiSuccess(true);
      setApiKeyStatus('API Key 已成功儲存！優先由本機端運作。');
      setTimeout(() => setApiSuccess(false), 3000);
    } else {
      localStorage.removeItem('user_gemini_api_key');
      setCustomApiKey('');
      setApiKeyStatus('已清除自訂 API Key，目前使用系統預設的金鑰。');
    }
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;

    // Determine API Key
    const activeKey = customApiKey.trim() || process.env.GEMINI_API_KEY || '';
    
    if (!activeKey || activeKey === 'MY_GEMINI_API_KEY') {
      setApiKeyStatus('偵測到未配置 API Key！請配置後再試。');
      setIsSettingsOpen(true);
      return;
    }

    setIsLoading(true);
    setReflection('');

    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash", // Using flash as request specifies free option
        contents: input,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      const text = response.text || "無法生成分析，請稍後再試。";
      setReflection(text);
      
      // Smooth scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      if (error?.message?.includes('API_KEY')) {
        setApiKeyStatus('API Key 無效或已過期，請更新。');
        setIsSettingsOpen(true);
      } else {
        setReflection("分析過程中發生錯誤。如果您正在使用自訂 API Key，請檢查您的配額限制或驗證您的金鑰。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reflection);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPDF = async () => {
    if (!pdfContentRef.current) return;
    
    setIsGeneratingPDF(true);
    
    const element = pdfContentRef.current;
    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `ACT_Reflection_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        // Critical: Strip out modern CSS from the cloned document to avoid oklab errors
        onclone: (clonedDoc: Document) => {
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(style => {
            // We keep styles that don't contain modern tailwind variables if possible, 
            // but the safest is to remove them and rely on inline styles or a clean injected style.
            if (style.textContent?.includes('oklch') || style.textContent?.includes('oklab')) {
              style.remove();
            }
          });
          
          // Inject a clean, basic stylesheet for the PDF
          const style = clonedDoc.createElement('style');
          style.textContent = `
            .pdf-export-content { font-family: serif; color: #1a1a1a; background: white; padding: 20px; }
            .pdf-export-content h2 { color: #5A5A40; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; margin-top: 30px; }
            .pdf-export-content h3 { color: #1a1a1a; margin-top: 25px; }
            .pdf-export-content p, .pdf-export-content li { color: #333333; line-height: 1.6; }
            .pdf-export-content blockquote { border-left: 4px solid #e5e5e5; padding-left: 15px; font-style: italic; color: #666666; }
            .pdf-export-content strong { color: #5A5A40; font-weight: bold; }
          `;
          clonedDoc.head.appendChild(style);
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] font-serif selection:bg-[#5A5A40]/20">
      {/* Header */}
      <header className="border-b border-[#1a1a1a]/10 bg-white/50 backdrop-blur-md sticky top-0 z-10 w-full">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-full flex items-center justify-center text-white shadow-lg">
              <Brain size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">ACT Reflection Assistant</h1>
              <p className="text-xs text-[#5A5A40] font-sans uppercase tracking-widest font-medium">Clinical Supervision Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm font-sans text-[#5A5A40]">
            <span className="hidden sm:flex items-center gap-1"><Heart size={14} /> Empathy</span>
            <span className="hidden sm:flex items-center gap-1"><Sparkles size={14} /> Insight</span>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#5A5A40]/20 hover:bg-[#5A5A40]/10 hover:border-[#5A5A40]/40 transition-all font-medium text-xs uppercase tracking-wider bg-white shadow-sm"
            >
              <Settings size={14} />
              設定與自訂金鑰
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Intro Section */}
        <section className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-light leading-tight">
            轉化會談經驗，<br />
            <span className="italic">深化臨床洞察</span>
          </h2>
          <p className="text-lg text-[#1a1a1a]/60 max-w-2xl mx-auto font-sans">
            輸入您的會談筆記或逐字稿，我們將運用 ACT 心理彈性模型為您提供深度的個案概念化與督導建議。
          </p>
        </section>

        {/* Input Section */}
        <section className="bg-white rounded-[32px] p-8 shadow-sm border border-[#1a1a1a]/5 space-y-6">
          <div className="flex items-center gap-2 text-[#5A5A40] font-sans font-semibold uppercase text-xs tracking-widest">
            <BookOpen size={16} />
            <span>會談紀錄與筆記</span>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="在此貼上會談筆記、逐字稿或口述摘要..."
            className="w-full h-64 p-6 bg-[#f9f9f7] rounded-2xl border-none focus:ring-2 focus:ring-[#5A5A40]/20 resize-none font-sans text-lg leading-relaxed placeholder:text-[#1a1a1a]/30 transition-all"
          />

          <div className="flex justify-end">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !input.trim()}
              className={`
                flex items-center gap-2 px-8 py-4 rounded-full font-sans font-bold text-sm uppercase tracking-widest transition-all
                ${isLoading || !input.trim() 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-[#5A5A40] text-white hover:bg-[#4a4a35] hover:shadow-xl active:scale-95'}
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  分析中...
                </>
              ) : (
                <>
                  <Send size={18} />
                  開始 ACT 分析
                </>
              )}
            </button>
          </div>
        </section>

        {/* Result Section */}
        <AnimatePresence>
          {reflection && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              ref={resultRef}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-2 text-[#5A5A40] font-sans font-semibold uppercase text-xs tracking-widest">
                  <ClipboardCheck size={16} />
                  <span>ACT 反思分析結果</span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-widest text-[#5A5A40] hover:text-[#1a1a1a] transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已複製' : '複製內容'}
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-widest text-[#5A5A40] hover:text-[#1a1a1a] transition-colors disabled:opacity-50"
                  >
                    {isGeneratingPDF ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                    下載 PDF
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[32px] p-10 shadow-xl border border-[#1a1a1a]/5 markdown-body max-w-none overflow-hidden relative">
                {/* PDF Export Wrapper (Hidden from main view but used for PDF generation) */}
                <div ref={pdfContentRef} className="pdf-export-content" style={{ backgroundColor: '#ffffff', color: '#1a1a1a' }}>
                  <div className="mb-8 border-b-2 border-[#5A5A40]/20 pb-4 flex items-center justify-between" style={{ borderBottomColor: '#e5e5e5' }}>
                    <div>
                      <h2 className="text-2xl font-serif font-bold text-[#5A5A40] m-0" style={{ color: '#5A5A40' }}>ACT Reflection Sheet</h2>
                      <p className="text-xs font-sans text-[#1a1a1a]/40 uppercase tracking-widest m-0 mt-1" style={{ color: '#666666' }}>Generated by ACT Reflection Assistant</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-sans text-[#1a1a1a]/40 m-0" style={{ color: '#666666' }}>Date: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <ReactMarkdown>{reflection}</ReactMarkdown>
                  <div className="mt-12 pt-4 border-t border-[#1a1a1a]/10 text-center" style={{ borderTopColor: '#e5e5e5' }}>
                    <p className="text-[10px] font-sans text-[#1a1a1a]/30 uppercase tracking-[0.2em]" style={{ color: '#999999' }}>
                      Confidential Clinical Supervision Document
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <footer className="pt-12 border-t border-[#1a1a1a]/10 text-center space-y-6">
          <div className="flex justify-center gap-8 text-[#5A5A40]/40">
            <History size={20} />
            <Brain size={20} />
            <Sparkles size={20} />
          </div>
          <p className="text-xs font-sans text-[#1a1a1a]/40 uppercase tracking-[0.2em]">
            &copy; 2026 ACT Reflection Assistant • 專業心理諮商督導輔助工具
          </p>
        </footer>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] max-w-2xl w-full p-8 shadow-2xl border border-[#1a1a1a]/5 max-h-[90vh] overflow-y-auto space-y-6 font-sans text-[#1a1a1a]"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <Settings className="text-[#5A5A40]" size={22} />
                  <h3 className="text-xl font-bold font-serif">設定與 GitHub 發佈指南</h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 px-2 text-stone-400 hover:text-stone-700 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* API Key Session */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#5A5A40]">
                    <Key size={16} />
                    <span>自訂您的 Gemini API 金鑰 (本機儲存)</span>
                  </div>
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    申請免費 Key <ExternalLink size={12} />
                  </a>
                </div>

                <p className="text-xs text-stone-500 leading-relaxed">
                  本應用程式由本機安全儲存 (localStorage) 管理您的金鑰。如果您打算將此 App 發佈在您的 GitHub Pages 或靜態部落格，別人也可以使用這個對話框來填入他們自己的 Gemini Free API Key 以完全免費使用本服務，不佔用任何您的付費額度！
                </p>

                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={customApiKey ? "••••••••••••••••••••••••••••••••" : "在這裡貼上您的 API Key..."}
                    className="flex-1 px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"
                    id="apiKeyInput"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('apiKeyInput') as HTMLInputElement;
                      if (input) {
                        handleSaveApiKey(input.value);
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-bold rounded-xl transition-all"
                  >
                    更新金鑰
                  </button>
                  {customApiKey && (
                    <button
                      onClick={() => handleSaveApiKey('')}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl transition-all"
                    >
                      清除
                    </button>
                  )}
                </div>

                {apiKeyStatus && (
                  <p className={`text-xs ${apiSuccess ? 'text-emerald-600' : 'text-amber-600'} font-medium`}>
                    {apiKeyStatus}
                  </p>
                )}
              </div>

              {/* Github Guide Session */}
              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-[#5A5A40]">
                  <Github size={16} />
                  <span>部署到 GitHub Pages 指南 (極速靜態發佈)</span>
                </div>

                <div className="text-xs text-stone-600 leading-relaxed space-y-3">
                  <p>
                    這是一個基於 <strong>Vite + React + Tailwind CSS</strong> 的前端應用程式。您可以透過簡單的靜態建置非常容易地部署到 GitHub Pages：
                  </p>
                  
                  <ol className="list-decimal list-inside space-y-2 text-stone-600 pl-1">
                    <li>
                      <strong>匯出程式碼：</strong> 點擊 Google AI Studio 右上角設定選單，點選 <strong>「Export as ZIP」</strong> 下載完整專案。
                    </li>
                    <li>
                      <strong>建立 GitHub 倉庫：</strong> 在您的 GitHub 帳號下建立一個新的 Repository (例如：<code className="bg-stone-100 p-0.5 px-1 rounded text-red-500">act-reflection-assistant</code>)。
                    </li>
                    <li>
                      <strong>初始化並建置專案：</strong>
                      <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg overflow-x-auto text-[10px] my-1 font-mono leading-normal">
{`# 1. 進入解壓後的專案路徑
npm install

# 2. 安裝靜態部署套件
npm install gh-pages --save-dev`}
                      </pre>
                    </li>
                    <li>
                      <strong>設定 <code className="bg-stone-100 p-0.5 px-1 rounded text-red-500">package.json</code>：</strong>
                      <p className="mt-1">
                        在你的專案 <code className="bg-stone-100 p-0.5 px-1 rounded font-mono">package.json</code> 頂層加入：
                      </p>
                      <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg overflow-x-auto text-[10px] my-1 font-mono">
{`"homepage": "https://<你的GitHub帳號>.github.io/<倉庫名稱>",`}
                      </pre>
                      <p className="mt-1">並在 <code className="bg-stone-100 p-0.5 px-1 rounded font-mono">"scripts"</code> 欄位下追加：</p>
                      <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg overflow-x-auto text-[10px] my-1 font-mono">
{`"predeploy": "npm run build",
"deploy": "gh-pages -d dist"`}
                      </pre>
                    </li>
                    <li>
                      <strong>一鍵發佈：</strong>
                      <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg overflow-x-auto text-[10px] my-1 font-mono">
{`npm run deploy`}
                      </pre>
                    </li>
                  </ol>

                  <div className="bg-amber-50 border border-amber-200/50 p-3 rounded-xl text-[11px] text-amber-800 flex gap-2 items-start">
                    <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <strong>免費政策提醒：</strong>
                      Gemini API 提供每分鐘最高 15 次請求的<strong>完全免費額度</strong>，十分適合個人、學生及公益臨床反思。使用自訂金鑰方案可防止惡意刷取您的主金鑰额度，並完美解決在 GitHub 等公開網路上的金鑰外洩問題。
                    </div>
                  </div>

                  {/* Direct Sharing with Custom Key Guide */}
                  <div className="bg-emerald-50 border border-emerald-200/50 p-4 rounded-2xl text-[11px] text-emerald-900 space-y-2 mt-4">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <Sparkles size={14} />
                      <span>進階：如何讓他人不填金鑰「直接使用」您的免費 API Key？</span>
                    </div>
                    <p className="leading-relaxed">
                      由於 GitHub Pages 是靜態網頁（純前端），若想讓他人打開網頁即用，您必須<strong>在打包（Build）時將金鑰編譯進程式碼</strong>。請依照以下步驟進行：
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-emerald-800 pl-1 leading-relaxed">
                      <li>在您下載的專案根目錄中，建立一個名為 <code className="bg-emerald-100 px-1 rounded font-mono font-bold">.env</code> 的檔案。</li>
                      <li>在 <code className="bg-emerald-100 px-1 rounded font-mono font-bold">.env</code> 檔案內寫入您的免費金鑰：<br />
                        <code className="bg-stone-950 text-emerald-400 p-1 px-2 my-1 rounded block font-mono text-[10px]">GEMINI_API_KEY="AIzaSyYourActualKeyHere..."</code>
                      </li>
                      <li>執行 <code className="bg-emerald-100 px-1 rounded font-mono font-bold">npm run build</code>（或執行 <code className="bg-emerald-100 px-1 rounded font-mono font-bold">npm run deploy</code>），Vite compiler 會自動將引用的金鑰直接嵌入編譯後的 JavaScript 中。</li>
                    </ul>
                    <p className="leading-relaxed text-[10px] text-emerald-700 font-medium">
                      ⚠️ <strong>安全性安全提醒：</strong>嵌入客戶端（瀏覽器）程式碼意即任何懂得使用瀏覽器「敏感資訊檢查（F12）」的使用者都有可能提取您的金鑰。但鑑於這是<strong>免費額度的金鑰（Free API Key）</strong>，除了額度用盡以外沒有金錢費用上的損失風險，許多開發者在建立小型公益或示範工具時會採用此方法。
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-6 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  我知道了
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#5A5A40]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#5A5A40]/5 blur-[120px]" />
      </div>
    </div>
  );
}
