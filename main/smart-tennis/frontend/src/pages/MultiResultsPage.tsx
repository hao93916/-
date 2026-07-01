import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom'; 
import { Radar, Scatter } from 'react-chartjs-2';
import axios from 'axios'; 
import {
    Chart as ChartJS, 
    RadialLinearScale, 
    LinearScale,
    PointElement, 
    LineElement, 
    Filler, 
    Tooltip, 
    Legend,
} from 'chart.js';

ChartJS.register(
    RadialLinearScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const API_BASE_URL = 'http://localhost:5000/api';

// --------------------------------------------------------------------------
// 類型定義
// --------------------------------------------------------------------------
interface SummaryData {
    avg_speed: number;
    max_speed: number;
    stabilityScore: number;
    hitHeight: number;
    hitAngle: number;
    total_shots: number;
    forehand_count: number;
    backhand_count: number;
    initial_speed: number; 
}

interface ShotDetail {
    timestamp: number;
    type: 'forehand' | 'backhand';
    side: 'left' | 'right';
    confidence: number; 
    swing_velocity: number; 
}

interface ShotAnalysis {
    shots: ShotDetail[];
}

interface SpeedDistribution {
    range: string; 
    count: number;
    percentage: number; 
}

interface SpeedAnalysis {
    max_speed_kmh: number;
    avg_speed_kmh: number;
    trajectory_speeds: number[];
    speed_distribution: SpeedDistribution[];
}

interface BounceDetail {
    frame: number;
    position: [number, number];
    height: number;
}

export interface FetchedResult { 
    fileId: string;
    fileName: string; 
    name: string; 
    status: '完成' | '失敗' | '處理中';
    data?: {
        summary: SummaryData;
        details: any[]; 
        shots: ShotAnalysis; 
        speed: SpeedAnalysis;
        bounces?: BounceDetail[];
    };
    error?: string;
}

// --------------------------------------------------------------------------
// 輔助組件
// --------------------------------------------------------------------------
const fetchResultsFromBackend = async (batchId: string): Promise<FetchedResult[]> => {
    try {
        const response = await axios.get<FetchedResult[]>(`${API_BASE_URL}/files`, {
            params: { batch_id: batchId }
        });
        return response.data.filter(r => r.fileId); 
    } catch (error) {
        console.error("Failed to fetch results from /api/files:", error);
        return [];
    }
};

const getVideoUrl = (fileId: string): string => `${API_BASE_URL}/video/${fileId}`; 
const getProcessedVideoUrl = (fileId: string): string => `${API_BASE_URL}/processed-video/${fileId}?t=${Date.now()}`; 

const MetricCard: React.FC<any> = ({ label, value, color }) => {
    const borderClass = `border-l-4 ${color === 'blue' ? 'border-blue-500' : color === 'orange' ? 'border-orange-500' : color === 'green' ? 'border-green-500' : color === 'red' ? 'border-red-500' : 'border-purple-500'}`;
    const textClass = `${color === 'blue' ? 'text-blue-600' : color === 'orange' ? 'text-orange-600' : color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-purple-600'}`;
    return (
        <div className={`bg-white p-4 rounded-lg shadow-md ${borderClass} transition-shadow hover:shadow-lg text-center`}>
            <div className={`text-3xl font-bold ${textClass}`}>{value}</div>
            <div className="text-gray-600 text-sm mt-1">{label}</div>
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        <div className="font-semibold text-gray-900">{value}</div>
    </div>
);

const ResultDetailCard: React.FC<{ res: FetchedResult, onDelete: (fileId: string) => void }> = ({ res, onDelete }) => {
    const fileIdText = res.fileId ? res.fileId.substring(0, 8) : 'N/A';

    return (
        <div className="p-5 mb-4 border border-gray-200 rounded-xl shadow-lg bg-white transition-all hover:shadow-xl">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="text-xl font-bold mb-1 text-gray-800">
                        {res.name} <span className="text-sm font-normal text-gray-500">({fileIdText})</span>
                    </h4>
                    <p className={`font-semibold text-sm ${res.status === '完成' ? 'text-green-600' : res.status === '處理中' ? 'text-orange-500' : 'text-red-600'}`}>
                        分析狀態: <span className="font-bold">{res.status}</span>
                    </p>
                </div>
                
                <button
                    onClick={() => onDelete(res.fileId)}
                    className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>刪除</span>
                </button>
            </div>

            {res.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4 p-3 border-t border-gray-100">
                    <DetailItem label="總擊球數" value={`${res.data.summary?.total_shots || 0} 次`} />
                    <DetailItem label="平均速度" value={`${(res.data.summary?.avg_speed || 0).toFixed(1)} km/h`} />
                    <DetailItem label="穩定度" value={`${(res.data.summary?.stabilityScore || 0).toFixed(0)}/100`} />
                    <DetailItem label="擊球高度" value={`${(res.data.summary?.hitHeight || 0).toFixed(1)} m`} />
                </div>
            )}
            {res.error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    錯誤訊息: {res.error}
                </div>
            )}
        </div>
    );
};

