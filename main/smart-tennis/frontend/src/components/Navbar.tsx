import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  
  // 取得儲存的 ID，若無則為 null
  const [ids, setIds] = useState({
    fileId: localStorage.getItem('lastFileId'),
    batchId: localStorage.getItem('lastBatchId')
  });

  // 每次切換頁面時重新檢查一次，確保選單拿到最新分析的 ID
  useEffect(() => {
    setIds({
      fileId: localStorage.getItem('lastFileId'),
      batchId: localStorage.getItem('lastBatchId')
    });
  }, [location]);

  // 配置導覽項目
  const navItems = [
    { name: '首頁', path: '/' },
    { name: '單片分析上傳', path: '/upload' },
    { name: '多片分析上傳', path: '/multiupload' },
    { 
      name: '最後分析結果', 
      path: ids.fileId ? `/results/${ids.fileId}` : '/upload' 
    },
    { 
      name: '最後多重結果', 
      path: ids.batchId ? `/multi-results/${ids.batchId}` : '/multiupload' 
    },
    { name: '球員儀表板', path: '/dashboard' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-blue-600 text-white shadow-lg relative z-50">
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center py-4">
          
          {/* 左側標題 */}
          <Link to="/" className="text-2xl font-bold hover:text-blue-200 transition-colors">
            🎾 Smart Tennis
          </Link>
          
          {/* 右側下拉選單 */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center space-x-2 bg-blue-700 px-4 py-2 rounded-lg hover:bg-blue-800 focus:outline-none transition-all shadow-md"
            >
              <span className="font-medium">功能選單</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 下拉彈窗 */}
            {isOpen && (
              <>
                <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-100">
                  <div className="py-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`block px-4 py-3 text-sm transition-colors ${
                          isActive(item.path)
                            ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          {/* 如果點擊該項會被導向回上傳頁（代表無 ID），顯示小提示 */}
                          {item.name.includes('最後') && item.path.includes('upload') && (
                            <span className="text-[10px] text-gray-400 font-normal">尚未有分析記錄</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;