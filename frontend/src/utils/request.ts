import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

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
  (error: AxiosError<any>) => {
    // 对响应错误做点什么
    console.error('Response Error:', error);

    // 统一错误处理逻辑
    let errorMessage = '网络请求失败，请检查网络连接';

    if (error.response) {
      // 服务器返回了错误状态码 (4xx, 5xx)
      const status = error.response.status;
      const data = error.response.data;

      if (data?.detail) {
        errorMessage = data.detail;
      } else if (data?.error?.message) {
        errorMessage = data.error.message;
      } else {
        switch (status) {
          case 400:
            errorMessage = '请求参数错误';
            break;
          case 401:
            errorMessage = '未授权，请登录';
            break;
          case 403:
            errorMessage = '拒绝访问';
            break;
          case 404:
            errorMessage = '请求的资源不存在';
            break;
          case 500:
            errorMessage = '服务器内部错误';
            break;
          default:
            errorMessage = `服务器错误: ${status}`;
        }
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      errorMessage = '服务器无响应，请检查后端是否启动';
    } else {
      // 发送请求时出错
      errorMessage = error.message;
    }

    // TODO: 后续这里可以接入全局 UI 提示组件 (如 Toast)
    alert(`错误: ${errorMessage}`); 

    return Promise.reject(error);
  }
);

// 4. 封装常用请求方法
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => 
    service.get(url, config),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => 
    service.post(url, data, config),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => 
    service.put(url, data, config),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => 
    service.patch(url, data, config),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => 
    service.delete(url, config),
};

export default service;