type ActiveTab = 'summary' | 'details' | 'shots' | 'speed' | 'videos'; 

// --------------------------------------------------------------------------
// 主頁面組件
// --------------------------------------------------------------------------
const MultiResultsPage: React.FC<{ results?: FetchedResult[] }> = ({ results: initialResults }) => {
    const { batchId } = useParams<{ batchId: string }>(); 
    const [activeTab, setActiveTab] = useState<ActiveTab>('summary'); 
    const [currentResults, setCurrentResults] = useState<FetchedResult[]>(initialResults || []);
    const [isLoading, setIsLoading] = useState(initialResults === undefined); 
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

    useEffect(() => {
        const handleSuccessfulData = (data: FetchedResult[]) => {
            setCurrentResults(data);
            const firstSuccessId = data.find(r => r.status === '完成' && r.data)?.fileId || null;
            setSelectedFileId(firstSuccessId);
            if (batchId) {
                localStorage.setItem('lastBatchId', batchId);
            }
        };

        if (!initialResults && batchId) {
            setIsLoading(true);
            fetchResultsFromBackend(batchId) 
                .then(data => handleSuccessfulData(data))
                .catch(error => console.error("Failed to fetch results:", error))
                .finally(() => setIsLoading(false));
        } else if (initialResults) {
            setIsLoading(false);
            handleSuccessfulData(initialResults);
        }
    }, [batchId, initialResults]);
    
    const successfulResults = currentResults.filter(r => r.status === '完成' && r.data);
    const firstFileSpeedData = successfulResults.length > 0 ? successfulResults[0].data?.speed : undefined;
    
    const handleDelete = async (fileId: string) => {
        if (!window.confirm(`確定要永久刪除檔案 ID: ${fileId} 及其所有分析結果嗎？此操作不可逆！`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/delete/${fileId}`);
            setCurrentResults(prevResults => prevResults.filter(r => r.fileId !== fileId));
            if (selectedFileId === fileId) setSelectedFileId(null);
            alert(`檔案 ${fileId} 刪除成功！`);
        } catch (error) {
            console.error("Deletion failed:", error);
            alert(`刪除失敗：請檢查後端日誌。`);
        }
    };

    const memoizedVideoOptions = useMemo(() => {
        const grouped = successfulResults.reduce((acc, res) => {
            const parts = res.name.split(' - ');
            const personName = parts[0] || '未知球員';
            if (!acc[personName]) acc[personName] = [];
            acc[personName].push(res);
            return acc;
        }, {} as Record<string, typeof successfulResults>);

        const finalOptions: (FetchedResult & { display_name: string })[] = [];
        for (const personName in grouped) {
            grouped[personName].forEach((res, index) => {
                finalOptions.push({
                    ...res,
                    display_name: `${personName} - 影片 ${index + 1}`
                });
            });
        }
        return finalOptions;
    }, [successfulResults]);

    const combinedSummary: SummaryData | null = useMemo(() => {
        if (successfulResults.length === 0) return null;
        const totalShots = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.total_shots || 0), 0);
        const totalForehands = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.forehand_count || 0), 0);
        const totalBackhands = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.backhand_count || 0), 0);
        const avgSpeed = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.avg_speed || 0), 0) / successfulResults.length;
        const avgStability = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.stabilityScore || 0), 0) / successfulResults.length;
        const avgHeight = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.hitHeight || 0), 0) / successfulResults.length;
        const avgAngle = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.hitAngle || 0), 0) / successfulResults.length;
        const avgInitialSpeed = successfulResults.reduce((sum, r) => sum + (r.data!.summary?.initial_speed || 0), 0) / successfulResults.length;
        
        return {
            total_shots: totalShots,
            forehand_count: totalForehands,
            backhand_count: totalBackhands,
            avg_speed: avgSpeed,
            stabilityScore: avgStability,
            hitHeight: avgHeight,
            hitAngle: avgAngle,
            max_speed: Math.max(...successfulResults.map(r => r.data!.summary?.max_speed || 0)),
            initial_speed: avgInitialSpeed, 
        };
    }, [successfulResults]);

    const radarData = useMemo(() => {
        if (!combinedSummary) return null;
        const dataValues = [
            combinedSummary.stabilityScore,
            (combinedSummary.avg_speed / 150) * 100, 
            (combinedSummary.initial_speed / 140) * 100, 
            (combinedSummary.hitHeight / 3) * 100, 
            (combinedSummary.hitAngle / 90) * 100, 
        ];
        return {
            labels: ['穩定度 (0-100)', '平均速度', '初速度 (力量)', '高度控制', '角度控制'],
            datasets: [{
                label: '綜合能力得分',
                data: dataValues,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
            }],
        };
    }, [combinedSummary]);

    // 🌟 網球落點數據 (使用真實數據)
    const scatterData = useMemo(() => {
        if (successfulResults.length === 0) return null;
        
        const allBounces: BounceDetail[] = [];
        successfulResults.forEach(res => {
            if (res.data?.bounces) {
                allBounces.push(...res.data.bounces);
            }
        });

        if (allBounces.length === 0) return null;

        return {
            datasets: [{
                label: '網球落點 (真實數據)',
                data: allBounces.map(b => ({ x: b.position[0], y: b.position[1] })),
                backgroundColor: 'rgba(239, 68, 68, 0.9)', // 紅色點
                borderColor: '#ffffff',
                borderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 10,
            }]
        };
    }, [successfulResults]);

    const scatterOptions = {
        scales: {
            x: { display: false },
            y: { display: false, reverse: true }
        },
        plugins: { 
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) => `落點座標: (X: ${Math.round(context.raw.x)}, Y: ${Math.round(context.raw.y)})`
                }
            }
        },
        maintainAspectRatio: false
    };

    const allShotsData: ShotDetail[] = useMemo(() => {
        return successfulResults
            .flatMap(res => res.data?.shots.shots || [])
            .sort((a, b) => a.timestamp - b.timestamp); 
    }, [successfulResults]);

    if (isLoading) {
        return <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center text-blue-500 font-semibold text-lg">正在根據 Batch ID: {batchId} 加載分析結果...</div>;
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">🏆 多檔案分析結果</h2>
                <div className="text-sm text-gray-500">總共處理 {currentResults.length} 個檔案</div>
            </div>

            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap">
                {(['summary', 'details', 'shots', 'speed', 'videos'] as ActiveTab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        disabled={tab === 'videos' && successfulResults.length === 0}
                        className={`px-4 py-2 text-lg font-medium ${activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'} ${tab === 'videos' && successfulResults.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {tab === 'summary' && '綜合總結'}
                        {tab === 'details' && '詳細列表'}
                        {tab === 'shots' && '擊球分析'}
                        {tab === 'speed' && '速度分析'}
                        {tab === 'videos' && '🎥 影片 (比較)'}
                    </button>
                ))}
            </div>

            {/* TAB: 綜合總結 */}
            {activeTab === 'summary' && combinedSummary ? (
                 <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                        <h4 className="text-xl font-semibold text-gray-700">✅ 關鍵數據一覽</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard label="🎯 穩定度 (0-100)" value={(combinedSummary.stabilityScore || 0).toFixed(0)} color="green" />
                            <MetricCard label="🚀 平均速度 (km/h)" value={(combinedSummary.avg_speed || 0).toFixed(1)} color="blue" />
                            <MetricCard label="⚡ 初速度 (km/h)" value={(combinedSummary.initial_speed || 0).toFixed(1)} color="purple" />
                            <MetricCard label="📏 擊球高度 (m)" value={(combinedSummary.hitHeight || 0).toFixed(1)} color="orange" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                             <MetricCard label="📐 擊球角度 (°)" value={(combinedSummary.hitAngle || 0).toFixed(1)} color="red" />
                        </div>

                        <h4 className="text-xl font-semibold text-gray-700 pt-2">🎾 擊球統計</h4>
                        <div className="bg-purple-50 p-6 rounded-xl shadow-md border-purple-600">
                            <div className="flex flex-col items-center justify-center"> 
                                <div className="text-4xl font-extrabold text-purple-700 mb-3">
                                    {combinedSummary.total_shots || 0} 
                                    <span className="text-lg font-semibold ml-2">次總擊球</span>
                                </div>
                                <div className="flex gap-8 text-lg text-gray-700">
                                    <p className="text-center">正手: <span className="font-bold text-green-600">{combinedSummary.forehand_count || 0}</span> 次</p>
                                    <p className="text-center">反手: <span className="font-bold text-red-600">{combinedSummary.backhand_count || 0}</span> 次</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* 右側圖表區 */}
                    <div className="xl:col-span-1 space-y-6">
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                            <h4 className="text-xl font-semibold mb-4 text-center text-gray-700">📊 綜合能力雷達圖</h4>
                            {radarData && (
                                <div className="h-64 w-full flex justify-center items-center">
                                    <Radar data={radarData} options={{ scales: { r: { suggestedMin: 0, suggestedMax: 100 } }, maintainAspectRatio: false }} />
                                </div>
                            )}
                        </div>

                        {/* 🌟 擬真藍色網球場落點圖 */}
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
                            <h4 className="text-center font-bold text-gray-400 uppercase text-sm mb-4 tracking-tighter">🎾 網球落點分佈預測</h4>
                            {scatterData ? (
                                <div className="relative w-full h-80 bg-[#1e3a8a] rounded-xl overflow-hidden shadow-inner border-4 border-gray-300">
                                    <div className="absolute inset-4 bg-[#2563eb] border-2 border-white">
                                        <div className="absolute top-0 bottom-0 left-[15%] right-[15%] border-x-2 border-white"></div>
                                        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-white/90 shadow-md z-0 -translate-y-1/2"></div>
                                        <div className="absolute top-[23%] bottom-[23%] left-[15%] right-[15%] border-y-2 border-white"></div>
                                        <div className="absolute top-[23%] bottom-[23%] left-1/2 w-[2px] bg-white -translate-x-1/2"></div>
                                        <div className="absolute top-0 left-1/2 w-[2px] h-3 bg-white -translate-x-1/2"></div>
                                        <div className="absolute bottom-0 left-1/2 w-[2px] h-3 bg-white -translate-x-1/2"></div>
                                    </div>
                                    <div className="absolute inset-0 z-10 p-4">
                                        <Scatter data={scatterData} options={scatterOptions as any} />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-48 w-full bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 text-sm font-bold">
                                    這場比賽目前無落點數據
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (activeTab === 'summary' && 
                <div className="bg-white p-10 rounded-lg shadow-md text-center text-gray-500">目前沒有完成分析的檔案結果。</div>
            )}
            
            {/* TAB: 詳細列表 */}
            {activeTab === 'details' && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-700 mb-4">檔案處理詳情與結果</h3>
                    {currentResults.length > 0 ? (
                        currentResults.map((res) => (
                            <ResultDetailCard key={res.fileId} res={res} onDelete={handleDelete} />
                        ))
                    ) : (
                        <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">無詳細結果可供顯示。</div>
                    )}
                </div>
            )}
            
            {/* TAB: 擊球分析 */}
            {activeTab === 'shots' && (
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">擊球詳細分析 (總共 {allShotsData.length} 次擊球)</h3>
                    {allShotsData.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full table-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">信心分數</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">揮拍速度 (km/h)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {allShotsData.map((shot, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{(shot.timestamp || 0).toFixed(2)}s</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${shot.type === 'forehand' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {shot.type === 'forehand' ? '正手 (Forehand)' : '反手 (Backhand)'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{shot.side === 'left' ? '左側' : '右側'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{((shot.confidence || 0) * 100).toFixed(1)}%</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">{(shot.swing_velocity || 0).toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-600 p-4 border rounded-md">未檢測到擊球動作或結果仍在處理中。</p>
                    )}
                </div>
            )}
            
            {/* TAB: 速度分析 */}
            {activeTab === 'speed' && firstFileSpeedData && (
                 <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">🚀 速度分析總覽 (顯示第一個檔案)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow-md text-center border-l-4 border-blue-500">
                            <div className="text-2xl font-bold text-blue-600">{(firstFileSpeedData.max_speed_kmh || 0).toFixed(1)} km/h</div>
                            <div className="text-gray-600">最高速度</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md text-center border-l-4 border-green-500">
                            <div className="text-2xl font-bold text-green-600">{(firstFileSpeedData.avg_speed_kmh || 0).toFixed(1)} km/h</div>
                            <div className="text-gray-600">平均速度</div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md text-center border-l-4 border-purple-500">
                            <div className="text-2xl font-bold text-purple-600">{firstFileSpeedData.trajectory_speeds?.length || 0}</div>
                            <div className="text-gray-600">追蹤到的軌跡數</div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold mb-4 text-gray-700">速度分佈</h3>
                        {firstFileSpeedData.speed_distribution?.length > 0 ? (
                            <div className="space-y-2">
                                {firstFileSpeedData.speed_distribution.map((dist, index) => (
                                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                        <span className="font-medium text-gray-600">{dist.range}</span>
                                        <span className="font-bold text-gray-800">{dist.count} 次 
                                            <span className="ml-2 text-sm text-blue-500">({(dist.percentage || 0).toFixed(1)}%)</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600">無速度分佈數據</p>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'speed' && !firstFileSpeedData && (
                <div className="bg-white p-10 rounded-lg shadow-md text-center text-gray-500">目前沒有速度分析數據可供顯示。</div>
            )}
            
            {/* TAB: 影片比較 */}
            {activeTab === 'videos' && successfulResults.length > 0 ? (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">🎬 單一檔案影片比較檢視</h3>
                    <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <label className="text-gray-700 font-medium">選擇檔案:</label>
                        <select
                            className="p-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500"
                            value={selectedFileId || ''}
                            onChange={(e) => setSelectedFileId(e.target.value)}
                        >
                            <option value="" disabled>--- 請選擇一個已完成的檔案 ---</option>
                            {memoizedVideoOptions.map((res) => (
                                <option key={res.fileId} value={res.fileId}>{res.display_name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedFileId ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-gray-500">
                                <h4 className="text-lg font-bold mb-4 text-gray-700">原始影片 (Raw)</h4>
                                <div className="aspect-video">
                                    <video controls className="w-full h-full rounded bg-black" src={getVideoUrl(selectedFileId)} key={`raw-${selectedFileId}`}>
                                        您的瀏覽器不支援影片播放
                                    </video>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-xl border-t-4 border-blue-500">
                                <h4 className="text-lg font-bold mb-4 text-blue-700">處理後影片 (Processed)</h4>
                                <div className="aspect-video">
                                    <video controls className="w-full h-full rounded bg-black" src={getProcessedVideoUrl(selectedFileId)} key={`processed-${selectedFileId}`}>
                                        您的瀏覽器不支援影片播放
                                    </video>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-10 rounded-lg shadow-md text-center text-gray-500">
                            請從上方下拉選單中選擇一個已完成的檔案以進行影片比較。
                        </div>
                    )}
                </div>
            ) : activeTab === 'videos' && (
                <div className="bg-white p-10 rounded-lg shadow-md text-center text-gray-500">
                    <p className="text-lg">🎥 沒有完成分析的檔案可供播放影片。</p>
                </div>
            )}
        </div>
    );
};

export default MultiResultsPage;