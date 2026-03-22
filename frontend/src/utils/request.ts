import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

interface FastAPIValidationError {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

interface ApiErrorResponse {
  detail?: string | FastAPIValidationError[];
  error?: {
    message?: string;
    code?: string;
  };
}

export class ApiError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 错误代码映射
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
} as const;

// 1. 创建 axios 实例
const service: AxiosInstance = axios.create({
  baseURL: '/api/v1', // 你的后端 API 基础路径
  timeout: 30000,     // 请求超时时间
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 在发送请求之前做些什么
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error: AxiosError) => {
    // 对请求错误做些什么
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 3. 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // 对响应数据做点什么
    // 直接返回 response.data，这样我们在业务代码中拿到直接就是数据对象
    return response.data;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // 对响应错误做点什么
    console.error('Response Error:', error);

    // 统一错误处理逻辑
    let errorMessage = '网络请求失败，请检查网络连接';
    let errorCode: keyof typeof ERROR_CODES = ERROR_CODES.SERVER_ERROR;
    let errorDetails: unknown = null;

    if (error.response) {
      // 服务器返回了错误状态码 (4xx, 5xx)
      const status = error.response.status;
      const data = error.response.data;
      errorDetails = data;

      if (data?.detail) {
        // 处理字符串类型的 detail
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } 
        // 处理数组类型的 detail（FastAPI 验证错误）
        else if (Array.isArray(data.detail)) {
          const errors = data.detail.map((err: any) => {
            const field = err.loc?.join('.') || '未知字段';
            return `${field}: ${err.msg}`;
          });
          errorMessage = errors.join('; ');
        }
        // 处理对象类型的 detail
        else if (typeof data.detail === 'object') {
          errorMessage = JSON.stringify(data.detail);
        }
      } else if (data?.error?.message) {
        errorMessage = data.error.message;
      } else {
        switch (status) {
          case 400:
            errorMessage = '请求参数错误';
            errorCode = ERROR_CODES.VALIDATION_ERROR;
            break;
          case 401:
            errorMessage = '未授权，请登录';
            errorCode = ERROR_CODES.AUTH_ERROR;
            break;
          case 403:
            errorMessage = '拒绝访问';
            errorCode = ERROR_CODES.PERMISSION_ERROR;
            break;
          case 404:
            errorMessage = '请求的资源不存在';
            errorCode = ERROR_CODES.NOT_FOUND_ERROR;
            break;
          case 422:
            errorMessage = '数据验证失败';
            errorCode = ERROR_CODES.VALIDATION_ERROR;
            break;
          case 500:
            errorMessage = '服务器内部错误';
            errorCode = ERROR_CODES.SERVER_ERROR;
            break;
          default:
            errorMessage = `服务器错误: ${status}`;
            errorCode = ERROR_CODES.SERVER_ERROR;
        }
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      errorMessage = '服务器无响应，请检查后端是否启动';
      errorCode = ERROR_CODES.NETWORK_ERROR;
    } else {
      // 发送请求时出错
      errorMessage = error.message;
      if (error.code === 'ECONNABORTED') {
        errorCode = ERROR_CODES.TIMEOUT_ERROR;
      }
    }

    // TODO: 后续这里可以接入全局 UI 提示组件 (如 Toast)
    console.warn(`API Error [${errorCode}]: ${errorMessage}`);

    // 返回自定义错误对象
    const apiError = new ApiError(errorMessage, error.response?.status, errorCode, errorDetails);
    return Promise.reject(apiError);
  }
);

// 4. 封装常用请求方法
export const api = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => 
    service.get(url, config),
  
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => 
    service.post(url, data, config),
  
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => 
    service.put(url, data, config),
  
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => 
    service.patch(url, data, config),
  
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => 
    service.delete(url, config),
};

export default service;
