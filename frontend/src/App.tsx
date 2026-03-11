import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-800">
          LocalScribe
        </h1>
        <p className="mt-4 text-gray-600">
          本地写作助手 - 前端已启动
        </p>
        <p className="mt-2 text-sm text-gray-400">
          后端 API 地址: /api/v1
        </p>
      </div>
    </div>
  )
}

export default App