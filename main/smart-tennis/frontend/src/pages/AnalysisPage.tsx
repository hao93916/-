import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyzeVideo } from '../services/api';

const AnalysisPage: React.FC = () => {
  // 🌟 使用 useParams 取得 URL 中的 fileId
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('準備中...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileId) {
      startAnalysis(fileId);
    }
  }, [fileId]);

  const startAnalysis = async (id: string) => {
    setAnalyzing(true);
    setError(null);

    // 模擬分析步驟（用於前端進度展示）
    const steps = [
      '初始化模型...',
      '載入影片...',
      '檢測網球...',
      '追蹤軌跡...',
      '分析姿態...',
      '檢測擊球...',
      '計算速度...',
      '生成結果...'
    ];

    try {
      // 1. 執行前端模擬動畫進度
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        setProgress((i / steps.length) * 90); // 模擬到 90%
        await new Promise(resolve => setTimeout(resolve, 800)); // 模擬處理時間
      }

      // 2. 執行實際後端 API 分析
      setCurrentStep('正在處理影片數據...');
      await analyzeVideo(id);

      // 3. 🌟 分析成功後的關鍵動作
      setProgress(100);
      setCurrentStep('分析完成！');
      
      // 儲存 ID 到快取，讓 Navbar 的連結能生效
      localStorage.setItem('lastFileId', id);

      // 4. 等待一下然後跳轉到結果頁面
      setTimeout(() => {
        navigate(`/results/${id}`);
      }, 1000);

    } catch (err: any) {
      console.error('分析失敗:', err);
      setError(err.message || '分析過程中發生錯誤，請稍後再試');
      setAnalyzing(false);
    }
  };

  // 基礎錯誤處理：如果網址沒有 ID
  if (!fileId) {
    return (
      <div className="max-w-4xl mx-auto mt-20 text-center bg-white p-10 rounded-xl shadow-lg">
        <div className="text-red-600 text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mt-2 text-gray-800">無效的分析請求</h2>
        <p className="text-gray-600 mb-6">找不到對應的影片檔案 ID，請重新上傳。</p>
        <button 
          onClick={() => navigate('/upload')}
          className="bg-blue-600 text-white px-8 py-3 rounded-full hover:bg-blue-700 transition-all"
        >
          回到上傳頁面
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          🔍 正在分析您的網球影片
        </h1>
        <p className="text-lg text-gray-500">
          AI 正在分析您的擊球表現，這需要一點時間...
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-8 md:p-12 border border-gray-100">
        {analyzing && !error ? (
          <div className="flex flex-col items-center">
            {/* 動態進度環 */}
            <div className="relative inline-flex items-center justify-center mb-10">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle
                  cx="80" cy="80" r="72"
                  stroke="currentColor" strokeWidth="10" fill="none"
                  className="text-gray-100"
                />
                <circle
                  cx="80" cy="80" r="72"
                  stroke="currentColor" strokeWidth="10" fill="none"
                  strokeDasharray={`${2 * Math.PI * 72}`}
                  strokeDashoffset={`${2 * Math.PI * 72 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="text-blue-500 transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-blue-600">{Math.round(progress)}%</span>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-2 animate-pulse">{currentStep}</h3>
            <p className="text-gray-400 mb-10 text-center max-w-sm">
              我們正在計算球速並追蹤球路軌跡，請保持網頁開啟。
            </p>

            {/* 步驟指示器清單 */}
            <div className="w-full max-w-md space-y-3">
              {[
                { label: '🎯 網球檢測', threshold: 20 },
                { label: '📍 軌跡追蹤', threshold: 45 },
                { label: '🏸 正反手檢測', threshold: 70 },
                { label: '⚡ 速度與力道分析', threshold: 85 }
              ].map((step, idx) => (
                <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  progress >= step.threshold ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100 opacity-60'
                }`}>
                  <span className={`font-medium ${progress >= step.threshold ? 'text-green-700' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                  {progress >= step.threshold ? (
                    <span className="text-green-600 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm">✓</span>
                  ) : (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <div className="text-red-500 text-7xl mb-6">⚠️</div>
            <h3 className="text-2xl font-bold mb-3 text-gray-800">分析發生中斷</h3>
            <p className="text-red-500/80 mb-8 max-w-md mx-auto">{error}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                嘗試重新分析
              </button>
              <button
                onClick={() => navigate('/upload')}
                className="bg-gray-100 text-gray-600 px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors"
              >
                重新上傳檔案
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="text-green-500 text-7xl mb-6 animate-bounce">🎉</div>
            <h3 className="text-2xl font-bold mb-2">分析大功告成！</h3>
            <p className="text-gray-500">正在為您準備精彩的數據圖表...</p>
          </div>
        )}
      </div>

      {/* 底部說明欄位 */}
      <div className="mt-10 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
        <h2 className="text-lg font-bold text-blue-900 mb-6 flex items-center">
          <span className="mr-2">💡</span> AI 核心分析技術
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/60 p-4 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-1">Computer Vision</h4>
            <p className="text-sm text-gray-600 leading-relaxed">基於 YOLOv8 深度學習模型，針對高速運動的網球進行幀級別的精準座標定位。</p>
          </div>
          <div className="bg-white/60 p-4 rounded-lg">
            <h4 className="font-bold text-gray-800 mb-1">Pose Estimation</h4>
            <p className="text-sm text-gray-600 leading-relaxed">透過人體骨架關鍵點檢測，自動辨識擊球瞬間是正手（Forehand）還是反手（Backhand）。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;